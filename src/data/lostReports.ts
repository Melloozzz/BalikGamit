// Lost reports: posted by students, visible to every signed-in user while active and not
// hidden (proposal: "public listing"). The owner's private details live in
// lost_report_private, readable only by the owner and office staff.
import { supabase } from "../lib/supabase";
import type { FlaggedPost, FlagReason, LostReport, LostReportStatus, Match } from "./types";
import { OFFICE, categoryId, categoryName, locationId, locationName } from "./reference";
import { idOf, keyColumn, must, one, remember } from "./db";
import { removePhotos, signedUrls, uploadPhoto } from "./photos";
import { toFoundItems } from "./foundItems";
import { emit } from "./events";
import { kickMatching } from "./worker";

const PUBLIC_COLS = "id, ref, reporter_id, title, description, date_lost, status, is_hidden, photo_paths, category_id, location_id";
const OWNER_COLS = `${PUBLIC_COLS}, status_note, created_at, lost_report_private(private_details), match_suggestions(count)`;
const OFFICE_COLS = `${OWNER_COLS}, owner:profiles!lost_reports_reporter_id_fkey(full_name, email)`;

interface Row {
  id: string;
  ref: string;
  reporter_id: string;
  title: string;
  description: string;
  date_lost: string;
  status: "active" | "resolved" | "closed" | "expired";
  is_hidden: boolean;
  photo_paths: string[];
  category_id: number;
  location_id: number | null;
  status_note?: string | null;
  created_at?: string;
  lost_report_private?: { private_details: string } | { private_details: string }[] | null;
  match_suggestions?: { count: number }[];
  owner?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

export type OfficeLostReport = LostReport & { owner?: { fullName: string; email: string }; flags: number };

/** The app shows a hidden report as status "hidden"; the database keeps its status and an is_hidden flag. */
const appStatus = (r: Row): LostReportStatus => (r.is_hidden ? "hidden" : r.status);

function defaultNote(r: Row): string | undefined {
  if (r.status_note) return r.status_note;
  if (r.is_hidden) return "Hidden by the office. Edit the report to fix it.";
  if (r.status === "expired") return `This report expired after ${OFFICE.reportExpiryDays} days. Renew it if you're still looking.`;
  return undefined;
}

export async function toReports(rows: Row[], withPrivate: boolean): Promise<LostReport[]> {
  const urls = await signedUrls("lost-photos", rows.map((r) => r.photo_paths?.[0]).filter(Boolean));
  return rows.map((r) => {
    remember(r.ref, r.id);
    const report: LostReport = {
      id: r.ref,
      ownerId: r.reporter_id,
      title: r.title,
      category: categoryName(r.category_id),
      location: locationName(r.location_id),
      lostOn: r.date_lost,
      description: r.description,
      photo: r.photo_paths?.[0] ? urls.get(r.photo_paths[0]) : undefined,
      status: appStatus(r),
      matchCount: r.match_suggestions?.[0]?.count ?? 0,
    };
    if (!withPrivate) return report;
    return { ...report, privateDetails: one(r.lost_report_private)?.private_details || undefined, statusNote: defaultNote(r) };
  });
}

// ---- public listing ---------------------------------------------------------------------
export async function listPublicLostReports(): Promise<LostReport[]> {
  const rows = must(
    await supabase.from("lost_reports").select(PUBLIC_COLS).eq("status", "active").eq("is_hidden", false).order("date_lost", { ascending: false }),
  ) as Row[];
  return toReports(rows, false);
}

/** Lost report as other students see it: no private details, no owner identity. */
export async function getPublicLostReport(ref: string, viewerId?: string): Promise<(Omit<LostReport, "ownerId"> & { mine: boolean }) | null> {
  const row = must(await supabase.from("lost_reports").select(PUBLIC_COLS).eq("ref", ref).eq("status", "active").eq("is_hidden", false).maybeSingle()) as Row | null;
  if (!row) return null;
  const { ownerId, ...pub } = (await toReports([row], false))[0];
  return { ...pub, mine: ownerId === viewerId };
}

// ---- the owner's own reports ------------------------------------------------------------
export async function listMyReports(userId: string): Promise<LostReport[]> {
  const rows = must(await supabase.from("lost_reports").select(OWNER_COLS).eq("reporter_id", userId).order("created_at", { ascending: false })) as Row[];
  return toReports(rows, true);
}

/** One of the student's own reports, or null (also for someone else's, so ownership isn't revealed). */
export async function getMyReport(userId: string, ref: string): Promise<LostReport | null> {
  const row = must(await supabase.from("lost_reports").select(OWNER_COLS).eq(keyColumn(ref), ref).eq("reporter_id", userId).maybeSingle()) as Row | null;
  return row ? (await toReports([row], true))[0] : null;
}

export interface ReportInput {
  title: string;
  category: string;
  location: string;
  lostOn: string;
  description: string;
  privateDetails: string;
  photoFile?: File;
}

/** Posts a report. The database queues AI attribute extraction and matching for it. */
export async function createReport(userId: string, input: ReportInput): Promise<LostReport> {
  const photo = input.photoFile ? await uploadPhoto("lost-photos", input.photoFile, userId) : null;
  const row = must(
    await supabase
      .from("lost_reports")
      .insert({
        title: input.title,
        description: input.description,
        category_id: categoryId(input.category),
        location_id: locationId(input.location),
        date_lost: input.lostOn,
        photo_paths: photo ? [photo] : [],
      })
      .select("id, ref")
      .single(),
  ) as { id: string; ref: string };
  remember(row.ref, row.id);
  must(await supabase.from("lost_report_private").insert({ lost_report_id: row.id, private_details: input.privateDetails }));
  emit();
  kickMatching();
  return (await getMyReport(userId, row.ref))!;
}

/**
 * The owner edits an active report (also while it is hidden; the database then marks it
 * for the office to review again). Row-level security rejects anyone else's report.
 */
export async function updateReport(userId: string, ref: string, patch: Partial<ReportInput>): Promise<LostReport> {
  const current = await getMyReport(userId, ref);
  // Same message for "missing" and "someone else's", so the check doesn't reveal which reports exist.
  if (!current) throw new Error("Report not found.");
  const id = await idOf("lost_reports", ref);
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.category !== undefined) values.category_id = categoryId(patch.category);
  if (patch.location !== undefined) values.location_id = locationId(patch.location);
  if (patch.lostOn !== undefined) values.date_lost = patch.lostOn;
  let oldPhotos: string[] = [];
  if (patch.photoFile) {
    const row = must(await supabase.from("lost_reports").select("photo_paths").eq("id", id).single()) as { photo_paths: string[] };
    oldPhotos = row.photo_paths;
    values.photo_paths = [await uploadPhoto("lost-photos", patch.photoFile, userId)];
  }
  if (Object.keys(values).length) {
    const updated = must(await supabase.from("lost_reports").update(values).eq("id", id).select("id")) as unknown[];
    if (!updated.length) throw new Error("This report can't be edited anymore. Only active reports can be changed.");
  }
  if (patch.privateDetails !== undefined) {
    const updated = must(await supabase.from("lost_report_private").update({ private_details: patch.privateDetails }).eq("lost_report_id", id).select("lost_report_id")) as unknown[];
    if (!updated.length) must(await supabase.from("lost_report_private").insert({ lost_report_id: id, private_details: patch.privateDetails }));
  }
  await removePhotos("lost-photos", oldPhotos);
  emit();
  return (await getMyReport(userId, ref))!;
}

