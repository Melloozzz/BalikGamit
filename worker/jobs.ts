// The AI job queue (ai_jobs). The database queues "extract_attributes" whenever a lost report
// or found item is created or its text changes. Processing, per the proposal:
//   1. extract structured attributes from the public description (Groq);
//   2. the database prefilters up to 20 candidates (candidate_matches: date window, category,
//      location, attribute overlap);
//   3. Groq ranks those candidates; the result is saved to match_suggestions and the owner is
//      notified when a new likely match appears.
import { GroqRateLimited, extractAttributes, rankCandidates, type Candidate } from "./ai/groqClient";
import { rest, rpc, type Env } from "./supabase";

interface Job {
  id: number;
  job_type: "extract_attributes" | "rank_matches";
  target_type: "lost_report" | "found_item";
  target_id: string;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const ON_SHELF = ["in_custody", "claim_pending"];

type Names = { categories: Map<number, string>; locations: Map<number, string> };
async function names(env: Env): Promise<Names> {
  const [c, l] = await Promise.all([
    rest<{ id: number; name: string }[]>(env, "categories?select=id,name"),
    rest<{ id: number; name: string }[]>(env, "locations?select=id,name"),
  ]);
  return { categories: new Map(c.map((x) => [x.id, x.name])), locations: new Map(l.map((x) => [x.id, x.name])) };
}

/**
 * Queues ranking for these lost reports, skipping any that already have one queued or running.
 * Two requests however many reports there are (Workers allow a limited number of subrequests).
 */
async function enqueueRank(env: Env, lostReportIds: string[]) {
  const ids = [...new Set(lostReportIds)];
  if (!ids.length) return;
  const open = await rest<{ target_id: string }[]>(
    env,
    `ai_jobs?job_type=eq.rank_matches&target_id=in.(${ids.join(",")})&status=in.(queued,processing)&select=target_id`,
  );
  const busy = new Set(open.map((o) => o.target_id));
  const fresh = ids.filter((id) => !busy.has(id));
  if (!fresh.length) return;
  await rest(env, "ai_jobs", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(fresh.map((id) => ({ job_type: "rank_matches", target_type: "lost_report", target_id: id }))),
  }).catch(() => undefined); // one queued at the same moment by another run: the next change re-queues the rest
}

async function extract(env: Env, job: Job, n: Names) {
  const table = job.target_type === "lost_report" ? "lost_reports" : "found_items";
  const [row] = await rest<{ id: string; title: string; description: string; category_id: number; status: string; is_hidden: boolean }[]>(
    env,
    `${table}?id=eq.${job.target_id}&select=id,title,description,category_id,status,is_hidden`,
  );
  if (!row) return; // deleted since it was queued
  const attributes = await extractAttributes(env, `${row.title}. ${row.description}`, n.categories.get(row.category_id) ?? "");
  await rest(env, `${table}?id=eq.${row.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ attributes }) });
  if (row.is_hidden) return;
  if (job.target_type === "lost_report") {
    if (row.status === "active") await enqueueRank(env, [row.id]);
  } else if (ON_SHELF.includes(row.status)) {
    // A new found item: re-rank the open lost reports it most likely matches. Capped at 10, since
    // every re-rank is a Groq request and the free tier has a daily limit.
    const reports = await rpc<{ candidate_id: string }[]>(env, "candidate_matches", { p_kind: "found_item", p_id: row.id, p_limit: 10, p_window_days: 60 });
    await enqueueRank(env, reports.map((r) => r.candidate_id));
  }
}

async function rank(env: Env, job: Job, n: Names) {
  const [report] = await rest<
    { id: string; ref: string; reporter_id: string; title: string; description: string; date_lost: string; status: string; is_hidden: boolean; category_id: number; location_id: number | null }[]
  >(env, `lost_reports?id=eq.${job.target_id}&select=id,ref,reporter_id,title,description,date_lost,status,is_hidden,category_id,location_id`);
  if (!report || report.status !== "active" || report.is_hidden) return;

  const pre = await rpc<{ candidate_id: string; prefilter_score: number }[]>(env, "candidate_matches", {
    p_kind: "lost_report",
    p_id: report.id,
    p_limit: 20,
    p_window_days: 60,
  });
  const previous = await rest<{ found_item_id: string }[]>(env, `match_suggestions?lost_report_id=eq.${report.id}&select=found_item_id`);
  if (!pre.length) return;

  // Public columns only: private details and the shelf tag live in another table and are never read here.
  const items = await rest<{ id: string; title: string; description: string; date_found: string; category_id: number; location_id: number | null }[]>(
    env,
    `found_items?id=in.(${pre.map((p) => p.candidate_id).join(",")})&select=id,title,description,date_found,category_id,location_id`,
  );
  const candidates: Candidate[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    category: n.categories.get(i.category_id) ?? "",
    location: (i.location_id && n.locations.get(i.location_id)) || "",
    date: i.date_found,
    description: i.description,
  }));
  const lostText = [
    report.title,
    report.description,
    `Category: ${n.categories.get(report.category_id) ?? ""}`,
    `Last seen: ${(report.location_id && n.locations.get(report.location_id)) || "not sure"}`,
    `Date lost: ${report.date_lost}`,
  ].join(". ");
  const ranked = await rankCandidates(env, lostText, candidates);
  const score = new Map(pre.map((p) => [p.candidate_id, p.prefilter_score]));

  await rest(env, `match_suggestions?lost_report_id=eq.${report.id}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  if (ranked.length) {
    await rest(env, "match_suggestions", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify(
        ranked.map((r, i) => ({
          lost_report_id: report.id,
          found_item_id: r.id,
          rank: i + 1,
          likelihood: r.likelihood,
          // The app splits this back into "why" and "but".
          explanation: r.but ? `${r.why}\nBut: ${r.but}` : r.why,
          prefilter_score: score.get(r.id) ?? 0,
          model: env.GROQ_MODEL,
        })),
      ),
    });
  }

  const before = new Set(previous.map((p) => p.found_item_id));
  const fresh = ranked.filter((r) => r.likelihood !== "low" && !before.has(r.id));
  if (fresh.length) {
    await rest(env, "notifications", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: report.reporter_id,
        type: "matches",
        title: fresh.length === 1 ? "A possible match for your report" : `${fresh.length} possible matches for your report`,
        body: report.title,
        link: `/reports/${report.ref}/matches`,
      }),
    });
  }
}

