import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  createClaim,
  dashboardCounts,
  decideClaim,
  flagReport,
  getFoundItem,
  getMyReport,
  getReport,
  itemFor,
  listAllLostReports,
  listFlaggedPosts,
  listFoundItems,
  officeReport,
  renamePlace,
  setFlaggedVisible,
  updateReport,
  withCurrent,
  withdrawClaim,
} from "./api";

const ADMIN_ONLY = ["privateDetails", "loggedBy", "shelfTag", "holdUntil", "disposal"];
const answers = ["a unique scratch", "a receipt inside", "library, Tuesday"];
const questions = ["Q1", "Q2", "Q3"];

describe("student item data", () => {
  it("never includes admin-only fields, including the disposal record", async () => {
    const donated = await getFoundItem("BG-0974");
    expect(donated).not.toBeNull();
    for (const key of ADMIN_ONLY) expect(donated).not.toHaveProperty(key);
    for (const item of await listFoundItems()) for (const key of ADMIN_ONLY) expect(item).not.toHaveProperty(key);
  });

  it("keeps admin-only fields for the office", async () => {
    const donated = await getFoundItem("BG-0974", { admin: true });
    expect(donated?.disposal?.by).toBe("Maria Santos");
  });
});

describe("getMyReport", () => {
  it("returns a student's own report and nothing for anyone else's", async () => {
    expect((await getMyReport("u-angela", "LR-214"))?.id).toBe("LR-214");
    expect(await getMyReport("u-angela", "LR-210")).toBeNull();
  });
});

describe("withCurrent", () => {
  it("keeps an archived value selectable on a record that uses it", () => {
    expect(withCurrent(["Bags", "Keys"], "Calculators")).toEqual(["Bags", "Keys", "Calculators"]);
    expect(withCurrent(["Bags", "Keys"], "Keys")).toEqual(["Bags", "Keys"]);
    expect(withCurrent(["Bags", "Keys"], "")).toEqual(["Bags", "Keys"]);
  });
});

describe("flagged posts", () => {
  it("hides every flag on a report together, and counts reports rather than flags", async () => {
    // LR-205 already has one visible flag (FP-33); a second student flags it too.
    await flagReport("LR-205", "u-angela", "fake");
    const before = dashboardCounts().flagged;
    await setFlaggedVisible("FP-33", false);
    const flags = (await listFlaggedPosts()).filter((f) => f.reportId === "LR-205");
    expect(flags).toHaveLength(2);
    expect(flags.every((f) => !f.visible)).toBe(true);
    expect(dashboardCounts().flagged).toBe(before - 1);
  });
});

describe("renamePlace", () => {
  it("allows a rename that only changes capitals, but not one that clashes with another name", async () => {
    await renamePlace("category", "School supplies", "School Supplies");
    expect(CATEGORIES).toContain("School Supplies");
    await expect(renamePlace("category", "School Supplies", "keys")).rejects.toThrow("already exists");
    await renamePlace("category", "School Supplies", "School supplies");
  });
});

describe("officeReport", () => {
  it("counts lost reports filed before the first found item in All time", async () => {
    const all = officeReport();
    expect(all.from <= "2026-06-20").toBe(true);
    expect(all.lostReports).toBe((await listAllLostReports()).length);
  });
});

describe("updateReport", () => {
  it("refuses to edit another student's report", async () => {
    const before = (await getReport("LR-210"))!.title;
    await expect(updateReport("u-angela", "LR-210", { title: "Overwritten" })).rejects.toThrow("Report not found.");
    expect((await getReport("LR-210"))!.title).toBe(before);
  });

  it("lets the owner edit their own report", async () => {
    await updateReport("u-angela", "LR-214", { title: "Navy umbrella, edited" });
    expect((await getReport("LR-214"))!.title).toBe("Navy umbrella, edited");
  });
});

describe("createClaim", () => {
  it.each([
    ["donated", "BG-0974"],
    ["disposed", "BG-0979"],
    ["ready for pickup", "BG-1048"],
    ["returned", "BG-1011"],
  ])("refuses a claim on an item that is %s", async (_status, itemId) => {
    await expect(createClaim("u-mika", itemId, answers, questions)).rejects.toThrow("can't be claimed");
  });

  it("marks an in-custody item as claim pending", async () => {
    await createClaim("u-mika", "BG-1053", answers, questions);
    expect(itemFor("BG-1053")!.status).toBe("claim_pending");
  });
});

describe("closing claims", () => {
  it("puts the item back in custody when its only open claim is rejected", async () => {
    // BG-1039 has one open claim, CL-516.
    await decideClaim("CL-516", "reject", "Details don't match.");
    expect(itemFor("BG-1039")!.status).toBe("in_custody");
  });

  it("keeps the item claim pending while another claim is still open, then releases it", async () => {
    // BG-1042 has two open claims: CL-512 and CL-515.
    await decideClaim("CL-515", "reject", "Details don't match.");
    expect(itemFor("BG-1042")!.status).toBe("claim_pending");
    await withdrawClaim("CL-512");
    expect(itemFor("BG-1042")!.status).toBe("in_custody");
  });
});
