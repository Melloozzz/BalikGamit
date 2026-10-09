// One Cloudflare Worker: serves the built React app (static assets, see wrangler.jsonc)
// and the API below. The browser talks to Supabase directly for ordinary reads/writes
// under RLS; this Worker only handles secrets, AI calls, privileged admin actions and cron.
import { Hono } from "hono";

interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
}
type Vars = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

/** Minimal PostgREST helper using the service key (never exposed to the browser). */
async function rest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

app.get("/health", (c) => c.json({ ok: true }));

// Every other route needs a signed-in user. The token is checked with Supabase Auth;
// roles are read from the database, never from anything the client sends.
app.use("*", async (c, next) => {
  if (!c.env.SUPABASE_SERVICE_ROLE_KEY) return c.json({ error: "not_configured" }, 503);
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: c.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return c.json({ error: "unauthorized" }, 401);
  const user = (await res.json()) as { id: string };
  c.set("userId", user.id);
  await next();
});

/** Stored match suggestions for one of the caller's lost reports. */
app.get("/reports/:id/matches", async (c) => {
  const id = c.req.param("id");
  const owner = await rest<{ owner_id: string }[]>(c.env, `lost_reports?id=eq.${encodeURIComponent(id)}&select=owner_id`);
  if (owner[0]?.owner_id !== c.get("userId")) return c.json({ error: "not_found" }, 404);
  const matches = await rest<unknown[]>(
    c.env,
    `matches?lost_report_id=eq.${encodeURIComponent(id)}&select=rank,likelihood,why,but,item:found_items(id,title,category,location,found_on,description,photo_path)&order=rank`,
  );
  return c.json({ matches });
});

/** Queue AI extraction + matching for a new or edited report. The cron retries failed jobs. */
app.post("/reports/:id/match", async (c) => {
  await rest(c.env, "ai_jobs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ kind: "match_report", ref_id: c.req.param("id"), requested_by: c.get("userId") }),
  });
  return c.json({ queued: true }, 202);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

export default {
  fetch: app.fetch,
  // Cron: keep-alive ping (every 3 days) and hourly housekeeping.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 3 */3 * *") {
      ctx.waitUntil(rest(env, "categories?select=id&limit=1"));
      return;
    }
    // Database functions do the status changes, so the allowed-transition rules apply here too.
    ctx.waitUntil(rest(env, "rpc/expire_old_reports", { method: "POST", body: "{}" }));
    ctx.waitUntil(rest(env, "rpc/expire_unclaimed_pickups", { method: "POST", body: "{}" }));
    // TODO(Sprint 3): process queued ai_jobs here, respecting Groq rate limits.
  },
} satisfies ExportedHandler<Env>;
