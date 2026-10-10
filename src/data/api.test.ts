import { describe, expect, it } from "vitest";
// Tests for the parts of api.ts that still run on the sample data in mock.ts. Each slice that moves
// an area to Supabase removes its tests here; the database functions are tested in SQL.
import { CATEGORIES } from "./mock";
import {
  createClaim,
  decideClaim,
  itemFor,
  renamePlace,
  withCurrent,
  withdrawClaim,
} from "./api";

const answers = ["a unique scratch", "a receipt inside", "library, Tuesday"];
const questions = ["Q1", "Q2", "Q3"];

describe("withCurrent", () => {
  it("keeps an archived value selectable on a record that uses it", () => {
    expect(withCurrent(["Bags", "Keys"], "Calculators")).toEqual(["Bags", "Keys", "Calculators"]);
    expect(withCurrent(["Bags", "Keys"], "Keys")).toEqual(["Bags", "Keys"]);
    expect(withCurrent(["Bags", "Keys"], "")).toEqual(["Bags", "Keys"]);
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
