import { describe, expect, it } from "vitest";
import { claimSchema, findBlockedDetail, isRtuEmail, lostReportSchema, resetPasswordSchema, signUpSchema } from "./validation";

describe("isRtuEmail", () => {
  it("accepts RTU addresses in any case", () => {
    expect(isRtuEmail("angela.reyes@rtu.edu.ph")).toBe(true);
    expect(isRtuEmail(" 2024-200544@RTU.EDU.PH ")).toBe(true);
  });
  it("rejects other domains and look-alikes", () => {
    expect(isRtuEmail("angela@gmail.com")).toBe(false);
    expect(isRtuEmail("angela@rtu.edu.ph.evil.com")).toBe(false);
    expect(isRtuEmail("angela@rtuxedu.ph")).toBe(false);
    expect(isRtuEmail("angela@sub.rtu.edu.ph")).toBe(false);
    expect(isRtuEmail("angela@rtu.eduxph")).toBe(false);
  });
});

describe("findBlockedDetail", () => {
  it.each([
    ["call me 0917 123 4567", "phone"],
    ["text +639171234567", "phone"],
    ["09171234567", "phone"],
    ["email me at a.reyes@gmail.com", "email"],
    ["msg me facebook.com/angela.r", "social"],
    ["IG @angela_reyes", "social"],
    ["my student no is 2024-200544", "id_number"],
    ["card 123456789012", "id_number"],
  ])("blocks %s", (text, reason) => {
    expect(findBlockedDetail(text)).toBe(reason);
  });

  it.each([
    "Lost it on 2026-09-22 near Room 304",
    "Navy umbrella with a black strap, about 30 cm folded",
    "Has 3 keys and a blue tag",
    "Left it at the MAE Building, 2nd floor, around 10:30",
  ])("allows ordinary text: %s", (text) => {
    expect(findBlockedDetail(text)).toBeNull();
  });
});

describe("schemas", () => {
  it("sign-up needs consent and matching passwords", () => {
    const base = { fullName: "Angela Reyes", email: "angela.reyes@rtu.edu.ph", password: "Balik#2026", confirm: "Balik#2026" };
    expect(signUpSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, confirm: "different!", consent: true }).success).toBe(false);
  });

  // Same rule as the Supabase Auth setting, so the server never rejects a password the form accepted.
  it.each(["password123", "PASSWORD#123", "password#abc", "Pass#1", "Password123"])("sign-up rejects weak password %s", (pw) => {
    const r = signUpSchema.safeParse({ fullName: "Angela Reyes", email: "angela.reyes@rtu.edu.ph", password: pw, confirm: pw, consent: true });
    expect(r.success).toBe(false);
  });

  it("reset password uses the same rule", () => {
    expect(resetPasswordSchema.safeParse({ password: "weakpass1", confirm: "weakpass1" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "Strong#Pass1", confirm: "Strong#Pass1" }).success).toBe(true);
  });

  it("lost report rejects a phone number in the public description", () => {
    const r = lostReportSchema.safeParse({
      title: "Navy blue umbrella",
      category: "Umbrella",
      location: "MAE Building",
      lostOn: "2026-09-26",
      description: "Navy umbrella, call 09171234567 if found",
      privateDetails: "Initials A.R. on the handle",
    });
    expect(r.success).toBe(false);
  });

  it("claim needs exactly three answers", () => {
    expect(claimSchema.safeParse({ answers: ["Initials inside", "A movie ticket", "Library, Tuesday"] }).success).toBe(true);
    expect(claimSchema.safeParse({ answers: ["Initials inside", "A movie ticket"] }).success).toBe(false);
  });
});
