import { describe, expect, it } from "vitest";
import { holdEnds, isUnclaimed, toFoundItems } from "./foundItems";
import { OFFICE } from "./reference";
import type { FoundItem } from "./types";

const ADMIN_ONLY = ["privateDetails", "loggedBy", "shelfTag", "holdUntil", "disposal", "openClaims", "hidden"];

const row = {
  id: "00000000-0000-0000-0000-000000000001",
  ref: "BG-1001",
  title: "Black umbrella",
  description: "Folding umbrella with a wooden handle",
  date_found: "2026-08-01",
  status: "donated" as const,
  photo_paths: [],
  category_id: 1,
  location_id: null,
  location_detail: null,
  hold_until: null,
  disposal_note: "Given to the guidance office",
  closed_at: "2026-10-01T02:00:00Z",
  is_hidden: false,
  logger: { full_name: "Maria Santos" },
  disposer: [{ full_name: "Jose Ramirez" }],
  found_item_private: { private_details: "Initials on the strap", storage_location: "A-14" },
  claims: [{ status: "rejected" }, { status: "pending" }],
};

describe("toFoundItems", () => {
  it("never gives students the admin-only fields", async () => {
    const [item] = await toFoundItems([row], false);
    expect(item.id).toBe("BG-1001");
    for (const key of ADMIN_ONLY) expect(item).not.toHaveProperty(key);
  });

  it("keeps the office fields for staff, whether embeds come back as objects or arrays", async () => {
    const [item] = await toFoundItems([row], true);
    expect(item.privateDetails).toBe("Initials on the strap");
    expect(item.shelfTag).toBe("A-14");
    expect(item.loggedBy).toBe("Maria Santos");
    expect(item.disposal).toEqual({ method: "donated", note: "Given to the guidance office", by: "Jose Ramirez", at: "2026-10-01T02:00:00Z" });
    expect(item.openClaims).toBe(1);
  });
});

describe("holding period", () => {
  const base: FoundItem = { id: "BG-1", title: "t", category: "c", location: "l", foundOn: "2026-01-01", description: "d", status: "in_custody" };

  it("ends holdingDays after the date found unless extended", () => {
    OFFICE.holdingDays = 60;
    expect(holdEnds(base)).toBe("2026-03-02");
    expect(holdEnds({ ...base, holdUntil: "2026-12-31" })).toBe("2026-12-31");
  });

  it("is unclaimed only in custody, past the holding period, with no open claim", () => {
    expect(isUnclaimed(base)).toBe(true);
    expect(isUnclaimed({ ...base, openClaims: 1 })).toBe(false);
    expect(isUnclaimed({ ...base, status: "claim_pending" })).toBe(false);
    expect(isUnclaimed({ ...base, holdUntil: "2999-01-01" })).toBe(false);
  });
});
