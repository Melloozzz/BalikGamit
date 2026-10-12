// Found items: logged by the office, listed to students while the office holds them.
// Public fields are in found_items; private details and the shelf tag are in
// found_item_private, which only office staff can read (row-level security).
import { supabase } from "../lib/supabase";
import { todayIso } from "../lib/format";
import { ON_SHELF, type FoundItem, type FoundItemStatus } from "./types";
import { OFFICE, categoryId, categoryName, locationId, locationName } from "./reference";
import { idOf, manilaDate, must, one, remember } from "./db";
import { removePhotos, signedUrls, uploadPhoto } from "./photos";
import { emit } from "./events";

const PUBLIC_COLS = "id, ref, title, description, date_found, status, photo_paths, category_id, location_id, location_detail";
const OFFICE_COLS = `${PUBLIC_COLS}, hold_until, disposal_note, closed_at, is_hidden,
  logger:profiles!found_items_logged_by_fkey(full_name),
  disposer:profiles!found_items_disposed_by_fkey(full_name),
  found_item_private(private_details, storage_location),
  claims(status)`;

const OPEN_CLAIM = ["pending", "needs_info", "approved"];

interface Row {
  id: string;
  ref: string;
  title: string;
  description: string;
  date_found: string;
  status: FoundItemStatus;
  photo_paths: string[];
  category_id: number;
  location_id: number | null;
  location_detail: string | null;
  hold_until?: string | null;
  disposal_note?: string | null;
  closed_at?: string | null;
  is_hidden?: boolean;
  logger?: { full_name: string } | { full_name: string }[] | null;
  disposer?: { full_name: string } | { full_name: string }[] | null;
  found_item_private?: { private_details: string; storage_location: string | null } | { private_details: string; storage_location: string | null }[] | null;
  claims?: { status: string }[];
}

/** Rows -> FoundItem, with signed photo URLs. `office` keeps the admin-only fields. */
export async function toFoundItems(rows: Row[], office: boolean): Promise<FoundItem[]> {
  const urls = await signedUrls("found-photos", rows.map((r) => r.photo_paths?.[0]).filter(Boolean));
  return rows.map((r) => {
    remember(r.ref, r.id);
    const item: FoundItem = {
      id: r.ref,
      title: r.title,
      category: categoryName(r.category_id),
      location: locationName(r.location_id),
      locationDetail: r.location_detail ?? undefined,
      foundOn: r.date_found,
      description: r.description,
      photo: r.photo_paths?.[0] ? urls.get(r.photo_paths[0]) : undefined,
      status: r.status,
    };
    if (r.status === "returned" && r.closed_at) item.returnedOn = manilaDate(r.closed_at);
    if (!office) return item;
    const priv = one(r.found_item_private);
    return {
      ...item,
      privateDetails: priv?.private_details || undefined,
      shelfTag: priv?.storage_location || undefined,
      loggedBy: one(r.logger)?.full_name,
      holdUntil: r.hold_until ?? undefined,
      hidden: r.is_hidden,
      openClaims: (r.claims ?? []).filter((c) => OPEN_CLAIM.includes(c.status)).length,
      disposal:
        (r.status === "donated" || r.status === "disposed") && r.closed_at
          ? { method: r.status, note: r.disposal_note ?? "", by: one(r.disposer)?.full_name ?? "Office", at: r.closed_at }
          : undefined,
    };
  });
}

// ---- students -------------------------------------------------------------------------
export interface ItemFilters {
  q?: string;
  category?: string;
  location?: string;
  since?: string;
}

/** Items the office still holds, newest first. Filtering is done here; the list is campus-sized. */
export async function listFoundItems(f: ItemFilters = {}): Promise<FoundItem[]> {
  const rows = must(
    await supabase.from("found_items").select(PUBLIC_COLS).in("status", ON_SHELF).eq("is_hidden", false).order("date_found", { ascending: false }),
  ) as Row[];
  const items = await toFoundItems(rows, false);
  const q = f.q?.trim().toLowerCase();
  return items
    .filter((i) => !f.category || i.category === f.category)
    .filter((i) => !f.location || i.location === f.location)
    .filter((i) => !f.since || i.foundOn >= f.since)
    .filter((i) => !q || `${i.title} ${i.description} ${i.category} ${i.location}`.toLowerCase().includes(q));
}

/** One item by reference number. Students get public fields only; `admin` adds the office fields. */
export async function getFoundItem(ref: string, opts: { admin?: boolean } = {}): Promise<FoundItem | null> {
  const row = must(await supabase.from("found_items").select(opts.admin ? OFFICE_COLS : PUBLIC_COLS).eq("ref", ref).maybeSingle()) as Row | null;
  if (!row) return null;
  return (await toFoundItems([row], !!opts.admin))[0];
}

// ---- office ---------------------------------------------------------------------------
/** Office inventory: every found item, admin fields included, newest first. */
export async function listAllFoundItems(): Promise<FoundItem[]> {
  const rows = must(await supabase.from("found_items").select(OFFICE_COLS).order("date_found", { ascending: false })) as Row[];
  return toFoundItems(rows, true);
}

