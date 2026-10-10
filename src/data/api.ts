// Data access layer. Every page reads and writes through these functions, so wiring
// the real backend means replacing the bodies here, not the pages:
//   - plain reads/writes  -> supabase.from(...) under row-level security
//   - status changes      -> supabase.rpc(...) database functions (they check allowed transitions)
//   - AI matching         -> fetch("/api/...") on the Cloudflare Worker
// In demo mode the functions work on the in-memory sample data in ./mock.ts.
import * as db from "./mock";
import type {
  Activity,
  Profile,
  Place,
} from "./types";
import { isOfficeRole, type OfficeRole } from "./types";
import { todayIso } from "../lib/format";

// Reference lists and office settings come from the database (src/data/reference.ts).
export { CATEGORIES, LOCATIONS, OFFICE } from "./reference";
// Found items (slice 1): src/data/foundItems.ts.
export {
  listFoundItems,
  getFoundItem,
  listAllFoundItems,
  logFoundItem,
  updateFoundItem,
  daysHeld,
  holdEnds,
  isUnclaimed,
  listUnclaimed,
  listDisposed,
  disposeItem,
  extendHold,
  type ItemFilters,
  type FoundItemInput,
  type FoundItemPatch,
} from "./foundItems";
// Lost reports, matches and moderation (slice 2): src/data/lostReports.ts.
export {
  listPublicLostReports,
  getPublicLostReport,
  listMyReports,
  getMyReport,
  createReport,
  updateReport,
  setReportStatus,
  getMatches,
  listAllLostReports,
  getReport,
  countFlaggedReports,
  flagReport,
  listFlaggedPosts,
  setFlaggedVisible,
  type ReportInput,
  type OfficeLostReport,
} from "./lostReports";
// Claims, messages and notifications (slice 3): src/data/claims.ts.
export {
  listMyClaims,
  listAllClaims,
  listClaimsForItem,
  getClaim,
  listProofQuestions,
  createClaim,
  withdrawClaim,
  decideClaim,
  confirmRelease,
  returnToCustody,
  listMessages,
  sendMessage,
  subscribeToMessages,
  listThreads,
  listNotifications,
  unreadCount,
  markNotificationsRead,
  subscribeToNotifications,
  isClaimable,
  type Thread,
} from "./claims";
// Office overview (slice 4): src/data/office.ts.
export {
  getDashboardCounts,
  getOfficeReport,
  computeOfficeReport,
  listActivity,
  getProfileStats,
  type DashboardCounts,
  type OfficeReport,
} from "./office";
export { useDataVersion } from "./events";
import { emit } from "./events";

/** Dropdown options for a record: an archived category or location it already uses stays selectable. */
export const withCurrent = (list: string[], value: string) => (value && !list.includes(value) ? [...list, value] : list);

// ---- audit trail ------------------------------------------------------------------------
// Demo mode records the signed-in staff name here. In production a database trigger writes the
// activity row from auth.uid(), so the browser can't fake or skip it.
let actor = "Office";
export const setActor = (name: string) => {
  actor = name;
};
function record(kind: Activity["kind"], text: string, subject?: string, href?: string) {
  db.activity.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, kind, text, subject, href });
}

const delay = <T,>(value: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(value), ms));

// ---- people ------------------------------------------------------------------------
export const findProfileByEmail = (email: string) =>
  db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());

// ---- categories and locations (super admin) -------------------------------------------
type PlaceKind = "category" | "location";
const lists = (k: PlaceKind) => (k === "category" ? { live: db.CATEGORIES, archived: db.ARCHIVED_CATEGORIES } : { live: db.LOCATIONS, archived: db.ARCHIVED_LOCATIONS });
const usage = (k: PlaceKind, name: string) => ({
  items: db.foundItems.filter((i) => (k === "category" ? i.category : i.location) === name).length,
  reports: db.lostReports.filter((r) => (k === "category" ? r.category : r.location) === name).length,
});
export function listPlaces(k: PlaceKind): (Place & { items: number; reports: number })[] {
  const { live, archived } = lists(k);
  return [...live.map((name) => ({ name, archived: false })), ...archived.map((name) => ({ name, archived: true }))].map((p) => ({ ...p, ...usage(k, p.name) }));
}
const label = (k: PlaceKind) => (k === "category" ? "category" : "location");
export async function addPlace(k: PlaceKind, name: string) {
  const n = name.trim();
  const { live, archived } = lists(k);
  if (!n) throw new Error("Type a name first.");
  if ([...live, ...archived].some((x) => x.toLowerCase() === n.toLowerCase())) throw new Error(`That ${label(k)} already exists.`);
  // Keep "Other"/"Others" last in the dropdown.
  const otherAt = live.findIndex((x) => /^others?$/i.test(x));
  live.splice(otherAt === -1 ? live.length : otherAt, 0, n);
  record("places", `added the ${label(k)} “${n}”`);
  emit();
  return delay(true);
}
export async function renamePlace(k: PlaceKind, from: string, to: string) {
  const n = to.trim();
  const { live, archived } = lists(k);
  if (!n) throw new Error("The name can't be empty.");
  // Skip the entry being renamed, so changing only its capitals ("School supplies" → "School Supplies") works.
  if ([...live, ...archived].some((x) => x !== from && x.toLowerCase() === n.toLowerCase())) throw new Error(`That ${label(k)} already exists.`);
  for (const arr of [live, archived]) {
    const at = arr.indexOf(from);
    if (at !== -1) arr[at] = n;
  }
  // Existing records follow the rename so filters and reports stay correct.
  for (const i of db.foundItems) if (k === "category" ? i.category === from : i.location === from) k === "category" ? (i.category = n) : (i.location = n);
  for (const r of db.lostReports) if (k === "category" ? r.category === from : r.location === from) k === "category" ? (r.category = n) : (r.location = n);
  record("places", `renamed the ${label(k)} “${from}” to “${n}”`);
  emit();
  return delay(true);
}
export async function setPlaceArchived(k: PlaceKind, name: string, archived: boolean) {
  const { live, archived: arch } = lists(k);
  const [from, into] = archived ? [live, arch] : [arch, live];
  const at = from.indexOf(name);
  if (at === -1) return delay(false);
  from.splice(at, 1);
  into.push(name);
  record("places", `${archived ? "archived" : "restored"} the ${label(k)} “${name}”`);
  emit();
  return delay(true);
}

// ---- admins (super admin only) ------------------------------------------------------
export const listAdmins = () => delay(db.profiles.filter((p) => isOfficeRole(p.role)));
export async function inviteAdmin(fullName: string, email: string, role: OfficeRole) {
  if (findProfileByEmail(email)) throw new Error("That email already has an account.");
  const p: Profile = { id: crypto.randomUUID(), fullName, email, role, active: true };
  db.profiles.push(p);
  record("admins", `invited ${fullName} as ${role === "super_admin" ? "a super admin" : "an admin"}`);
  emit();
  return delay(p);
}
export async function setAdminActive(id: string, active: boolean) {
  const p = db.profiles.find((x) => x.id === id);
  if (p) {
    p.active = active;
    record("admins", `${active ? "reactivated" : "deactivated"} ${p.fullName}'s office account`);
  }
  emit();
  return delay(p);
}

export { todayIso };
