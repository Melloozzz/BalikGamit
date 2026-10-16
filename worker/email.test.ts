import { afterEach, describe, expect, it, vi } from "vitest";
import { emailUnreadNotifications, matchEmail, messageEmail } from "./email";
import type { Env } from "./supabase";

afterEach(() => vi.unstubAllGlobals());

describe("unread message email", () => {
  it("has the subject and a button to the claim conversation", () => {
    const mail = messageEmail(1, "/admin/claims/ABC123", "https://dev.balikgamit.site");
    expect(mail.subject).toBe("You have a new message on BalikGamit");
    expect(mail.html).toContain('href="https://dev.balikgamit.site/admin/claims/ABC123"');
    expect(mail.text).toContain("https://dev.balikgamit.site/admin/claims/ABC123");
  });

  it("counts the messages", () => {
    expect(messageEmail(1, "/claims/X").html).toContain("You have a new message");
    expect(messageEmail(3, "/claims/X").html).toContain("You have 3 new messages");
    expect(messageEmail(3, "/claims/X").text).toContain("3 new messages");
  });

  it("defaults to the public site and handles a trailing slash", () => {
    expect(messageEmail(1, "/claims/X").text).toContain("https://balikgamit.site/claims/X");
    expect(messageEmail(1, "/claims/X", "http://localhost:8787/").text).toContain("http://localhost:8787/claims/X");
  });

  it("falls back to notifications when the link is missing or not an app path", () => {
    expect(messageEmail(1, null).text).toContain("https://balikgamit.site/notifications");
    expect(messageEmail(1, "https://evil.example").text).toContain("https://balikgamit.site/notifications");
  });

  it("escapes the link in the HTML", () => {
    const mail = messageEmail(1, '/claims/"><script>');
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&#34;&#62;&#60;script&#62;");
  });
});

describe("possible match email", () => {
  it("has a button to the report's matches", () => {
    const mail = matchEmail("/reports/LR-1001/matches", "https://dev.balikgamit.site");
    expect(mail.subject).toBe("A possible match for your lost item on BalikGamit");
    expect(mail.html).toContain("See possible matches");
    expect(mail.html).toContain('href="https://dev.balikgamit.site/reports/LR-1001/matches"');
    expect(mail.text).toContain("https://dev.balikgamit.site/reports/LR-1001/matches");
  });

  it("falls back to notifications for a bad link", () => {
    expect(matchEmail("https://evil.example").text).toContain("https://balikgamit.site/notifications");
  });
});

describe("emailUnreadNotifications", () => {
  const env = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "k", RESEND_API_KEY: "r", EMAIL_FROM: "BalikGamit <no-reply@balikgamit.site>", APP_URL: "https://dev.balikgamit.site" } as Env;

  /** A fake Supabase and Resend. Returns what was emailed and which notifications were marked. */
  function fake(notes: { id: number; user_id: string; type: string; link: string; body?: string }[], people: { id: string; email: string; email_prefs?: Record<string, boolean> }[]) {
    const emails: { to: string; subject: string; html: string; text: string }[] = [];
    const stamped: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("https://api.resend.com")) {
          emails.push(JSON.parse(String(init?.body)));
          return new Response("{}", { status: 200 });
        }
        if (init?.method === "PATCH") {
          stamped.push(url);
          return new Response(null, { status: 204 });
        }
        if (url.includes("/notifications?") && url.includes("is_read=eq.false")) return Response.json(notes.map((n) => ({ ...n, created_at: "2026-10-16T00:00:00Z" })));
        if (url.includes("/notifications?")) return Response.json([]);
        if (url.includes("/profiles?")) return Response.json(people.map((p) => ({ is_active: true, email_prefs: {}, ...p })));
        throw new Error(`unexpected ${url}`);
      }),
    );
    return { emails, stamped };
  }

  it("emails a possible match when the switch is on (the default)", async () => {
    const { emails, stamped } = fake([{ id: 1, user_id: "s1", type: "matches", link: "/reports/LR-1001/matches" }], [{ id: "s1", email: "s1@rtu.edu.ph" }]);
    expect(await emailUnreadNotifications(env)).toBe(1);
    expect(emails[0].to).toBe("s1@rtu.edu.ph");
    expect(emails[0].html).toContain("https://dev.balikgamit.site/reports/LR-1001/matches");
    expect(stamped).toHaveLength(1);
  });

  it("sends nothing when Possible matches is switched off, but marks it so it isn't retried", async () => {
    const { emails, stamped } = fake([{ id: 1, user_id: "s1", type: "matches", link: "/reports/LR-1001/matches" }], [{ id: "s1", email: "s1@rtu.edu.ph", email_prefs: { matches: false } }]);
    expect(await emailUnreadNotifications(env)).toBe(0);
    expect(emails).toHaveLength(0);
    expect(stamped).toHaveLength(1);
  });

  it("sends one email per report, without the notification text", async () => {
    const { emails } = fake(
      [
        { id: 1, user_id: "s1", type: "matches", link: "/reports/LR-1001/matches", body: "Black Wallet" },
        { id: 2, user_id: "s1", type: "matches", link: "/reports/LR-1001/matches", body: "Black Wallet" },
      ],
      [{ id: "s1", email: "s1@rtu.edu.ph" }],
    );
    expect(await emailUnreadNotifications(env)).toBe(1);
    expect(emails[0].html).not.toContain("Black Wallet");
    expect(emails[0].text).not.toContain("Black Wallet");
  });

  it("still emails messages and matches separately", async () => {
    const { emails } = fake(
      [
        { id: 1, user_id: "s1", type: "matches", link: "/reports/LR-1001/matches" },
        { id: 2, user_id: "s1", type: "new_message", link: "/claims/CL-1001" },
      ],
      [{ id: "s1", email: "s1@rtu.edu.ph" }],
    );
    expect(await emailUnreadNotifications(env)).toBe(2);
    expect(emails.map((e) => e.subject).sort()).toEqual(["A possible match for your lost item on BalikGamit", "You have a new message on BalikGamit"]);
  });
});
