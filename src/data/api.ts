// Data access layer. Every page reads and writes through these functions, so wiring
// the real backend means replacing the bodies here, not the pages:
//   - plain reads/writes  -> supabase.from(...) under row-level security
//   - status changes      -> supabase.rpc(...) database functions (they check allowed transitions)
//   - AI matching         -> fetch("/api/...") on the Cloudflare Worker
// In demo mode the functions work on the in-memory sample data in ./mock.ts.
import { useSyncExternalStore } from "react";
import * as db from "./mock";
import type {
  Activity,
  Claim,
  ClaimStatus,
  FlaggedPost,
  FoundItem,
  LostReport,
  Match,
  Message,
  Notification,
  Profile,
  Role,
  FlagReason,
  Place,
} from "./types";
import { ON_SHELF } from "./types";
import { todayIso } from "../lib/format";
import { supabase } from "../lib/supabase";

// Reference lists and office settings. Pages read them from here, never from mock.ts, so this
// stays the one swap point when they move to the database.
export { CATEGORIES, LOCATIONS, OFFICE } from "./mock";

/** Dropdown options for a record: an archived category or location it already uses stays selectable. */
export const withCurrent = (list: string[], value: string) => (value && !list.includes(value) ? [...list, value] : list);

/** The Worker checks this token on every /api call. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  return token ? { authorization: `Bearer ${token}` } : {};
}

// ---- tiny change-notification store so pages re-render after a write -------------
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
export function useDataVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

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
const nowIso = () => new Date().toISOString();

/** Strip admin-only fields before anything reaches a student page. */
const toPublic = ({ privateDetails: _p, loggedBy: _l, shelfTag: _s, ...item }: FoundItem): FoundItem => item;

// ---- people ------------------------------------------------------------------------
export const getProfile = (id: string) => db.profiles.find((p) => p.id === id);
export const findProfileByEmail = (email: string) =>
  db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());

// ---- found items (logged by the office) -------------------------------------------
export interface ItemFilters {
  q?: string;
  category?: string;
  location?: string;
  since?: string;
}

export function listFoundItems(f: ItemFilters = {}): Promise<FoundItem[]> {
  const q = f.q?.trim().toLowerCase();
  const items = db.foundItems
    .filter((i) => ON_SHELF.includes(i.status))
    .filter((i) => !f.category || i.category === f.category)
    .filter((i) => !f.location || i.location === f.location)
    .filter((i) => !f.since || i.foundOn >= f.since)
    .filter((i) => !q || `${i.title} ${i.description} ${i.category} ${i.location}`.toLowerCase().includes(q))
    .sort((a, b) => b.foundOn.localeCompare(a.foundOn));
  return delay(items.map(toPublic));
}

export async function getFoundItem(id: string, opts: { admin?: boolean } = {}) {
  const item = db.foundItems.find((i) => i.id === id);
  return delay(item ? (opts.admin ? item : toPublic(item)) : null);
}

export async function logFoundItem(input: Omit<FoundItem, "id" | "status">) {
  const next = Math.max(...db.foundItems.map((i) => Number(i.id.slice(3)))) + 1;
  const item: FoundItem = { ...input, id: `BG-${next}`, status: "in_custody" };
  db.foundItems.unshift(item);
  record("logged", `logged ${item.id}`, item.title, `/admin/items/${item.id}`);
  emit();
  return delay(item);
}

/** Office inventory: every found item, admin fields included, newest first. */
export const listAllFoundItems = () => delay([...db.foundItems].sort((a, b) => b.foundOn.localeCompare(a.foundOn)));

export type FoundItemPatch = Partial<
  Pick<FoundItem, "title" | "category" | "location" | "locationDetail" | "foundOn" | "description" | "privateDetails" | "photo" | "shelfTag">
>;
export async function updateFoundItem(id: string, patch: FoundItemPatch) {
  const item = db.foundItems.find((i) => i.id === id);
  if (!item) throw new Error("Item not found.");
  Object.assign(item, patch);
  record("edited", `edited ${item.id}`, item.title, `/admin/items/${item.id}`);
  emit();
  return delay(item);
}

