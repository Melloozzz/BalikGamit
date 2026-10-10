// One Cloudflare Worker: serves the built React app (static assets, see wrangler.jsonc)
// and the API below. The browser talks to Supabase directly for ordinary reads/writes
// under RLS; this Worker only handles what needs the service key: office invites, account
// deletion, the AI job queue, emails, and the scheduled sweeps.
import { Hono } from "hono";
import { auth, profileOf, rest, rpc, storage, userFromToken, type Env } from "./supabase";
import { processJobs } from "./jobs";
import { emailUnreadMessages } from "./email";

type Vars = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));

// Every other route needs a signed-in user. The token is checked with Supabase Auth;
// roles are read from the database, never from anything the client sends.
app.use("*", async (c, next) => {
  if (!c.env.SUPABASE_SERVICE_ROLE_KEY) return c.json({ error: "The server isn't set up yet." }, 503);
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  const user = token ? await userFromToken(c.env, token) : null;
  if (!user) return c.json({ error: "Please sign in again." }, 401);
  c.set("userId", user.id);
  await next();
});

const RTU = /^[^\s@]+@rtu\.edu\.ph$/i;

/** Super admin: invite a new person by email and give them an office role. */
app.post("/admin/invite", async (c) => {
  const me = await profileOf(c.env, c.get("userId"));
  if (!me || me.role !== "super_admin" || !me.is_active) return c.json({ error: "Only a super admin can add admins." }, 403);
  const body = (await c.req.json().catch(() => ({}))) as { fullName?: string; email?: string; role?: string };
  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (fullName.length < 2) return c.json({ error: "Enter the admin's full name." }, 400);
  if (!RTU.test(email)) return c.json({ error: "Use an @rtu.edu.ph email address." }, 400);
  if (body.role !== "admin" && body.role !== "super_admin") return c.json({ error: "Choose a role." }, 400);

  const existing = await rest<{ id: string }[]>(c.env, `profiles?email=eq.${encodeURIComponent(email)}&select=id`);
  if (existing.length) return c.json({ error: "That email already has an account. Add them again and they'll get the role right away." }, 409);

  // The invite link signs them in on the Reset password page, where they choose a password.
  const origin = new URL(c.req.url).origin;
  const invited = await auth<{ id: string }>(c.env, `invite?redirect_to=${encodeURIComponent(`${origin}/reset-password`)}`, {
    method: "POST",
    body: JSON.stringify({ email, data: { full_name: fullName } }),
  }).catch(() => null);
  if (!invited?.id) return c.json({ error: "The invite couldn't be sent. Check the email address and the project's email settings." }, 502);

  // The sign-up trigger made a student profile; give it the office role.
  await rest(c.env, `profiles?id=eq.${invited.id}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ role: body.role, full_name: fullName }),
  });
  await rest(c.env, "admin_activity", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: me.id,
      kind: "admins",
      text: `invited ${fullName} as ${body.role === "super_admin" ? "a super admin" : "an admin"}`,
    }),
  });
  return c.json({ invited: true }, 201);
});

/**
 * A student deletes their own account (Data Privacy Act: right to erasure). Their reports, claims,
 * flags and notifications go with it (foreign keys cascade); their report photos are removed.
 */
app.delete("/account", async (c) => {
  const me = await profileOf(c.env, c.get("userId"));
  if (!me) return c.json({ error: "Account not found." }, 404);
  if (me.role === "admin" || me.role === "super_admin") return c.json({ error: "Office accounts are deactivated by a super admin instead." }, 403);
  const open = await rest<unknown[]>(c.env, `claims?claimant_id=eq.${me.id}&status=in.(pending,needs_info,approved)&select=id`);
  if (open.length) return c.json({ error: "Withdraw your open claims first, then delete your account." }, 409);

  const reports = await rest<{ photo_paths: string[] }[]>(c.env, `lost_reports?reporter_id=eq.${me.id}&select=photo_paths`);
  const photos = reports.flatMap((r) => r.photo_paths ?? []);
  if (photos.length) await storage(c.env, "object/lost-photos", { method: "DELETE", body: JSON.stringify({ prefixes: photos }) }).catch(() => undefined);
  await auth(c.env, `admin/users/${me.id}`, { method: "DELETE" });
  return c.json({ deleted: true });
});

/**
 * Runs a few queued AI jobs now, so a student who just posted a report (or staff who just logged
 * an item) gets matches in seconds instead of at the next scheduled run.
 */
app.post("/jobs/kick", (c) => {
  // Answer right away; the jobs finish in the background.
  c.executionCtx.waitUntil(processJobs(c.env, 2).catch((err) => console.error("kick:", err)));
  return c.json({ queued: true }, 202);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong on the server. Try again." }, 500);
});

const KEEP_ALIVE = "0 3 */3 * *";
const HOURLY = "0 * * * *";

/** One failing step shouldn't stop the others. */
async function step(name: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (err) {
    console.error(`cron ${name}:`, err);
  }
}

/**
 * Deletes closed records older than `days` (purge_old_records), then their photos, which the
 * database can't remove from Storage itself. Same filters as the database function.
 */
async function purge(env: Env, days: number) {
  const cutoff = encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString());
  const [lost, found] = await Promise.all([
    rest<{ photo_paths: string[] | null }[]>(env, `lost_reports?status=in.(resolved,closed,expired)&closed_at=lt.${cutoff}&select=photo_paths`),
    rest<{ photo_paths: string[] | null }[]>(env, `found_items?status=in.(returned,donated,disposed)&closed_at=lt.${cutoff}&select=photo_paths`),
  ]);
  await rpc(env, "purge_old_records", { p_days: days });
  const remove = async (bucket: string, rows: { photo_paths: string[] | null }[]) => {
    const paths = rows.flatMap((r) => r.photo_paths ?? []);
    for (let i = 0; i < paths.length; i += 500) {
      await storage(env, `object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }) });
    }
  };
  await step("purge lost photos", () => remove("lost-photos", lost));
  await step("purge found photos", () => remove("found-photos", found));
}

export default {
  fetch: app.fetch,
  // Proposal: the Cloudflare Cron Trigger keeps the Supabase project awake and runs the sweeps,
  // reminders, AI jobs and emails. The database functions apply the status rules.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === KEEP_ALIVE) {
      // Any request counts as activity; the purge keeps records only as long as the Privacy Notice says.
      ctx.waitUntil(step("purge", () => purge(env, 365)));
      return;
    }
    if (event.cron === HOURLY) {
      ctx.waitUntil(
        (async () => {
          await step("expiry", () => rpc(env, "run_expiry_sweep"));
          await step("pickups", () => rpc(env, "run_pickup_expiry_sweep"));
          await step("reminders", () => rpc(env, "run_reminders"));
        })(),
      );
      return;
    }
    // Every 5 minutes: AI jobs (and retries) and message emails.
    ctx.waitUntil(
      (async () => {
        await step("ai jobs", () => processJobs(env, 3));
        await step("emails", () => emailUnreadMessages(env));
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
