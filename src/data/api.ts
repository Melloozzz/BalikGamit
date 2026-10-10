// Data access layer. Every page reads and writes through these functions, so wiring
// the real backend means replacing the bodies here, not the pages:
//   - plain reads/writes  -> supabase.from(...) under row-level security
//   - status changes      -> supabase.rpc(...) database functions (they check allowed transitions)
//   - AI matching         -> fetch("/api/...") on the Cloudflare Worker
// In demo mode the functions work on the in-memory sample data in ./mock.ts.
import * as db from "./mock";
import type {
  Activity,
  FoundItem,
  Profile,
  Place,
} from "./types";
import { ON_SHELF, isOfficeRole, type OfficeRole } from "./types";
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

/**
 * Strip admin-only fields before anything reaches a student page: ownership evidence, who logged
 * it, where it's shelved, the holding schedule, and the disposal record (staff name and note).
 */
export const toPublic = ({ privateDetails: _p, loggedBy: _l, shelfTag: _s, holdUntil: _h, disposal: _d, ...item }: FoundItem): FoundItem => item;

// ---- people ------------------------------------------------------------------------
export const getProfile = (id: string) => db.profiles.find((p) => p.id === id);
export const findProfileByEmail = (email: string) =>
  db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());

// ---- not yet converted: these still use the sample data in mock.ts ---------------------
const DAY = 86_400_000;
const isoDay = (iso: string) => new Date(`${iso}T00:00:00+08:00`).getTime();
const mockHoldEnds = (item: FoundItem) =>
  item.holdUntil ?? new Date(isoDay(item.foundOn) + db.OFFICE.holdingDays * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const hasOpenClaim = (itemId: string) =>
  db.claims.some((c) => c.itemId === itemId && ["pending", "needs_info", "approved"].includes(c.status));
const mockIsUnclaimed = (item: FoundItem) => item.status === "in_custody" && mockHoldEnds(item) < todayIso() && !hasOpenClaim(item.id);

// ---- profile summary ------------------------------------------------------------------
export function profileStats(user: Profile) {
  if (!isOfficeRole(user.role)) {
    const reports = db.lostReports.filter((r) => r.ownerId === user.id);
    const claims = db.claims.filter((c) => c.claimantId === user.id);
    return [
      { label: "Lost reports", value: reports.length },
      { label: "Claims filed", value: claims.length },
      { label: "Items recovered", value: claims.filter((c) => c.status === "completed").length + reports.filter((r) => r.status === "resolved").length },
    ];
  }
  return [
    { label: "Items you logged", value: db.foundItems.filter((i) => i.loggedBy === user.fullName).length },
    { label: "Claims needing action", value: db.claims.filter((c) => ["pending", "needs_info", "approved"].includes(c.status)).length },
    { label: "Items in custody", value: db.foundItems.filter((i) => ON_SHELF.includes(i.status)).length },
  ];
}

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

// ---- office reports --------------------------------------------------------------------
export interface OfficeReport {
  from: string;
  to: string;
  logged: number;
  returned: number;
  returnRate: number | null;
  medianDaysToReturn: number | null;
  lostReports: number;
  approved: number;
  rejected: number;
  disposed: number;
  weeks: { start: string; logged: number; returned: number }[];
  topCategories: { name: string; n: number }[];
  topLocations: { name: string; n: number }[];
}
/** Counts for the Reports page. `days` = how far back; omit for all time. In production this is one SQL view. */
export function officeReport(days?: number): OfficeReport {
  const to = todayIso();
  // "All time" starts at the oldest record of any kind, so older lost reports and decisions count too.
  const manila = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const dates = [
    ...db.foundItems.map((i) => i.foundOn),
    ...db.lostReports.map((r) => r.lostOn),
    ...db.claims.flatMap((c) => c.history.map((h) => manila(h.at))),
  ];
  const earliest = dates.reduce((m, d) => (d < m ? d : m), to);
  const from = days ? new Date(isoDay(to) - (days - 1) * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) : earliest;
  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const logged = db.foundItems.filter((i) => inRange(i.foundOn));
  const returned = db.foundItems.filter((i) => inRange(i.returnedOn));
  const spans = returned.map((i) => Math.round((isoDay(i.returnedOn!) - isoDay(i.foundOn)) / DAY)).sort((a, b) => a - b);
  const median = spans.length ? (spans.length % 2 ? spans[(spans.length - 1) / 2] : (spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2) : null;
  const decided = (st: "approved" | "rejected") => db.claims.filter((c) => c.history.some((h) => h.status === st && inRange(new Date(h.at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })))).length;
  // Weeks start on Monday.
  const dow = new Date(`${from}T12:00:00+08:00`).getUTCDay();
  const monday = isoDay(from) - ((dow + 6) % 7) * DAY;
  const weeks: OfficeReport["weeks"] = [];
  for (let t = monday; t <= isoDay(to); t += 7 * DAY) {
    const s = new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const e = new Date(t + 6 * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const w = (d?: string) => !!d && d >= s && d <= e && inRange(d);
    weeks.push({ start: s, logged: db.foundItems.filter((i) => w(i.foundOn)).length, returned: db.foundItems.filter((i) => w(i.returnedOn)).length });
  }
  const top = (key: "category" | "location") => {
    const m = new Map<string, number>();
    for (const i of logged) m.set(i[key], (m.get(i[key]) ?? 0) + 1);
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 5);
  };
  return {
    from,
    to,
    logged: logged.length,
    returned: returned.length,
    returnRate: logged.length ? Math.round((logged.filter((i) => i.status === "returned").length / logged.length) * 100) : null,
    medianDaysToReturn: median,
    lostReports: db.lostReports.filter((r) => inRange(r.lostOn)).length,
    approved: decided("approved"),
    rejected: decided("rejected"),
    disposed: db.foundItems.filter((i) => i.disposal && inRange(new Date(i.disposal.at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }))).length,
    weeks,
    topCategories: top("category"),
    topLocations: top("location"),
  };
}

// ---- activity log -------------------------------------------------------------------------
export const listActivity = () => delay([...db.activity].sort((a, b) => b.at.localeCompare(a.at)));

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

// ---- dashboard ------------------------------------------------------------------------
export function dashboardCounts() {
  return {
    inCustody: db.foundItems.filter((i) => ON_SHELF.includes(i.status)).length,
    unclaimed: db.foundItems.filter(mockIsUnclaimed).length,
    // Same rule as the Claim Queue "Needs action" tab: waiting on a decision, a reply, or a release.
    claimsToAct: db.claims.filter((c) => c.status === "pending" || c.status === "needs_info" || c.status === "approved").length,
    // Reports, not flags: two students flagging one post is still one post to review.
    flagged: new Set(db.flaggedPosts.filter((f) => f.visible).map((f) => f.reportId)).size,
  };
}

export { todayIso };
