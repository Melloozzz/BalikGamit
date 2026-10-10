// Office overview: dashboard counts, the Reports page, the activity log, and profile stats.
import { supabase } from "../lib/supabase";
import { todayIso } from "../lib/format";
import { ON_SHELF, isOfficeRole, type Activity, type FoundItem, type Profile } from "./types";
import { must, manilaDate, one } from "./db";
import { isUnclaimed, listAllFoundItems } from "./foundItems";
import { countFlaggedReports } from "./lostReports";

const OPEN_CLAIM = ["pending", "needs_info", "approved"];

// ---- dashboard ----------------------------------------------------------------------------
export interface DashboardCounts {
  inCustody: number;
  unclaimed: number;
  /** Same rule as the Claim Queue "Needs action" tab: waiting on a decision, a reply, or a release. */
  claimsToAct: number;
  /** Reports, not flags: two students flagging one post is still one post to review. */
  flagged: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [items, claims, flagged] = await Promise.all([
    listAllFoundItems(),
    supabase.from("claims").select("id", { count: "exact", head: true }).in("status", OPEN_CLAIM),
    countFlaggedReports(),
  ]);
  return {
    inCustody: items.filter((i) => ON_SHELF.includes(i.status)).length,
    unclaimed: items.filter(isUnclaimed).length,
    claimsToAct: claims.count ?? 0,
    flagged,
  };
}

// ---- reports -------------------------------------------------------------------------------
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

export interface ReportInput {
  items: FoundItem[];
  /** Dates lost reports were lost (YYYY-MM-DD). */
  lostOn: string[];
  /** Claim decisions with when they happened. */
  decisions: { status: "approved" | "rejected"; at: string }[];
}

const DAY = 86_400_000;
const isoDay = (iso: string) => new Date(`${iso}T00:00:00+08:00`).getTime();
const toIso = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** The Reports page numbers. `days` = how far back; omit for all time. Pure, so it is unit-tested. */
export function computeOfficeReport({ items, lostOn, decisions }: ReportInput, days?: number, today = todayIso()): OfficeReport {
  const to = today;
  // "All time" starts at the oldest record of any kind, so older lost reports and decisions count too.
  const dates = [...items.map((i) => i.foundOn), ...lostOn, ...decisions.map((d) => manilaDate(d.at))];
  const earliest = dates.reduce((m, d) => (d < m ? d : m), to);
  const from = days ? toIso(isoDay(to) - (days - 1) * DAY) : earliest;
  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const logged = items.filter((i) => inRange(i.foundOn));
  const returned = items.filter((i) => inRange(i.returnedOn));
  const spans = returned.map((i) => Math.round((isoDay(i.returnedOn!) - isoDay(i.foundOn)) / DAY)).sort((a, b) => a - b);
  const median = spans.length ? (spans.length % 2 ? spans[(spans.length - 1) / 2] : (spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2) : null;
  const decided = (st: "approved" | "rejected") => decisions.filter((d) => d.status === st && inRange(manilaDate(d.at))).length;
  // Weeks start on Monday.
  const dow = new Date(`${from}T12:00:00+08:00`).getUTCDay();
  const monday = isoDay(from) - ((dow + 6) % 7) * DAY;
  const weeks: OfficeReport["weeks"] = [];
  for (let t = monday; t <= isoDay(to); t += 7 * DAY) {
    const s = toIso(t);
    const e = toIso(t + 6 * DAY);
    const w = (d?: string) => !!d && d >= s && d <= e && inRange(d);
    weeks.push({ start: s, logged: items.filter((i) => w(i.foundOn)).length, returned: items.filter((i) => w(i.returnedOn)).length });
  }
  const top = (key: "category" | "location") => {
    const m = new Map<string, number>();
    for (const i of logged) if (i[key]) m.set(i[key], (m.get(i[key]) ?? 0) + 1);
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 5);
  };
  return {
    from,
    to,
    logged: logged.length,
    returned: returned.length,
    returnRate: logged.length ? Math.round((logged.filter((i) => i.status === "returned").length / logged.length) * 100) : null,
    medianDaysToReturn: median,
    lostReports: lostOn.filter((d) => inRange(d)).length,
    approved: decided("approved"),
    rejected: decided("rejected"),
    disposed: items.filter((i) => i.disposal && inRange(manilaDate(i.disposal.at))).length,
    weeks,
    topCategories: top("category"),
    topLocations: top("location"),
  };
}

export async function getOfficeReport(days?: number): Promise<OfficeReport> {
  const [items, lost, history] = await Promise.all([
    listAllFoundItems(),
    supabase.from("lost_reports").select("date_lost").then((r) => must(r) as { date_lost: string }[]),
    supabase
      .from("status_history")
      .select("new_status, created_at")
      .eq("entity_type", "claim")
      .in("new_status", ["approved", "rejected"])
      .then((r) => must(r) as { new_status: "approved" | "rejected"; created_at: string }[]),
  ]);
  return computeOfficeReport(
    { items, lostOn: lost.map((l) => l.date_lost), decisions: history.map((h) => ({ status: h.new_status, at: h.created_at })) },
    days,
  );
}

// ---- activity log ---------------------------------------------------------------------------
/** Office actions, newest first. Written only by database triggers, so entries can't be faked. */
export async function listActivity(): Promise<Activity[]> {
  const rows = must(
    await supabase
      .from("admin_activity")
      .select("id, kind, text, subject, href, created_at, actor:profiles!admin_activity_actor_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500),
  ) as { id: number; kind: Activity["kind"]; text: string; subject: string | null; href: string | null; created_at: string; actor: unknown }[];
  return rows.map((r) => ({
    id: String(r.id),
    at: r.created_at,
    actor: one(r.actor as { full_name: string } | null)?.full_name ?? "Office",
    kind: r.kind,
    text: r.text,
    subject: r.subject ?? undefined,
    href: r.href ?? undefined,
  }));
}

// ---- profile summary --------------------------------------------------------------------------
export async function getProfileStats(user: Profile): Promise<{ label: string; value: number }[]> {
  if (!isOfficeRole(user.role)) {
    const [reports, claims] = await Promise.all([
      supabase.from("lost_reports").select("status").eq("reporter_id", user.id).then((r) => must(r) as { status: string }[]),
      supabase.from("claims").select("status").eq("claimant_id", user.id).then((r) => must(r) as { status: string }[]),
    ]);
    return [
      { label: "Lost reports", value: reports.length },
      { label: "Claims filed", value: claims.length },
      { label: "Items recovered", value: claims.filter((c) => c.status === "completed").length + reports.filter((r) => r.status === "resolved").length },
    ];
  }
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [mine, toAct, custody] = await Promise.all([
    count(supabase.from("found_items").select("id", { count: "exact", head: true }).eq("logged_by", user.id)),
    count(supabase.from("claims").select("id", { count: "exact", head: true }).in("status", OPEN_CLAIM)),
    count(supabase.from("found_items").select("id", { count: "exact", head: true }).in("status", ON_SHELF)),
  ]);
  return [
    { label: "Items you logged", value: mine },
    { label: "Claims needing action", value: toAct },
    { label: "Items in custody", value: custody },
  ];
}