// ---- holding period -------------------------------------------------------------------
const DAY = 86_400_000;
const isoDay = (iso: string) => new Date(`${iso}T00:00:00+08:00`).getTime();
/** Whole days the office has held this item (until today, or until it left). */
export function daysHeld(item: FoundItem) {
  const end = item.returnedOn ? isoDay(item.returnedOn) : item.disposal ? new Date(item.disposal.at).getTime() : isoDay(todayIso());
  return Math.max(0, Math.round((end - isoDay(item.foundOn)) / DAY));
}
/** Last day of the holding period, counting any extension. */
export function holdEnds(item: FoundItem) {
  if (item.holdUntil) return item.holdUntil;
  return new Date(isoDay(item.foundOn) + db.OFFICE.holdingDays * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
const hasOpenClaim = (itemId: string) =>
  db.claims.some((c) => c.itemId === itemId && ["pending", "needs_info", "approved"].includes(c.status));
/** In custody, past the holding period, and nobody is claiming it. */
export const isUnclaimed = (item: FoundItem) => item.status === "in_custody" && holdEnds(item) < todayIso() && !hasOpenClaim(item.id);

export const listUnclaimed = () => delay(db.foundItems.filter(isUnclaimed).sort((a, b) => a.foundOn.localeCompare(b.foundOn)));
export const listDisposed = () =>
  delay(db.foundItems.filter((i) => i.disposal).sort((a, b) => b.disposal!.at.localeCompare(a.disposal!.at)));

export async function disposeItem(id: string, method: "donated" | "disposed", note: string) {
  const item = db.foundItems.find((i) => i.id === id);
  if (!item) throw new Error("Item not found.");
  if (!isUnclaimed(item)) throw new Error("This item has an open claim or is still within its holding period.");
  item.status = method;
  item.disposal = { method, note, by: actor, at: new Date().toISOString() };
  record(method, `${method === "donated" ? "donated" : "disposed of"} ${item.id}`, item.title, `/admin/items/${item.id}`);
  emit();
  return delay(item);
}

export async function extendHold(id: string, days: number) {
  const item = db.foundItems.find((i) => i.id === id);
  if (!item) throw new Error("Item not found.");
  item.holdUntil = new Date(isoDay(todayIso()) + days * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  record("extended", `kept ${item.id} for ${days} more days`, item.title, `/admin/items/${item.id}`);
  emit();
  return delay(item);
}

// ---- lost reports (posted by students, live immediately) --------------------------
export const listPublicLostReports = () =>
  delay(db.lostReports.filter((r) => r.status === "active").map(({ privateDetails: _p, ...r }) => r));

export const listMyReports = (userId: string) => delay(db.lostReports.filter((r) => r.ownerId === userId));

/** Lost report as other students see it: no private details, no owner identity. */
export async function getPublicLostReport(id: string, viewerId?: string) {
  const r = db.lostReports.find((x) => x.id === id && x.status === "active");
  if (!r) return delay(null);
  const { privateDetails: _p, ownerId, ...pub } = r;
  return delay({ ...pub, mine: ownerId === viewerId });
}

/** Office view of every lost report, with the owner's name and email. */
export const listAllLostReports = () =>
  delay(
    [...db.lostReports]
      .sort((a, b) => b.lostOn.localeCompare(a.lostOn))
      .map((r) => ({ ...r, owner: getProfile(r.ownerId), flags: db.flaggedPosts.filter((f) => f.reportId === r.id).length })),
  );

export const getReport = (id: string) => delay(db.lostReports.find((r) => r.id === id) ?? null);

export async function createReport(
  userId: string,
  input: Pick<LostReport, "title" | "category" | "location" | "lostOn" | "description" | "privateDetails"> & { photo?: string },
) {
  const next = Math.max(...db.lostReports.map((r) => Number(r.id.slice(3)))) + 1;
  const report: LostReport = { ...input, id: `LR-${next}`, ownerId: userId, status: "active", matchCount: 0 };
  db.lostReports.unshift(report);
  emit();
  // The Worker queues AI extraction + matching for the new report; results arrive as a notification.
  authHeaders()
    .then((h) => fetch(`/api/reports/${report.id}/match`, { method: "POST", headers: h }))
    .catch(() => undefined);
  return delay(report);
}

export async function updateReport(id: string, patch: Partial<Pick<LostReport, "title" | "category" | "location" | "lostOn" | "description" | "privateDetails" | "photo">>) {
  const r = db.lostReports.find((x) => x.id === id);
  if (!r) throw new Error("Report not found.");
  Object.assign(r, patch);
  // An edited hidden report goes back to the office for another look; it is not re-published automatically.
  if (r.status === "hidden") r.statusNote = "Edited. Waiting for the office to review it again.";
  emit();
  return delay(r);
}

export async function setReportStatus(id: string, status: LostReport["status"]) {
  const r = db.lostReports.find((x) => x.id === id);
  if (r) {
    r.status = status;
    r.statusNote = status === "resolved" ? "You marked this item as found." : undefined;
  }
  emit();
  return delay(r);
}

export async function getMatches(reportId: string): Promise<Match[]> {
  try {
    const res = await fetch(`/api/reports/${reportId}/matches`, { headers: await authHeaders() });
    if (res.ok) return ((await res.json()) as { matches: Match[] }).matches;
  } catch {
    /* fall back to sample matches */
  }
  const seeds = db.matchesByReport[reportId] ?? [];
  const matches: Match[] = seeds.flatMap((s) => {
    const item = db.foundItems.find((i) => i.id === s.itemId);
    return item ? [{ rank: s.rank, likelihood: s.likelihood, why: s.why, but: s.but, item: toPublic(item) }] : [];
  });
  return delay(matches);
}

// ---- claims --------------------------------------------------------------------------
export const listMyClaims = (userId: string) =>
  delay(db.claims.filter((c) => c.claimantId === userId).sort((a, b) => b.filedOn.localeCompare(a.filedOn)));

export const listAllClaims = () => delay([...db.claims].sort((a, b) => b.filedOn.localeCompare(a.filedOn)));

export const getClaim = (id: string) => delay(db.claims.find((c) => c.id === id) ?? null);

export const otherOpenClaims = (claim: Claim) =>
  db.claims.filter((c) => c.itemId === claim.itemId && c.id !== claim.id && (c.status === "pending" || c.status === "needs_info"));

/** Synchronous lookup of the item behind a claim, admin fields included. */
/** Office view: every claim filed on one found item, newest first. */
export const listClaimsForItem = (itemId: string) =>
  delay(db.claims.filter((c) => c.itemId === itemId).sort((a, b) => b.filedOn.localeCompare(a.filedOn)));

export const itemFor = (itemId: string) => db.foundItems.find((i) => i.id === itemId);

export async function createClaim(userId: string, itemId: string, answers: string[], questions: string[]) {
  const existing = db.claims.filter((c) => c.itemId === itemId && c.claimantId === userId);
  if (existing.length >= 2) throw new Error("You've used both claim attempts for this item.");
  const next = Math.max(...db.claims.map((c) => Number(c.id.slice(3)))) + 1;
  const at = nowIso();
  const claim: Claim = {
    id: `CL-${next}`,
    itemId,
    claimantId: userId,
    status: "pending",
    filedOn: at,
    answers: answers.map((answer, i) => ({ question: questions[i], answer })),
    history: [{ status: "submitted", at }],
  };
  db.claims.unshift(claim);
  const item = db.foundItems.find((i) => i.id === itemId);
  if (item && item.status === "in_custody") item.status = "claim_pending";
  emit();
  return delay(claim);
}

function setClaimStatus(claim: Claim, status: ClaimStatus) {
  claim.status = status;
  claim.history.push({ status, at: nowIso() });
}

export async function withdrawClaim(id: string) {
  const c = db.claims.find((x) => x.id === id);
  if (c) setClaimStatus(c, "withdrawn");
  emit();
  return delay(c);
}

/** Admin decision. In production this is one database function that checks the transition. */
export async function decideClaim(id: string, decision: "approve" | "reject" | "request_info", reason?: string) {
  const c = db.claims.find((x) => x.id === id);
  if (!c) throw new Error("Claim not found.");
  const subject = db.foundItems.find((i) => i.id === c.itemId)?.title;
  record(
    decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "asked",
    decision === "approve" ? `approved claim ${c.id}` : decision === "reject" ? `rejected claim ${c.id}` : `asked for more details on claim ${c.id}`,
    subject,
    `/admin/claims/${c.id}`,
  );
  if (decision === "approve") {
    setClaimStatus(c, "approved");
    const pickup = new Date();
    pickup.setDate(pickup.getDate() + db.OFFICE.pickupDays + 2);
    c.pickupBy = pickup.toLocaleDateString("en-CA");
    const item = db.foundItems.find((i) => i.id === c.itemId);
    if (item) item.status = "ready_for_pickup";
    // Approving one claim closes the other open claims on the same item.
    for (const other of otherOpenClaims(c)) {
      other.decisionReason = "Another claim for this item was approved.";
      setClaimStatus(other, "rejected");
    }
  } else if (decision === "reject") {
    c.decisionReason = reason;
    setClaimStatus(c, "rejected");
  } else {
    setClaimStatus(c, "needs_info");
    if (reason) db.messages.push({ id: crypto.randomUUID(), claimId: id, from: "office", body: reason, at: nowIso() });
  }
  emit();
  return delay(c);
}

export async function confirmRelease(claimId: string) {
  const c = db.claims.find((x) => x.id === claimId);
  if (!c) throw new Error("Claim not found.");
  setClaimStatus(c, "completed");
  const item = db.foundItems.find((i) => i.id === c.itemId);
  if (item) {
    item.status = "returned";
    item.returnedOn = todayIso();
    record("released", `released ${item.id} to ${getProfile(c.claimantId)?.fullName ?? "the claimant"}`, item.title, `/admin/items/${item.id}`);
  }
  const report = c.linkedReportId && db.lostReports.find((r) => r.id === c.linkedReportId);
  if (report) report.status = "resolved";
  emit();
  return delay(c);
}

export async function returnToCustody(claimId: string) {
  const c = db.claims.find((x) => x.id === claimId);
  if (!c) throw new Error("Claim not found.");
  setClaimStatus(c, "expired");
  const item = db.foundItems.find((i) => i.id === c.itemId);
  if (item) {
    item.status = "in_custody";
    record("returned_to_custody", `put ${item.id} back on the shelf (claim ${c.id} not picked up)`, item.title, `/admin/items/${item.id}`);
  }
  emit();
  return delay(c);
}

// ---- messages (claim-scoped only) --------------------------------------------------
export const listMessages = (claimId: string) =>
  delay(db.messages.filter((m) => m.claimId === claimId).sort((a, b) => a.at.localeCompare(b.at)));

export async function sendMessage(claimId: string, from: Message["from"], body: string) {
  const m: Message = { id: crypto.randomUUID(), claimId, from, body, at: nowIso() };
  db.messages.push(m);
  const c = db.claims.find((x) => x.id === claimId);
  if (c && from === "office" && c.status === "pending") setClaimStatus(c, "needs_info");
  if (c && from === "owner" && c.status === "needs_info") setClaimStatus(c, "pending");
  emit();
  return delay(m);
}

export interface Thread {
  claim: Claim;
  itemTitle: string;
  photo?: string;
  last: Message;
  count: number;
  /**
   * This viewer owes a reply: for students, the office asked a question (claim is "needs info");
   * for the office, the claimant answered and the claim is back to "pending".
   */
  awaitingYou: boolean;
  /** Office view only: claimant's name. Students only ever see "Office". */
  claimantName?: string;
}

/** Claim conversations for the Messages tab. Students see their own claims; office staff see all. */
export function listThreads(viewer: "owner" | "office", userId?: string): Promise<Thread[]> {
  const out: Thread[] = [];
  for (const claim of db.claims) {
    if (viewer === "owner" && claim.claimantId !== userId) continue;
    const msgs = db.messages.filter((m) => m.claimId === claim.id).sort((a, b) => a.at.localeCompare(b.at));
    if (!msgs.length) continue;
    const item = db.foundItems.find((i) => i.id === claim.itemId);
    const last = msgs[msgs.length - 1];
    out.push({
      claim,
      itemTitle: item?.title ?? claim.itemId,
      photo: item?.photo,
      last,
      count: msgs.length,
      awaitingYou: last.from !== viewer && (viewer === "owner" ? claim.status === "needs_info" : claim.status === "pending"),
      claimantName: viewer === "office" ? getProfile(claim.claimantId)?.fullName : undefined,
    });
  }
  return delay(out.sort((a, b) => b.last.at.localeCompare(a.last.at)));
}

// ---- notifications (separate lists for students and office staff) -------------------
const inbox = (who: "student" | "office") => (who === "office" ? db.adminNotifications : db.notifications);
export const listNotifications = (who: "student" | "office" = "student") => delay([...inbox(who)]);
export const unreadCount = (who: "student" | "office" = "student") => inbox(who).filter((n) => !n.read).length;
export async function markNotificationsRead(ids?: string[], who: "student" | "office" = "student") {
  inbox(who).forEach((n: Notification) => {
    if (!ids || ids.includes(n.id)) n.read = true;
  });
  emit();
  return delay(true);
}

// ---- profile summary ------------------------------------------------------------------
export function profileStats(user: Profile) {
  if (user.role === "student") {
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

// ---- moderation ----------------------------------------------------------------------
export const listFlaggedPosts = () => delay([...db.flaggedPosts]);
export async function setFlaggedVisible(id: string, visible: boolean) {
  const f = db.flaggedPosts.find((x: FlaggedPost) => x.id === id);
  if (f) {
    f.visible = visible;
    const r = db.lostReports.find((x) => x.id === f.reportId);
    if (r) {
      r.status = visible ? "active" : "hidden";
      record(visible ? "unhid" : "hid", `${visible ? "made visible" : "hid"} lost report ${r.id}`, r.title, `/admin/lost/${r.id}`);
    }
  }
  emit();
  return delay(f);
}

const FLAG_TEXT: Record<FlagReason, string> = {
  contact: "Shows personal contact details",
  fake: "Fake, spam or a joke post",
  offensive: "Offensive or inappropriate",
  other: "Something else",
};
/** A student reports a lost report. The post stays visible until the office decides. */
export async function flagReport(reportId: string, reporterId: string, reason: FlagReason, note?: string) {
  const r = db.lostReports.find((x) => x.id === reportId);
  if (!r) throw new Error("This post isn't available anymore.");
  if (r.ownerId === reporterId) throw new Error("You can't report your own post.");
  if (db.flaggedPosts.some((f) => f.reportId === reportId && f.reporterId === reporterId))
    throw new Error("You already reported this post. The office will review it.");
  const email = getProfile(reporterId)?.email ?? "";
  const next = Math.max(...db.flaggedPosts.map((f) => Number(f.id.slice(3)))) + 1;
  db.flaggedPosts.unshift({
    id: `FP-${next}`,
    reportId,
    title: r.title,
    reporterLabel: email ? `${email[0]}•••@${email.split("@")[1]}` : "a student",
    reporterId,
    reason: FLAG_TEXT[reason],
    note: note?.trim() || undefined,
    visible: true,
    reportedAt: new Date().toISOString(),
  });
  db.adminNotifications.unshift({
    id: crypto.randomUUID(),
    kind: "flagged",
    title: "A lost report was flagged",
    detail: `${r.title} · ${FLAG_TEXT[reason].toLowerCase()}`,
    at: new Date().toISOString(),
    read: false,
    href: "/admin/flagged",
  });
  emit();
  return delay(true, 300);
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
  if (n !== from && [...live, ...archived].some((x) => x.toLowerCase() === n.toLowerCase())) throw new Error(`That ${label(k)} already exists.`);
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
  const earliest = db.foundItems.reduce((m, i) => (i.foundOn < m ? i.foundOn : m), to);
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
export const listAdmins = () => delay(db.profiles.filter((p) => p.role !== "student"));
export async function inviteAdmin(fullName: string, email: string, role: Exclude<Role, "student">) {
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
    unclaimed: db.foundItems.filter(isUnclaimed).length,
    // Same rule as the Claim Queue "Needs action" tab: waiting on a decision, a reply, or a release.
    claimsToAct: db.claims.filter((c) => c.status === "pending" || c.status === "needs_info" || c.status === "approved").length,
    flagged: db.flaggedPosts.filter((f) => f.visible).length,
  };
}

export { todayIso };