/**
 * Status changes. Owners: "resolved" or "closed", or "active" to renew an expired report.
 * Office: "hidden" hides it from students, "active" on a hidden report shows it again.
 */
export async function setReportStatus(ref: string, status: LostReportStatus, reason?: string) {
  const id = await idOf("lost_reports", ref);
  if (status === "hidden") {
    must(await supabase.rpc("admin_set_hidden", { p_entity: "lost_report", p_id: id, p_hidden: true, p_reason: reason ?? null }));
  } else {
    const row = must(await supabase.from("lost_reports").select("status, is_hidden").eq("id", id).single()) as { status: string; is_hidden: boolean };
    if (status === "active" && row.is_hidden) {
      must(await supabase.rpc("admin_set_hidden", { p_entity: "lost_report", p_id: id, p_hidden: false }));
    } else {
      must(await supabase.rpc("set_lost_report_status", { p_id: id, p_new: status }));
    }
  }
  emit();
}

// ---- matches ----------------------------------------------------------------------------
/** AI-ranked possible matches for a report (owner and office only). */
export async function getMatches(ref: string): Promise<Match[]> {
  const id = await idOf("lost_reports", ref).catch(() => null);
  if (!id) return [];
  const rows = must(
    await supabase
      .from("match_suggestions")
      .select("rank, likelihood, explanation, found_items(id, ref, title, description, date_found, status, photo_paths, category_id, location_id, location_detail)")
      .eq("lost_report_id", id)
      .order("rank"),
  ) as { rank: number; likelihood: Match["likelihood"]; explanation: string; found_items: unknown }[];
  const withItems = rows.filter((r) => one(r.found_items as object | object[] | null));
  const items = await toFoundItems(withItems.map((r) => one(r.found_items as never)) as never[], false);
  // The Worker stores "why" and an optional "But: ..." on a second line.
  return withItems.map((r, i) => {
    const [why, but] = r.explanation.split("\nBut: ");
    return { rank: r.rank, likelihood: r.likelihood, why, but: but || undefined, item: items[i] };
  });
}

