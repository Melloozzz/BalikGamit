// The only place that talks to Groq. Keep the model name in config (GROQ_MODEL) so a
// model change is a one-line edit. Only PUBLIC fields are ever sent here.
// Not called yet: rankCandidates is for the match-job consumer (ai_jobs, cron in index.ts),
// which still has to be written. Its tests guard the privacy whitelist until then.

export interface Candidate {
  id: string;
  title: string;
  category: string;
  location: string;
  date: string;
  description: string;
}

export interface Ranked {
  id: string;
  likelihood: "high" | "medium" | "low";
  why: string;
  but?: string;
}

export class GroqRateLimited extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Groq rate limit");
  }
}

const SYSTEM = `You rank found items against a description of a lost item for a campus lost-and-found.
Return JSON: {"ranked":[{"id":string,"likelihood":"high"|"medium"|"low","why":string,"but"?:string}]}.
Only include candidates that could plausibly match. "why" and "but" are one short plain-English clause each.
Never invent details that are not in the candidate fields. The description may be in English, Filipino or Taglish.`;

export async function rankCandidates(
  env: { GROQ_API_KEY: string; GROQ_MODEL: string },
  lostText: string,
  candidates: Candidate[],
): Promise<Ranked[]> {
  // Whitelist the public fields even if a caller passes a full row with private details.
  const publicOnly = candidates.map(({ id, title, category, location, date, description }) => ({
    id,
    title,
    category,
    location,
    date,
    description,
  }));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ lost: lostText, candidates: publicOnly }) },
      ],
    }),
  });
  if (res.status === 429) throw new GroqRateLimited(Number(res.headers.get("retry-after") ?? 30));
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0]?.message.content ?? "{}") as { ranked?: Ranked[] };
  const ids = new Set(candidates.map((c) => c.id));
  // Drop anything the model made up.
  return (parsed.ranked ?? []).filter((r) => ids.has(r.id) && ["high", "medium", "low"].includes(r.likelihood));
}
