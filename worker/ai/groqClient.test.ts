import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqRateLimited, extractAttributes, rankCandidates, redact, type Candidate } from "./groqClient";

const env = { GROQ_API_KEY: "test", GROQ_MODEL: "openai/gpt-oss-120b" };
const candidates: Candidate[] = [
  { id: "BG-1048", title: "Navy folding umbrella", category: "Umbrella", location: "MAE Building", date: "2026-09-26", description: "Navy, black strap" },
  { id: "BG-1053", title: "Dark blue umbrella", category: "Umbrella", location: "Library", date: "2026-09-28", description: "Full size" },
];

function mockGroq(status: number, content: unknown, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status, headers }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("rankCandidates", () => {
  it("drops IDs the model invented and bad likelihood values", async () => {
    mockGroq(200, {
      ranked: [
        { id: "BG-1048", likelihood: "high", why: "same color" },
        { id: "BG-9999", likelihood: "high", why: "made up" },
        { id: "BG-1053", likelihood: "certain", why: "bad enum" },
      ],
    });
    const out = await rankCandidates(env, "navy umbrella", candidates);
    expect(out.map((r) => r.id)).toEqual(["BG-1048"]);
  });

  it("never sends private details, even if the caller passes them", async () => {
    const fetchMock = mockGroq(200, { ranked: [] });
    const leaky = candidates.map((c) => ({ ...c, privateDetails: "initials A.R. inside", shelfTag: "B-03" }));
    await rankCandidates(env, "navy umbrella", leaky);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const sent = JSON.parse(body.messages[1].content);
    expect(Object.keys(sent.candidates[0]).sort()).toEqual(["category", "date", "description", "id", "location", "title"]);
  });

  it("raises GroqRateLimited on 429 with retry-after", async () => {
    mockGroq(429, {}, { "retry-after": "12" });
    await expect(rankCandidates(env, "x", candidates)).rejects.toMatchObject({ retryAfterSeconds: 12 });
    await expect(rankCandidates(env, "x", candidates)).rejects.toBeInstanceOf(GroqRateLimited);
  });
});

describe("redact", () => {
  it("removes contact details and ID numbers before text reaches the model", () => {
    const out = redact("Black wallet, call 0917 123 4567 or a.reyes@gmail.com, fb.com/angela, @angela_r, student no 2024-200544, card 123456789012");
    expect(out).not.toMatch(/0917|gmail|fb\.com|angela_r|2024-200544|123456789012/);
    expect(out).toContain("Black wallet");
  });

  it("leaves dates and room numbers alone", () => {
    expect(redact("Lost on 2026-09-22 near Room 304")).toBe("Lost on 2026-09-22 near Room 304");
  });
});

describe("extractAttributes", () => {
  it("returns the keys the database prefilter compares, lower-cased and trimmed", async () => {
    mockGroq(200, { item_type: " Umbrella ", colors: ["Navy", "", 3], brand: null, material: "Nylon", features: ["Black strap"] });
    const a = await extractAttributes(env, "Navy umbrella with a black strap", "Umbrella");
    expect(a).toEqual({ item_type: "umbrella", colors: ["navy"], brand: null, material: "nylon", size: null, features: ["black strap"] });
  });

  it("sends redacted text only", async () => {
    const fetchMock = mockGroq(200, {});
    await extractAttributes(env, "Wallet, text 09171234567", "Wallet");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[1].content).not.toContain("09171234567");
  });
});
