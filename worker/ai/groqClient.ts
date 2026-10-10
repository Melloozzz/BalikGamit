// The only place that talks to Groq. Keep the model name in config (GROQ_MODEL) so a
// model change is a one-line edit. Only PUBLIC fields are ever sent here, and they are
// checked for contact details and ID numbers first (proposal: LLM data handling).

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

/** Same keys the database's prefilter compares (private.attribute_overlap). */
export interface Attributes {
  item_type: string | null;
  colors: string[];
  brand: string | null;
  material: string | null;
  size: string | null;
  features: string[];
}

export class GroqRateLimited extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Groq rate limit");
  }
}

// Removed before any text leaves for Groq: phone numbers, emails, links and handles, and long
// number runs (student and ID numbers). Mirrors the checks in src/lib/validation.ts.
const REDACTIONS: [RegExp, string][] = [
  [/(?:\+?63|\b0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\b(?:https?:\/\/|www\.)\S+/gi, "[link]"],
  [/\b(?:facebook\.com|fb\.com|m\.me|instagram\.com|t\.me|tiktok\.com|x\.com)\/\S+/gi, "[link]"],
  [/(?:^|\s)@[A-Za-z0-9_.]{3,}/g, " [handle]"],
  [/\b\d{4}-\d{5,6}\b/g, "[id]"],
  [/\b\d{8,}\b/g, "[id]"],
];
export function redact(text: string): string {
  return REDACTIONS.reduce((t, [re, sub]) => t.replace(re, sub), text);
}

async function chat(env: { GROQ_API_KEY: string; GROQ_MODEL: string }, system: string, user: unknown): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
  });
  if (res.status === 429) throw new GroqRateLimited(Number(res.headers.get("retry-after") ?? 30));
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(data.choices[0]?.message.content ?? "{}");
}

const EXTRACT = `You read one lost-or-found item description from a campus lost-and-found and return its attributes as JSON:
{"item_type":string|null,"colors":string[],"brand":string|null,"material":string|null,"size":string|null,"features":string[]}.
item_type is one or two plain English words (e.g. "umbrella", "wallet", "phone"). colors are simple English color words.
Use null or [] when the text doesn't say. Never invent details. The text may be in English, Filipino or Taglish; answer in English.`;

const clean = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim().toLowerCase().slice(0, 40) : null);
const list = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter((x): x is string => !!x).slice(0, 8) : []);

/** Step 1 of matching: structured attributes from the public text. */
export async function extractAttributes(env: { GROQ_API_KEY: string; GROQ_MODEL: string }, text: string, category: string): Promise<Attributes> {
  const out = (await chat(env, EXTRACT, { category, text: redact(text) })) as Record<string, unknown>;
  return {
    item_type: clean(out.item_type),
    colors: list(out.colors),
    brand: clean(out.brand),
    material: clean(out.material),
    size: clean(out.size),
    features: list(out.features),
  };
}

const RANK = `You rank found items against a description of a lost item for a campus lost-and-found.
Return JSON: {"ranked":[{"id":string,"likelihood":"high"|"medium"|"low","why":string,"but"?:string}]}.
Only include candidates that could plausibly match. "why" and "but" are one short plain-English clause each.
Never invent details that are not in the candidate fields. The description may be in English, Filipino or Taglish.`;

/** Step 3 of matching: the model ranks the prefiltered candidates. */
export async function rankCandidates(env: { GROQ_API_KEY: string; GROQ_MODEL: string }, lostText: string, candidates: Candidate[]): Promise<Ranked[]> {
  // Whitelist the public fields even if a caller passes a full row with private details.
  const publicOnly = candidates.map(({ id, title, category, location, date, description }) => ({
    id,
    title: redact(title),
    category,
    location,
    date,
    description: redact(description),
  }));
  const parsed = (await chat(env, RANK, { lost: redact(lostText), candidates: publicOnly })) as { ranked?: Ranked[] };
  const ids = new Set(candidates.map((c) => c.id));
  // Drop anything the model made up.
  return (parsed.ranked ?? []).filter((r) => ids.has(r.id) && ["high", "medium", "low"].includes(r.likelihood));
}
