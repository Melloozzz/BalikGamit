// Data access layer. Every page reads and writes through these functions, so wiring
// the real backend means replacing the bodies here, not the pages:
//   - plain reads/writes  -> supabase.from(...) under row-level security
//   - status changes      -> supabase.rpc(...) database functions (they check allowed transitions)
//   - AI matching/search  -> fetch("/api/...") on the Cloudflare Worker
// In demo mode the functions work on the in-memory sample data in ./mock.ts.
import { useSyncExternalStore } from "react";
import * as db from "./mock";
import type {
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
} from "./types";
import { todayIso } from "../lib/format";
import { supabase } from "../lib/supabase";

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
    .filter((i) => i.status !== "returned")
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

/**
 * AI-powered search: the Worker sends the query and the public fields of up to 20
 * narrowed candidates to Groq and returns them ranked. Demo mode ranks by word overlap.
 */
export async function aiSearch(query: string): Promise<FoundItem[]> {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ query }),
    });
    if (res.ok) return ((await res.json()) as { items: FoundItem[] }).items;
  } catch {
    /* Worker not running: fall back to local ranking */
  }
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const scored = db.foundItems
    .filter((i) => i.status !== "returned")
    .map((i) => {
      const hay = `${i.title} ${i.description} ${i.category} ${i.location}`.toLowerCase();
      return { i, score: words.filter((w) => w.length > 2 && hay.includes(w)).length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return delay(scored.map((s) => toPublic(s.i)), 400);
}

export async function logFoundItem(input: Omit<FoundItem, "id" | "status">) {
  const next = Math.max(...db.foundItems.map((i) => Number(i.id.slice(3)))) + 1;
  const item: FoundItem = { ...input, id: `BG-${next}`, status: "in_custody" };
  db.foundItems.unshift(item);
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
  if (item) item.status = "returned";
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
  if (item) item.status = "in_custody";
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
    { label: "Items in custody", value: db.foundItems.filter((i) => i.status !== "returned").length },
  ];
}

// ---- moderation ----------------------------------------------------------------------
export const listFlaggedPosts = () => delay([...db.flaggedPosts]);
export async function setFlaggedVisible(id: string, visible: boolean) {
  const f = db.flaggedPosts.find((x: FlaggedPost) => x.id === id);
  if (f) {
    f.visible = visible;
    const r = db.lostReports.find((x) => x.id === f.reportId);
    if (r) r.status = visible ? "active" : "hidden";
  }
  emit();
  return delay(f);
}

// ---- admins (super admin only) ------------------------------------------------------
export const listAdmins = () => delay(db.profiles.filter((p) => p.role !== "student"));
export async function inviteAdmin(fullName: string, email: string, role: Exclude<Role, "student">) {
  if (findProfileByEmail(email)) throw new Error("That email already has an account.");
  const p: Profile = { id: crypto.randomUUID(), fullName, email, role, active: true };
  db.profiles.push(p);
  emit();
  return delay(p);
}
export async function setAdminActive(id: string, active: boolean) {
  const p = db.profiles.find((x) => x.id === id);
  if (p) p.active = active;
  emit();
  return delay(p);
}

// ---- dashboard ------------------------------------------------------------------------
export function dashboardCounts() {
  return {
    inCustody: db.foundItems.filter((i) => i.status !== "returned").length,
    // Same rule as the Claim Queue "Needs action" tab: waiting on a decision, a reply, or a release.
    claimsToAct: db.claims.filter((c) => c.status === "pending" || c.status === "needs_info" || c.status === "approved").length,
    flagged: db.flaggedPosts.filter((f) => f.visible).length,
  };
}

export { todayIso };
