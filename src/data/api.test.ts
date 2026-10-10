import { describe, expect, it } from "vitest";
// Tests for the parts of api.ts that still run on the sample data in mock.ts. Each slice that moves
// an area to Supabase removes its tests here; the database functions are tested in SQL.
import { CATEGORIES } from "./mock";
import {
  renamePlace,
  withCurrent,
} from "./api";


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