const patchJob = (env: Env, id: number, values: Record<string, unknown>) =>
  rest(env, `ai_jobs?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(values) });

/** A run that died mid-job (timeout, crash) leaves it "processing"; after this long it is retried. */
const STALE_MINUTES = 10;

/**
 * Runs up to `limit` due jobs. Stops early when Groq rate-limits; those jobs wait and retry.
 * Each job costs up to about 10 Supabase/Groq requests, and a Worker invocation on the Free plan
 * may make 50, so keep `limit` small.
 */
export async function processJobs(env: Env, limit = 3): Promise<{ done: number; failed: number; deferred: number }> {
  const result = { done: 0, failed: 0, deferred: 0 };
  if (!env.GROQ_API_KEY) return result;
  const stale = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  await rest(env, `ai_jobs?status=eq.processing&updated_at=lt.${encodeURIComponent(stale)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ status: "queued", last_error: "Timed out; retried." }),
  });
  const now = new Date().toISOString();
  const jobs = await rest<Job[]>(
    env,
    `ai_jobs?status=eq.queued&run_after=lte.${encodeURIComponent(now)}&order=job_type.asc,run_after.asc&limit=${limit}&select=id,job_type,target_type,target_id,attempts`,
  );
  if (!jobs.length) return result;
  const n = await names(env);

  for (const job of jobs) {
    // Claim the job; another run that got it first leaves nothing to update.
    const claimed = await rest<unknown[]>(env, `ai_jobs?id=eq.${job.id}&status=eq.queued`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ status: "processing", attempts: job.attempts + 1 }),
    });
    if (!claimed.length) continue;
    try {
      if (job.job_type === "extract_attributes") await extract(env, job, n);
      else await rank(env, job, n);
      await patchJob(env, job.id, { status: "done", last_error: null });
      result.done++;
    } catch (err) {
      // If recording the outcome fails too, the stale-job reclaim above retries it later.
      try {
        if (err instanceof GroqRateLimited) {
          await patchJob(env, job.id, {
            status: "queued",
            attempts: job.attempts, // a rate limit isn't the job's fault
            run_after: new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString(),
          });
          result.deferred++;
          break;
        }
        const attempts = job.attempts + 1;
        await patchJob(env, job.id, {
          status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          last_error: String((err as Error).message).slice(0, 500),
          run_after: new Date(Date.now() + attempts * attempts * 60_000).toISOString(),
        });
        result.failed++;
      } catch (patchErr) {
        console.error(`ai job ${job.id}: couldn't record the outcome`, patchErr);
        result.failed++;
      }
    }
  }
  return result;
}
