import { describe, expect, it } from "vitest";
import { computeOfficeReport } from "./office";
import type { FoundItem } from "./types";

const item = (over: Partial<FoundItem>): FoundItem => ({
  id: "BG-1",
  title: "t",
  category: "Wallet",
  location: "Library",
  foundOn: "2026-10-01",
  description: "d",
  status: "in_custody",
  ...over,
});

describe("computeOfficeReport", () => {
  const input = {
    items: [
      item({ id: "BG-1", foundOn: "2026-10-01", status: "returned", returnedOn: "2026-10-05" }),
      item({ id: "BG-2", foundOn: "2026-10-03", category: "Keys" }),
      item({ id: "BG-3", foundOn: "2026-06-01", status: "donated", disposal: { method: "donated", note: "", by: "x", at: "2026-09-01T02:00:00Z" } }),
    ],
    lostOn: ["2026-05-20", "2026-10-02"],
    decisions: [
      { status: "approved" as const, at: "2026-10-04T03:00:00Z" },
      { status: "rejected" as const, at: "2026-10-06T03:00:00Z" },
    ],
  };

  it("counts the last 30 days", () => {
    const r = computeOfficeReport(input, 30, "2026-10-10");
    expect(r.logged).toBe(2);
    expect(r.returned).toBe(1);
    expect(r.returnRate).toBe(50);
    expect(r.medianDaysToReturn).toBe(4);
    expect(r.lostReports).toBe(1);
    expect(r.approved + r.rejected).toBe(2);
    expect(r.topCategories[0]).toEqual({ name: "Keys", n: 1 });
  });

  it("starts All time at the oldest record of any kind, including lost reports", () => {
    const r = computeOfficeReport(input, undefined, "2026-10-10");
    expect(r.from).toBe("2026-05-20");
    expect(r.lostReports).toBe(2);
    expect(r.disposed).toBe(1);
  });
});
