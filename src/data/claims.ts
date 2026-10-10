// Claims, claim messages and notifications. Every status change goes through a database
// function (submit_claim, send_message, admin_decide_claim, ...) that checks the role and the
// allowed transitions and writes the history; the browser never writes a status itself.
import { supabase } from "../lib/supabase";
import type { ClaimStatus, LoadedClaim, Message, Notification } from "./types";
import { categoryId } from "./reference";
import { idOf, keyColumn, manilaDate, must, one, remember } from "./db";
import { PUBLIC_COLS as ITEM_COLS, getFoundItem, toFoundItems } from "./foundItems";
import { emit } from "./events";

const CLAIM_COLS = `id, ref, status, created_at, claimant_id, decision_reason, pickup_deadline, pickup_office,
  lost_report:lost_reports(ref),
  found_items(${ITEM_COLS}),
  claimant:profiles!claims_claimant_id_fkey(full_name, email)`;

interface Row {
  id: string;
  ref: string;
  status: ClaimStatus;
  created_at: string;
  claimant_id: string;
  decision_reason: string | null;
  pickup_deadline: string | null;
  pickup_office: string | null;
  lost_report: { ref: string } | { ref: string }[] | null;
  found_items: unknown;
  claimant: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  claim_answers?: { question_text: string; answer_text: string; id: number }[];
}

const OPEN: ClaimStatus[] = ["pending", "needs_info"];

/** Rows -> claims with their item, history, and (for office staff) the claimant. */
async function toClaims(rows: Row[], office: boolean): Promise<LoadedClaim[]> {
  // A claim whose item the reader can't see (hidden by the office) is left out rather than crashing the page.
  rows = rows.filter((r) => one(r.found_items as object | object[] | null));
  if (!rows.length) return [];
  const items = await toFoundItems(rows.map((r) => one(r.found_items as never)) as never[], false);
  const history = must(
    await supabase
      .from("status_history")
      .select("entity_id, old_status, new_status, created_at")
      .eq("entity_type", "claim")
      .in("entity_id", rows.map((r) => r.id))
      .order("created_at"),
  ) as { entity_id: string; old_status: string | null; new_status: string; created_at: string }[];
  return rows.map((r, i) => {
    remember(r.ref, r.id);
    const who = one(r.claimant);
    return {
      id: r.ref,
      itemId: items[i].id,
      item: items[i],
      claimantId: r.claimant_id,
      claimant: office && who ? { fullName: who.full_name, email: who.email } : undefined,
      status: r.status,
      filedOn: r.created_at,
      answers: (r.claim_answers ?? []).sort((a, b) => a.id - b.id).map((a) => ({ question: a.question_text, answer: a.answer_text })),
      linkedReportId: one(r.lost_report)?.ref,
      decisionReason: r.decision_reason ?? undefined,
      pickupBy: r.pickup_deadline ? manilaDate(r.pickup_deadline) : undefined,
      pickupOffice: r.pickup_office ?? undefined,
      history: history
        .filter((h) => h.entity_id === r.id)
        .map((h) => ({ status: (h.old_status === null ? "submitted" : h.new_status) as LoadedClaim["history"][number]["status"], at: h.created_at })),
    };
  });
}

// ---- reading claims ---------------------------------------------------------------------
export async function listMyClaims(userId: string): Promise<LoadedClaim[]> {
  const rows = must(await supabase.from("claims").select(CLAIM_COLS).eq("claimant_id", userId).order("created_at", { ascending: false })) as Row[];
  return toClaims(rows, false);
}

/** Office: every claim, newest first. */
export async function listAllClaims(): Promise<LoadedClaim[]> {
  const rows = must(await supabase.from("claims").select(CLAIM_COLS).order("created_at", { ascending: false })) as Row[];
  return toClaims(rows, true);
}

/** Office: every claim on one found item, newest first. */
export async function listClaimsForItem(itemRef: string): Promise<LoadedClaim[]> {
  const itemId = await idOf("found_items", itemRef).catch(() => null);
  if (!itemId) return [];
  const rows = must(await supabase.from("claims").select(CLAIM_COLS).eq("found_item_id", itemId).order("created_at", { ascending: false })) as Row[];
  return toClaims(rows, true);
}

/**
 * One claim with its answers. Students only ever get their own (row-level security); `office`
 * adds the claimant, the item's private intake details, and the other open claims on the item.
 */
