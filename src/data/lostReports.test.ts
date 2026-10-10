import { describe, expect, it } from "vitest";
import { toReports } from "./lostReports";

const row = {
  id: "00000000-0000-0000-0000-000000000002",
  ref: "LR-1001",
  reporter_id: "user-1",
  title: "Navy umbrella",
  description: "Navy umbrella with a black strap",
  date_lost: "2026-10-01",
  status: "active" as const,
  is_hidden: false,
  photo_paths: [],
  category_id: 1,
  location_id: null,
  status_note: null,
  lost_report_private: [{ private_details: "Initials on the handle" }],
  match_suggestions: [{ count: 2 }],
};

describe("toReports", () => {
  it("leaves out private details on the public listing", async () => {
    const [r] = await toReports([row], false);
    expect(r.id).toBe("LR-1001");
    expect(r).not.toHaveProperty("privateDetails");
    expect(r.matchCount).toBe(2);
  });

  it("gives the owner their private details", async () => {
    const [r] = await toReports([row], true);
    expect(r.privateDetails).toBe("Initials on the handle");
  });

  it("shows a hidden report as hidden, with a note the owner can act on", async () => {
    const [r] = await toReports([{ ...row, is_hidden: true }], true);
    expect(r.status).toBe("hidden");
    expect(r.statusNote).toMatch(/Hidden by the office/);
  });

  it("explains an expired report", async () => {
    const [r] = await toReports([{ ...row, status: "expired" as const }], true);
    expect(r.statusNote).toMatch(/expired/);
  });
});
