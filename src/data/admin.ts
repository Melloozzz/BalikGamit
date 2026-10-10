// Super admin: the category and location lists, and office accounts. Row-level security
// lets only a super admin change the lists; role and active changes go through database
// functions that check for a super admin.
import { supabase } from "../lib/supabase";
import { isOfficeRole, type OfficeRole, type Place, type Profile } from "./types";
import { loadReference } from "./reference";
import { must } from "./db";
import { emit } from "./events";

type PlaceKind = "category" | "location";
const table = (k: PlaceKind) => (k === "category" ? "categories" : "locations");
const column = (k: PlaceKind) => (k === "category" ? "category_id" : "location_id");
const label = (k: PlaceKind) => (k === "category" ? "category" : "location");

/** Every name in a list with how many records use it (archived names last). */
export async function listPlaces(k: PlaceKind): Promise<(Place & { items: number; reports: number })[]> {
  const [rows, items, reports] = await Promise.all([
    supabase.from(table(k)).select("id, name, archived, sort_order").order("sort_order").order("name").then((r) => must(r) as { id: number; name: string; archived: boolean }[]),
    supabase.from("found_items").select(column(k)).then((r) => must(r) as Record<string, number | null>[]),
    supabase.from("lost_reports").select(column(k)).then((r) => must(r) as Record<string, number | null>[]),
  ]);
  const tally = (list: Record<string, number | null>[]) => {
    const m = new Map<number, number>();
    for (const r of list) {
      const id = r[column(k)];
      if (id != null) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };
  const byItem = tally(items);
  const byReport = tally(reports);
  return [...rows.filter((r) => !r.archived), ...rows.filter((r) => r.archived)].map((r) => ({
    name: r.name,
    archived: r.archived,
    items: byItem.get(r.id) ?? 0,
    reports: byReport.get(r.id) ?? 0,
  }));
}

async function refresh() {
  await loadReference();
  emit();
}

async function existing(k: PlaceKind) {
  return must(await supabase.from(table(k)).select("id, name, sort_order")) as { id: number; name: string; sort_order: number }[];
}

export async function addPlace(k: PlaceKind, name: string) {
  const n = name.trim();
  if (!n) throw new Error("Type a name first.");
  const rows = await existing(k);
  if (rows.some((x) => x.name.toLowerCase() === n.toLowerCase())) throw new Error(`That ${label(k)} already exists.`);
  // Keep "Other"/"Others" last in the dropdown.
  const other = rows.find((x) => /^others?$/i.test(x.name));
  const top = Math.max(0, ...rows.filter((x) => x !== other && x.sort_order < 100).map((x) => x.sort_order));
  must(await supabase.from(table(k)).insert({ name: n, sort_order: top + 1 }));
  if (other && other.sort_order <= top + 1) must(await supabase.from(table(k)).update({ sort_order: top + 2 }).eq("id", other.id));
  await refresh();
  return true;
}

/** Records point at the id, so they follow the rename automatically. */
export async function renamePlace(k: PlaceKind, from: string, to: string) {
  const n = to.trim();
  if (!n) throw new Error("The name can't be empty.");
  const rows = await existing(k);
  // Skip the entry being renamed, so changing only its capitals ("School supplies" → "School Supplies") works.
  if (rows.some((x) => x.name !== from && x.name.toLowerCase() === n.toLowerCase())) throw new Error(`That ${label(k)} already exists.`);
  const row = rows.find((x) => x.name === from);
  if (!row) throw new Error(`That ${label(k)} no longer exists.`);
  must(await supabase.from(table(k)).update({ name: n }).eq("id", row.id));
  await refresh();
  return true;
}

export async function setPlaceArchived(k: PlaceKind, name: string, archived: boolean) {
  const row = (await existing(k)).find((x) => x.name === name);
  if (!row) return false;
  must(await supabase.from(table(k)).update({ archived }).eq("id", row.id));
  await refresh();
  return true;
}

// ---- office accounts --------------------------------------------------------------------------
type ProfileRow = { id: string; full_name: string; email: string; role: Profile["role"]; is_active: boolean; created_at: string };
const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  fullName: r.full_name,
  email: r.email,
  role: r.role,
  active: r.is_active,
  joinedOn: r.created_at.slice(0, 10),
});

export async function listAdmins(): Promise<Profile[]> {
  const rows = must(
    await supabase.from("profiles").select("id, full_name, email, role, is_active, created_at").in("role", ["admin", "super_admin"]).order("full_name"),
  ) as ProfileRow[];
  return rows.map(toProfile).filter((p) => isOfficeRole(p.role));
}

/**
 * Gives someone an office role. If they already have an account, the role changes right away.
 * Otherwise the Worker (which holds the service key) sends them an invite email and sets the role.
 */
export async function inviteAdmin(fullName: string, email: string, role: OfficeRole): Promise<"promoted" | "invited"> {
  const address = email.trim().toLowerCase();
  const found = must(await supabase.from("profiles").select("id, role").eq("email", address).maybeSingle()) as { id: string; role: string } | null;
  if (found) {
    if (found.role === role) throw new Error("That person already has this role.");
    must(await supabase.rpc("admin_set_role", { p_user: found.id, p_role: role }));
    emit();
    return "promoted";
  }
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const res = await fetch("/api/admin/invite", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ fullName: fullName.trim(), email: address, role }),
  }).catch(() => null);
  if (!res || !res.ok) {
    const msg = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(
      msg ?? "The invite service isn't reachable. Ask them to sign up with their RTU email first, then add them here again to give them the role.",
    );
  }
  emit();
  return "invited";
}

export async function setAdminActive(id: string, active: boolean) {
  must(await supabase.rpc("admin_set_active", { p_user: id, p_active: active }));
  emit();
}

/** Anyone can change their own display name (the only profile field the browser may write). */
export async function updateMyName(userId: string, fullName: string) {
  const n = fullName.trim();
  if (n.length < 2) throw new Error("Enter your full name.");
  must(await supabase.from("profiles").update({ full_name: n }).eq("id", userId));
}

/**
 * Deletes the signed-in student's account and everything tied to it (Data Privacy Act: the right
 * to erasure). Needs the service key, so the Worker does it.
 */
export async function deleteMyAccount() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const res = await fetch("/api/account", { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} }).catch(() => null);
  if (!res || !res.ok) throw new Error("Your account couldn't be deleted right now. Try again later, or ask the office to delete it.");
}