// ---- office -----------------------------------------------------------------------------
async function openFlagsByReport(): Promise<Map<string, number>> {
  const rows = must(await supabase.from("flags").select("target_id").eq("target_type", "lost_report").eq("status", "open")) as { target_id: string }[];
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.target_id, (m.get(r.target_id) ?? 0) + 1);
  return m;
}

/** Office view of every lost report, with the owner's name and email and open flags. */
export async function listAllLostReports(): Promise<OfficeLostReport[]> {
  const [rows, flags] = await Promise.all([
    supabase.from("lost_reports").select(OFFICE_COLS).order("date_lost", { ascending: false }).then((r) => must(r) as Row[]),
    openFlagsByReport(),
  ]);
  const reports = await toReports(rows, true);
  return reports.map((rep, i) => {
    const o = one(rows[i].owner);
    return { ...rep, owner: o ? { fullName: o.full_name, email: o.email } : undefined, flags: flags.get(rows[i].id) ?? 0 };
  });
}

/** Office: any report, private details and owner included. */
export async function getReport(ref: string): Promise<OfficeLostReport | null> {
  const row = must(await supabase.from("lost_reports").select(OFFICE_COLS).eq(keyColumn(ref), ref).maybeSingle()) as Row | null;
  if (!row) return null;
  const [rep] = await toReports([row], true);
  const o = one(row.owner);
  return { ...rep, owner: o ? { fullName: o.full_name, email: o.email } : undefined, flags: 0 };
}

/** Reports with open flags that are still visible: the number on the office notice bars. */
export async function countFlaggedReports(): Promise<number> {
  const flags = await openFlagsByReport();
  if (!flags.size) return 0;
  const visible = must(await supabase.from("lost_reports").select("id").in("id", [...flags.keys()]).eq("is_hidden", false)) as unknown[];
  return visible.length;
}

// ---- moderation -------------------------------------------------------------------------
const FLAG_TEXT: Record<FlagReason, string> = {
  contact: "Shows personal contact details",
  fake: "Fake, spam or a joke post",
  offensive: "Offensive or inappropriate",
  other: "Something else",
};

/** A student reports another student's post. The post stays visible until the office decides. */
export async function flagReport(reportRef: string, reporterId: string, reason: FlagReason, note?: string) {
  const report = must(await supabase.from("lost_reports").select("id, reporter_id").eq("ref", reportRef).maybeSingle()) as { id: string; reporter_id: string } | null;
  if (!report) throw new Error("This post isn't available anymore.");
  if (report.reporter_id === reporterId) throw new Error("You can't report your own post.");
  const res = await supabase.from("flags").insert({ target_type: "lost_report", target_id: report.id, reason: FLAG_TEXT[reason], note: note?.trim() || null });
  if (res.error?.code === "23505") throw new Error("You already reported this post. The office will review it.");
  must(res);
  emit();
  return true;
}

const mask = (email?: string) => (email ? `${email[0]}•••@${email.split("@")[1]}` : "a student");

/** Every flag on a lost report, newest first, with whether the report is still visible. */
export async function listFlaggedPosts(): Promise<FlaggedPost[]> {
  const flags = must(
    await supabase
      .from("flags")
      .select("id, target_id, reason, note, created_at, flagged_by, flagger:profiles!flags_flagged_by_fkey(email)")
      .eq("target_type", "lost_report")
      .order("created_at", { ascending: false }),
  ) as { id: number; target_id: string; reason: string; note: string | null; created_at: string; flagged_by: string; flagger: unknown }[];
  if (!flags.length) return [];
  const reports = must(await supabase.from("lost_reports").select("id, ref, title, is_hidden").in("id", [...new Set(flags.map((f) => f.target_id))])) as {
    id: string;
    ref: string;
    title: string;
    is_hidden: boolean;
  }[];
  const byId = new Map(reports.map((r) => [r.id, r]));
  return flags.flatMap((f) => {
    const r = byId.get(f.target_id);
    if (!r) return [];
    remember(r.ref, r.id);
    return [
      {
        id: String(f.id),
        reportId: r.ref,
        title: r.title,
        reporterLabel: mask(one(f.flagger as { email: string } | null)?.email),
        reporterId: f.flagged_by,
        reason: f.reason,
        note: f.note ?? undefined,
        visible: !r.is_hidden,
        reportedAt: f.created_at,
      },
    ];
  });
}

/** Hide or restore the report behind a flag. The database resolves every open flag on that report. */
export async function setFlaggedVisible(flagId: string, visible: boolean) {
  const flag = must(await supabase.from("flags").select("target_id").eq("id", Number(flagId)).single()) as { target_id: string };
  must(await supabase.rpc("admin_set_hidden", { p_entity: "lost_report", p_id: flag.target_id, p_hidden: !visible }));
  emit();
}

