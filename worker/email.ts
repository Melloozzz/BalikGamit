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

/** Same file the Supabase email templates use; balikgamit.site is public, dev.balikgamit.site is behind Access. */
const LOGO = "https://balikgamit.site/coming-soon/logo.png";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * The unread-message email: same layout as supabase/templates/*.html, with a button to the claim
 * conversation. `link` is the notification's app path (/claims/<ref> or /admin/claims/<ref>).
 * Never include message text: messages stay inside the app.
 */
export function messageEmail(count: number, link: string | null, appUrl = "https://balikgamit.site") {
  const url = `${appUrl.replace(/\/+$/, "")}${link?.startsWith("/") ? link : "/notifications"}`;
  const what = count === 1 ? "a new message" : `${count} new messages`;
  const subject = "You have a new message on BalikGamit";
  const text = `You have ${what} about a claim on BalikGamit.\n\nOpen the conversation: ${url}\n\nSign in to read and reply.`;
  const href = escapeHtml(url);
  const font = "font-family:'Segoe UI', Arial, sans-serif;";
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${subject}</title></head>
  <body style="margin:0; padding:0; background-color:#eef1f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:#00225f; padding:24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#ffffff; border-radius:8px; padding:6px 8px;"><img src="${LOGO}" width="24" height="32" alt="" style="display:block; border:0;" /></td>
                    <td style="padding-left:12px; ${font} font-size:22px; font-weight:700; color:#ffffff;">Balik<span style="color:#d9a713;">Gamit</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="background-color:#d9a713; height:4px; line-height:4px; font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:32px; ${font} color:#1f2a44;">
                <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#00225f;">You have ${what}</h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6;">Someone replied about a claim on BalikGamit. Sign in to read and reply.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#00225f; border-radius:8px;"><a href="${href}" style="display:inline-block; padding:14px 28px; ${font} font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">Open the conversation</a></td>
                  </tr>
                </table>
                <p style="margin:24px 0 8px; font-size:13px; line-height:1.6; color:#5b6478;">Button not working? Copy this link into your browser:</p>
                <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${href}" style="color:#00225f;">${href}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; border-top:1px solid #e3e7ee; ${font} font-size:12px; line-height:1.6; color:#8a92a3;">
                We email at most once an hour per claim, and only when a message stays unread.<br />
                BalikGamit · Rizal Technological University – Pasig
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

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
    // No message text in the email: messages stay inside the app (proposal: claim-scoped messaging).
    const mail = messageEmail(notes.length, notes[0].link, env.APP_URL);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) continue; // not marked: tried again next run
    await stamp(noteIds);
    sent++;
  }
  return sent;
}