export async function getClaim(ref: string, opts: { office?: boolean } = {}): Promise<LoadedClaim | null> {
  const row = must(
    await supabase.from("claims").select(`${CLAIM_COLS}, found_item_id, claim_answers(id, question_text, answer_text)`).eq(keyColumn(ref), ref).maybeSingle(),
  ) as (Row & { found_item_id: string }) | null;
  if (!row) return null;
  const [claim] = await toClaims([row], !!opts.office);
  if (!claim) return null;
  if (!opts.office) return claim;
  const [item, others] = await Promise.all([
    getFoundItem(claim.itemId, { admin: true }),
    supabase.from("claims").select("ref").eq("found_item_id", row.found_item_id).neq("id", row.id).in("status", OPEN).then((r) => must(r) as { ref: string }[]),
  ]);
  return { ...claim, item: item ?? claim.item, others: others.map((o) => o.ref) };
}

/** Only items the office still holds, and that aren't already promised to someone, can be claimed. */
export const isClaimable = (item: { status: string }) => item.status === "in_custody" || item.status === "claim_pending";

// ---- proof questions ------------------------------------------------------------------
/** Questions for a claim: the general ones plus the item category's own. */
export async function listProofQuestions(category: string): Promise<string[]> {
  let catId: number | null = null;
  try {
    catId = categoryId(category);
  } catch {
    /* archived or unknown category: general questions only */
  }
  const rows = must(
    await supabase
      .from("proof_questions")
      .select("id, question, category_id")
      .eq("is_active", true)
      .or(catId == null ? "category_id.is.null" : `category_id.is.null,category_id.eq.${catId}`)
      .order("id"),
  ) as { id: number; question: string; category_id: number | null }[];
  return rows.map((r) => r.question);
}

// ---- student actions -------------------------------------------------------------------
/** Files a claim. The database checks the item can be claimed and the per-person limits. */
export async function createClaim(itemRef: string, answers: string[], questions: string[], linkedReportRef?: string): Promise<LoadedClaim> {
  const id = must(
    await supabase.rpc("submit_claim", {
      p_found_item_id: await idOf("found_items", itemRef),
      p_lost_report_id: linkedReportRef ? await idOf("lost_reports", linkedReportRef) : null,
      p_answers: answers.map((answer, i) => ({ question: questions[i], answer })),
    }),
  ) as string;
  const row = must(await supabase.from("claims").select("ref").eq("id", id).single()) as { ref: string };
  remember(row.ref, id);
  emit();
  return (await getClaim(row.ref))!;
}

export async function withdrawClaim(ref: string) {
  must(await supabase.rpc("withdraw_claim", { p_claim_id: await idOf("claims", ref) }));
  emit();
}

// ---- office actions --------------------------------------------------------------------
/**
 * Approve, reject, or ask the claimant a question. Asking sends a message, which moves the claim
 * to "needs info"; approving closes the other open claims on the item (all in the database).
 */
export async function decideClaim(ref: string, decision: "approve" | "reject" | "request_info", reason?: string) {
  const id = await idOf("claims", ref);
  if (decision === "request_info") {
    if (!reason) throw new Error("Type the question you want to ask the claimant.");
    must(await supabase.rpc("send_message", { p_claim_id: id, p_body: reason }));
  } else {
    must(await supabase.rpc("admin_decide_claim", { p_claim_id: id, p_decision: decision, p_reason: reason ?? null }));
  }
  emit();
}

/** Handover done: claim completed, item returned, linked lost report resolved. */
export async function confirmRelease(ref: string) {
  must(await supabase.rpc("complete_handover", { p_claim_id: await idOf("claims", ref) }));
  emit();
}

/** The claimant didn't come: the claim expires and the item goes back on the shelf. */
export async function returnToCustody(ref: string) {
  must(await supabase.rpc("admin_return_to_custody", { p_claim_id: await idOf("claims", ref) }));
  emit();
}

// ---- messages ---------------------------------------------------------------------------
type MessageRow = { id: number; sender_alias: string; body: string; created_at: string };
const toMessage = (claimRef: string, m: MessageRow): Message => ({
  id: String(m.id),
  claimId: claimRef,
  from: m.sender_alias === "Office" ? "office" : "owner",
  body: m.body,
  at: m.created_at,
});

export async function listMessages(claimRef: string): Promise<Message[]> {
  const claimId = await idOf("claims", claimRef).catch(() => null);
  if (!claimId) return [];
  const thread = must(await supabase.from("claim_threads").select("claim_messages(id, sender_alias, body, created_at)").eq("claim_id", claimId).maybeSingle()) as {
    claim_messages: MessageRow[];
  } | null;
  return (thread?.claim_messages ?? []).map((m) => toMessage(claimRef, m)).sort((a, b) => a.at.localeCompare(b.at));
}

/** The database picks the alias (Owner / Office) from who is signed in, blocks contact details and rate-limits. */
export async function sendMessage(claimRef: string, body: string) {
  must(await supabase.rpc("send_message", { p_claim_id: await idOf("claims", claimRef), p_body: body }));
  emit();
}

