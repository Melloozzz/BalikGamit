// Reference lists and office settings, loaded once per sign-in (AuthContext) and read
// synchronously by the pages. The arrays and the OFFICE object are updated in place, so
// every import sees the current values.
import { supabase } from "../lib/supabase";

/** Live names, in dropdown order. */
export const CATEGORIES: string[] = [];
export const LOCATIONS: string[] = [];
/** Names kept on old records but hidden from the dropdowns. */
export const ARCHIVED_CATEGORIES: string[] = [];
export const ARCHIVED_LOCATIONS: string[] = [];

/** Office settings (office_settings table). Defaults are only used until the first load. */
export const OFFICE = {
  name: "the office",
  pickupDays: 5,
  reportExpiryDays: 90,
  holdingDays: 60,
};

const categoryIds = new Map<string, number>();
const locationIds = new Map<string, number>();
const categoryNames = new Map<number, string>();
const locationNames = new Map<number, string>();

type PlaceRow = { id: number; name: string; archived: boolean };

function fill(rows: PlaceRow[], live: string[], archived: string[], byName: Map<string, number>, byId: Map<number, string>) {
  live.length = 0;
  archived.length = 0;
  byName.clear();
  byId.clear();
  for (const r of rows) {
    (r.archived ? archived : live).push(r.name);
    byName.set(r.name, r.id);
    byId.set(r.id, r.name);
  }
}

/** Reads the lists and settings. Signed-out visitors get the settings only (lists need a sign-in). */
export async function loadReference() {
  const [cats, locs, office] = await Promise.all([
    supabase.from("categories").select("id, name, archived").order("sort_order").order("name"),
    supabase.from("locations").select("id, name, archived").order("sort_order").order("name"),
    supabase.from("office_settings").select("office_name, pickup_days, report_expiry_days, holding_days").maybeSingle(),
  ]);
  fill((cats.data ?? []) as PlaceRow[], CATEGORIES, ARCHIVED_CATEGORIES, categoryIds, categoryNames);
  fill((locs.data ?? []) as PlaceRow[], LOCATIONS, ARCHIVED_LOCATIONS, locationIds, locationNames);
  if (office.data) {
    OFFICE.name = office.data.office_name;
    OFFICE.pickupDays = office.data.pickup_days;
    OFFICE.reportExpiryDays = office.data.report_expiry_days;
    OFFICE.holdingDays = office.data.holding_days;
  }
}

export const categoryName = (id: number | null | undefined) => (id == null ? "" : (categoryNames.get(id) ?? ""));
export const locationName = (id: number | null | undefined) => (id == null ? "" : (locationNames.get(id) ?? ""));

export function categoryId(name: string): number {
  const id = categoryIds.get(name);
  if (id == null) throw new Error("Choose a category from the list.");
  return id;
}
/** Locations are optional on a record; an empty choice stores no location. */
export function locationId(name: string): number | null {
  if (!name) return null;
  const id = locationIds.get(name);
  if (id == null) throw new Error("Choose a location from the list.");
  return id;
}
