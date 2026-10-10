// Email for unread claim messages (proposal: "When a message stays unread while the recipient is
// offline, the scheduler sends at most one email per thread per hour"). Uses the Resend API when
// RESEND_API_KEY and EMAIL_FROM are set; otherwise it does nothing.
import { rest, type Env } from "./supabase";

interface Note {
  id: number;
  user_id: string;
  link: string | null;
  created_at: string;
}

const MINUTE = 60_000;

export async function emailUnreadMessages(env: Env): Promise<number> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return 0;
  const tenMinAgo = new Date(Date.now() - 10 * MINUTE).toISOString();
  const hourAgo = new Date(Date.now() - 60 * MINUTE).toISOString();
  // Unread for at least 10 minutes: the person hasn't seen it in the app.
  const pending = await rest<Note[]>(
    env,
    `notifications?type=eq.new_message&is_read=eq.false&emailed_at=is.null&created_at=lte.${encodeURIComponent(tenMinAgo)}&select=id,user_id,link,created_at&order=created_at.asc&limit=200`,
  );
  if (!pending.length) return 0;
  const recent = await rest<{ user_id: string; link: string | null }[]>(
    env,
    `notifications?type=eq.new_message&emailed_at=gte.${encodeURIComponent(hourAgo)}&select=user_id,link`,
  );
  const sentThisHour = new Set(recent.map((r) => `${r.user_id} ${r.link}`));

  // One email per person and thread.
  const groups = new Map<string, Note[]>();
  for (const n of pending) {
    const key = `${n.user_id} ${n.link}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const ids = [...new Set(pending.map((n) => n.user_id))];
  const people = await rest<{ id: string; email: string; is_active: boolean }[]>(env, `profiles?id=in.(${ids.join(",")})&select=id,email,is_active`);
  const emailOf = new Map(people.filter((p) => p.is_active).map((p) => [p.id, p.email]));

  // Each email is about two requests; the cron run shares a 50-subrequest budget with the AI jobs.
  const MAX_PER_RUN = 5;
  let sent = 0;
  const stamp = (ids: number[]) =>
    rest(env, `notifications?id=in.(${ids.join(",")})`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ emailed_at: new Date().toISOString() }),
    });
  for (const [key, notes] of groups) {
    if (sent >= MAX_PER_RUN) break;
    // Already emailed about this thread within the hour: leave these for a later run, so they're
    // still covered by the next email if they stay unread.
    if (sentThisHour.has(key)) continue;
    const to = emailOf.get(notes[0].user_id);
    const noteIds = notes.map((n) => n.id);
    // No one to email (deactivated account): mark them so they aren't picked up every run.
    if (!to) {
      await stamp(noteIds);
      continue;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject: "You have a new message on BalikGamit",
        // No message text in the email: messages stay inside the app (proposal: claim-scoped messaging).
        text: `You have ${notes.length === 1 ? "a new message" : `${notes.length} new messages`} about a claim on BalikGamit.\n\nSign in to read and reply.`,
      }),
    });
    if (!res.ok) continue; // not marked: tried again next run
    await stamp(noteIds);
    sent++;
  }
  return sent;
}