export interface FoundItemInput {
  title: string;
  category: string;
  location: string;
  locationDetail?: string;
  foundOn: string;
  description: string;
  privateDetails: string;
  shelfTag?: string;
  /** A new photo chosen in the form. */
  photoFile?: File;
}

async function savePrivate(itemId: string, privateDetails: string, shelfTag: string | null) {
  const values = { private_details: privateDetails, storage_location: shelfTag };
  const updated = must(await supabase.from("found_item_private").update(values).eq("found_item_id", itemId).select("found_item_id")) as unknown[];
  if (!updated.length) must(await supabase.from("found_item_private").insert({ found_item_id: itemId, ...values }));
}

/** Logs a new found item. The database queues AI attribute extraction for it automatically. */
export async function logFoundItem(input: FoundItemInput): Promise<FoundItem> {
  const photo = input.photoFile ? await uploadPhoto("found-photos", input.photoFile, "items") : null;
  const row = must(
    await supabase
      .from("found_items")
      .insert({
        title: input.title,
        description: input.description,
        category_id: categoryId(input.category),
        location_id: locationId(input.location),
        location_detail: input.locationDetail || null,
        date_found: input.foundOn,
        photo_paths: photo ? [photo] : [],
      })
      .select("id, ref")
      .single(),
  ) as { id: string; ref: string };
  remember(row.ref, row.id);
  await savePrivate(row.id, input.privateDetails, input.shelfTag || null);
  emit();
  return (await getFoundItem(row.ref, { admin: true }))!;
}

export type FoundItemPatch = Partial<Omit<FoundItemInput, "photoFile">> & { photoFile?: File };

export async function updateFoundItem(ref: string, patch: FoundItemPatch): Promise<FoundItem> {
  const id = await idOf("found_items", ref);
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.category !== undefined) values.category_id = categoryId(patch.category);
  if (patch.location !== undefined) values.location_id = locationId(patch.location);
  if (patch.locationDetail !== undefined) values.location_detail = patch.locationDetail || null;
  if (patch.foundOn !== undefined) values.date_found = patch.foundOn;
  let oldPhotos: string[] = [];
  if (patch.photoFile) {
    const current = must(await supabase.from("found_items").select("photo_paths").eq("id", id).single()) as { photo_paths: string[] };
    oldPhotos = current.photo_paths;
    values.photo_paths = [await uploadPhoto("found-photos", patch.photoFile, "items")];
  }
  if (Object.keys(values).length) must(await supabase.from("found_items").update(values).eq("id", id));
  if (patch.privateDetails !== undefined || patch.shelfTag !== undefined) {
    const current = await getFoundItem(ref, { admin: true });
    await savePrivate(id, patch.privateDetails ?? current?.privateDetails ?? "", (patch.shelfTag ?? current?.shelfTag) || null);
  }
  await removePhotos("found-photos", oldPhotos);
  emit();
  return (await getFoundItem(ref, { admin: true }))!;
}

// ---- holding period -------------------------------------------------------------------
const DAY = 86_400_000;
const isoDay = (iso: string) => new Date(`${iso}T00:00:00+08:00`).getTime();
const toIso = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** Whole days the office has held this item (until today, or until it left). */
export function daysHeld(item: FoundItem) {
  const end = item.returnedOn ? isoDay(item.returnedOn) : item.disposal ? new Date(item.disposal.at).getTime() : isoDay(todayIso());
  return Math.max(0, Math.round((end - isoDay(item.foundOn)) / DAY));
}
/** Last day of the holding period, counting any extension. */
export function holdEnds(item: FoundItem) {
  return item.holdUntil ?? toIso(isoDay(item.foundOn) + OFFICE.holdingDays * DAY);
}
/** In custody, past the holding period, and nobody is claiming it. Needs an office-loaded item. */
export const isUnclaimed = (item: FoundItem) => item.status === "in_custody" && holdEnds(item) < todayIso() && !item.openClaims;

export async function listUnclaimed(): Promise<FoundItem[]> {
  return (await listAllFoundItems()).filter(isUnclaimed).sort((a, b) => a.foundOn.localeCompare(b.foundOn));
}

export async function listDisposed(): Promise<FoundItem[]> {
  const rows = must(
    await supabase.from("found_items").select(OFFICE_COLS).in("status", ["donated", "disposed"]).order("closed_at", { ascending: false }),
  ) as Row[];
  return toFoundItems(rows, true);
}

/** The database function re-checks the holding period and open claims. */
export async function disposeItem(ref: string, method: "donated" | "disposed", note: string) {
  must(await supabase.rpc("admin_dispose_item", { p_id: await idOf("found_items", ref), p_method: method, p_note: note }));
  emit();
}

export async function extendHold(ref: string, days: number) {
  const id = await idOf("found_items", ref);
  must(await supabase.from("found_items").update({ hold_until: toIso(isoDay(todayIso()) + days * DAY) }).eq("id", id));
  emit();
}
