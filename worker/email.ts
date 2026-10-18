// Emails for in-app notifications that stay unread (proposal: "When a message stays unread while
// the recipient is offline, the scheduler sends at most one email per thread per hour"; the same
// rule is used for matches and claim decisions). Uses the Resend API when RESEND_API_KEY and EMAIL_FROM are
// set; otherwise it does nothing.
import { rest, type Env } from "./supabase";

interface Note {
  id: number;
  user_id: string;
  type: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

interface Mail {
  subject: string;
  text: string;
  html: string;
}

const MINUTE = 60_000;

/** Same file the Supabase email templates use; balikgamit.site is public, dev.balikgamit.site is behind Access. */
const LOGO = "https://balikgamit.site/coming-soon/logo.png";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The notification's app path on the site, or the notifications page if it isn't an app path. */
const siteUrl = (appUrl: string, link: string | null) => `${appUrl.replace(/\/+$/, "")}${link?.startsWith("/") ? link : "/notifications"}`;

/** Same layout as supabase/templates/*.html: navy header, gold line, one button, backup link. */
function layout(o: { title: string; heading: string; body: string; button: string; url: string; footer: string }) {
  const href = escapeHtml(o.url);
  const font = "font-family:'Segoe UI', Arial, sans-serif;";
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${o.title}</title></head>
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
                <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#00225f;">${o.heading}</h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6;">${o.body}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#00225f; border-radius:8px;"><a href="${href}" style="display:inline-block; padding:14px 28px; ${font} font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">${o.button}</a></td>
                  </tr>
                </table>
                <p style="margin:24px 0 8px; font-size:13px; line-height:1.6; color:#5b6478;">Button not working? Copy this link into your browser:</p>
                <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${href}" style="color:#00225f;">${href}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; border-top:1px solid #e3e7ee; ${font} font-size:12px; line-height:1.6; color:#8a92a3;">
                ${o.footer}<br />
                BalikGamit · Rizal Technological University – Pasig
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * The unread-message email, with a button to the claim conversation. `link` is the notification's
 * app path (/claims/<ref> or /admin/claims/<ref>). Never include message text: messages stay inside the app.
 */
export function messageEmail(count: number, link: string | null, appUrl = "https://balikgamit.site"): Mail {
  const url = siteUrl(appUrl, link);
  const what = count === 1 ? "a new message" : `${count} new messages`;
  const subject = "You have a new message on BalikGamit";
  const text = `You have ${what} about a claim on BalikGamit.\n\nOpen the conversation: ${url}\n\nSign in to read and reply.`;
  const html = layout({
    title: subject,
    heading: `You have ${what}`,
    body: "Someone replied about a claim on BalikGamit. Sign in to read and reply.",
    button: "Open the conversation",
    url,
    footer: "We email at most once an hour per claim, and only when a message stays unread.",
  });
  return { subject, text, html };
}

/**
 * The possible-match email, with a button to the report's match suggestions (/reports/<ref>/matches).
 * No item details or AI explanations: the student sees those in the app after signing in.
 */
export function matchEmail(link: string | null, appUrl = "https://balikgamit.site"): Mail {
  const url = siteUrl(appUrl, link);
  const subject = "A possible match for your lost item on BalikGamit";
  const text = `We may have found your item. A found item at the office could match one of your lost reports on BalikGamit.\n\nSee possible matches: ${url}\n\nSign in to check them. The office confirms every claim before an item is released.`;
  const html = layout({
    title: subject,
    heading: "We may have found your item",
    body: "A found item at the office could match one of your lost reports. Sign in to check the possible matches and file a claim if one is yours.",
    button: "See possible matches",
    url,
    footer: "You can turn these emails off in Settings under Possible matches. We email at most once an hour per report.",
  });
  return { subject, text, html };
}

/**
 * Claim approved, with a button to the claim (/claims/<ref>). `pickup` is the notification body the
 * database writes: where and within how many days to pick the item up. It is office information,
 * not a private detail, so it goes in the email (escaped: the office name can be typed by an admin).
 */
export function claimApprovedEmail(pickup: string | null, link: string | null, appUrl = "https://balikgamit.site"): Mail {
  const url = siteUrl(appUrl, link);
  const subject = "Your claim was approved on BalikGamit";
  const how = pickup?.trim() || "Sign in to see where and when to pick up your item.";
  const text = `Your claim was approved.\n\n${how}\n\nView your claim: ${url}`;
  const html = layout({
    title: subject,
    heading: "Your claim was approved",
    body: `Good news: the office approved your claim. ${escapeHtml(how)}`,
    button: "View your claim",
    url,
    footer: "You can turn these emails off in Settings under Claim updates.",
  });
  return { subject, text, html };
}

/**
 * Claim not approved, with a button to the claim. The reason stays in the app: the office writes it
 * and it may mention item details.
 */
export function claimRejectedEmail(link: string | null, appUrl = "https://balikgamit.site"): Mail {
  const url = siteUrl(appUrl, link);
  const subject = "Update on your claim on BalikGamit";
  const text = `Your claim wasn't approved. Sign in to see why.\n\nView your claim: ${url}`;
  const html = layout({
    title: subject,
    heading: "Update on your claim",
    body: "Your claim wasn't approved. Sign in to see the office's reason.",
    button: "View your claim",
    url,
    footer: "You can turn these emails off in Settings under Claim updates.",
  });
  return { subject, text, html };
}

type Pref = "matches" | "claims";

/** The notification types that get an email, and the Settings switch (if any) that can turn it off. */
const EMAILS: Record<string, { pref?: Pref; build: (notes: Note[], appUrl?: string) => Mail }> = {
  new_message: { build: (notes, appUrl) => messageEmail(notes.length, notes[0].link, appUrl) },
  matches: { pref: "matches", build: (notes, appUrl) => matchEmail(notes[0].link, appUrl) },
  // The latest decision wins if there are several for the same claim.
  claim_approved: { pref: "claims", build: (notes, appUrl) => claimApprovedEmail(notes[notes.length - 1].body, notes[0].link, appUrl) },
  claim_rejected: { pref: "claims", build: (notes, appUrl) => claimRejectedEmail(notes[0].link, appUrl) },
};
const TYPES = Object.keys(EMAILS).join(",");

/** Switch positions nobody has changed yet. Same defaults as src/pages/student/Settings.tsx. */
const DEFAULT_ON: Record<Pref, boolean> = { matches: true, claims: true };

export async function emailUnreadNotifications(env: Env): Promise<number> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return 0;
  const tenMinAgo = new Date(Date.now() - 10 * MINUTE).toISOString();
  const hourAgo = new Date(Date.now() - 60 * MINUTE).toISOString();
  // Older notifications are never emailed, so a newly added email type doesn't reach people about
  // things that happened long ago.
  const dayAgo = new Date(Date.now() - 24 * 60 * MINUTE).toISOString();
  // Unread for at least 10 minutes: the person hasn't seen it in the app.
  const pending = await rest<Note[]>(
    env,
    `notifications?type=in.(${TYPES})&is_read=eq.false&emailed_at=is.null&created_at=lte.${encodeURIComponent(tenMinAgo)}&created_at=gte.${encodeURIComponent(dayAgo)}&select=id,user_id,type,body,link,created_at&order=created_at.asc&limit=200`,
  );
  if (!pending.length) return 0;
  const recent = await rest<{ user_id: string; type: string; link: string | null }[]>(
    env,
    `notifications?type=in.(${TYPES})&emailed_at=gte.${encodeURIComponent(hourAgo)}&select=user_id,type,link`,
  );
  const keyOf = (n: { user_id: string; type: string; link: string | null }) => `${n.user_id} ${n.type} ${n.link}`;
  const sentThisHour = new Set(recent.map(keyOf));

  // One email per person and thread (messages) or report (matches).
  const groups = new Map<string, Note[]>();
  for (const n of pending) groups.set(keyOf(n), [...(groups.get(keyOf(n)) ?? []), n]);
  const ids = [...new Set(pending.map((n) => n.user_id))];
  const people = await rest<{ id: string; email: string; is_active: boolean; email_prefs: Record<string, boolean> | null }[]>(
    env,
    `profiles?id=in.(${ids.join(",")})&select=id,email,is_active,email_prefs`,
  );
  const personOf = new Map(people.filter((p) => p.is_active).map((p) => [p.id, p]));

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
    // Already emailed about this within the hour: leave these for a later run, so they're still
    // covered by the next email if they stay unread.
    if (sentThisHour.has(key)) continue;
    const kind = EMAILS[notes[0].type];
    const person = personOf.get(notes[0].user_id);
    const noteIds = notes.map((n) => n.id);
    const wanted = !kind.pref || (person?.email_prefs?.[kind.pref] ?? DEFAULT_ON[kind.pref]);
    // No one to email (deactivated account) or the switch is off: mark them so they aren't picked
    // up every run. The in-app notification stays.
    if (!person || !wanted) {
      await stamp(noteIds);
      continue;
    }
    const mail = kind.build(notes, env.APP_URL);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: person.email, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) continue; // not marked: tried again next run
    await stamp(noteIds);
    sent++;
  }
  return sent;
}