/** Live updates for one claim's messages (Supabase Realtime, filtered by row-level security). */
export function subscribeToMessages(claimRef: string, onChange: () => void): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let stopped = false;
  (async () => {
    const claimId = await idOf("claims", claimRef).catch(() => null);
    if (!claimId || stopped) return;
    const thread = must(await supabase.from("claim_threads").select("id").eq("claim_id", claimId).maybeSingle()) as { id: string } | null;
    if (!thread || stopped) return;
    channel = supabase
      .channel(`thread-${thread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "claim_messages", filter: `thread_id=eq.${thread.id}` }, onChange)
      .subscribe();
  })();
  return () => {
    stopped = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export interface Thread {
  claim: LoadedClaim;
  itemTitle: string;
  photo?: string;
  last: Message;
  count: number;
  /** This viewer owes a reply: students when the office asked (needs info); office when the claimant answered (pending). */
  awaitingYou: boolean;
  /** Office view only: claimant's name. Students only ever see "Office". */
  claimantName?: string;
}

/** Claim conversations for the Messages tab. Students see their own claims; office staff see all. */
export async function listThreads(viewer: "owner" | "office", userId?: string): Promise<Thread[]> {
  let q = supabase.from("claims").select(`${CLAIM_COLS}, claim_threads(claim_messages(id, sender_alias, body, created_at))`);
  if (viewer === "owner" && userId) q = q.eq("claimant_id", userId);
  const rows = must(await q) as (Row & { claim_threads: { claim_messages: MessageRow[] } | { claim_messages: MessageRow[] }[] | null })[];
  const withMsgs = rows.filter((r) => one(r.claim_threads)?.claim_messages?.length);
  const claims = await toClaims(withMsgs, viewer === "office");
  // toClaims can leave rows out (hidden items), so pair by reference, not position.
  const rowByRef = new Map(withMsgs.map((r) => [r.ref, r]));
  return claims
    .map((claim) => {
      const msgs = one(rowByRef.get(claim.id)!.claim_threads)!.claim_messages.map((m) => toMessage(claim.id, m)).sort((a, b) => a.at.localeCompare(b.at));
      const last = msgs[msgs.length - 1];
      return {
        claim,
        itemTitle: claim.item.title,
        photo: claim.item.photo,
        last,
        count: msgs.length,
        awaitingYou: last.from !== viewer && (viewer === "owner" ? claim.status === "needs_info" : claim.status === "pending"),
        claimantName: claim.claimant?.fullName,
      };
    })
    .sort((a, b) => b.last.at.localeCompare(a.last.at));
}

// ---- notifications ------------------------------------------------------------------------
// Database types -> the app's notification kinds (which pick the icon and colour).
const KIND: Record<string, Notification["kind"]> = {
  claim_approved: "approved",
  item_returned: "approved",
  claim_rejected: "rejected",
  report_expired: "expiring",
  report_expiring: "expiring",
  pickup_expired: "expiring",
  pickup_reminder: "expiring",
  report_hidden: "hidden",
  matches: "matches",
  claim_submitted: "new_claim",
  claim_withdrawn: "new_claim",
  flagged: "flagged",
  report_edited: "flagged",
  pickup_due: "pickup_due",
};

function toNotification(n: { id: number; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }): Notification {
  const href = n.link ?? "/";
  const kind = n.type === "new_message" ? (href.startsWith("/admin") ? "reply" : "question") : (KIND[n.type] ?? "approved");
  return { id: String(n.id), kind, title: n.title, detail: n.body ?? "", at: n.created_at, read: n.is_read, href };
}

/**
 * The signed-in person's notifications, newest first. Office staff get office notifications
 * because the database addresses them to every admin; `who` only picks the page's wording.
 */
export async function listNotifications(_who: "student" | "office" = "student"): Promise<Notification[]> {
  const rows = must(
    await supabase.from("notifications").select("id, type, title, body, link, is_read, created_at").order("created_at", { ascending: false }).limit(100),
  ) as Parameters<typeof toNotification>[0][];
  return rows.map(toNotification);
}

export async function unreadCount(_who: "student" | "office" = "student"): Promise<number> {
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  return count ?? 0;
}

/** Marks some (or all) of the signed-in person's notifications as read. */
export async function markNotificationsRead(ids?: string[], _who: "student" | "office" = "student") {
  let q = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (ids) q = q.in("id", ids.map(Number));
  must(await q);
  emit();
}

/** Re-runs every loader when a notification arrives for the signed-in person. */
export function subscribeToNotifications(userId: string): () => void {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => emit())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

