import { describe, expect, it } from "vitest";
import { messageEmail } from "./email";

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
