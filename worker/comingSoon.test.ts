import { describe, expect, it, vi } from "vitest";
import { comingSoon, type GateEnv } from "./comingSoon";

function env(extra: Partial<GateEnv> = {}): GateEnv {
  const fetch = vi.fn(async () => new Response("<h1>Under construction</h1>", { status: 200 }));
  return { ASSETS: { fetch } as unknown as Fetcher, COMING_SOON: "true", ...extra };
}
const req = (url: string, headers: HeadersInit = {}) => new Request(url, { headers });

describe("coming-soon gate", () => {
  it("shows the page on the public domain", async () => {
    const e = env();
    const res = await comingSoon(req("https://balikgamit.example/login"), e);
    expect(res?.status).toBe(503);
    expect(res?.headers.get("x-robots-tag")).toBe("noindex");
    expect(await res?.text()).toContain("Under construction");
    expect((e.ASSETS.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0].toString()).toBe("https://balikgamit.example/coming-soon/");
  });

  it("closes the API on the public domain", async () => {
    const res = await comingSoon(req("https://balikgamit.example/api/health"), env());
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "BalikGamit isn't open yet." });
  });

  it("serves the page's own files", async () => {
    expect(await comingSoon(req("https://balikgamit.example/coming-soon/logo.png"), env())).toBeNull();
    expect(await comingSoon(req("https://balikgamit.example/favicon.png"), env())).toBeNull();
  });

  it("leaves local dev open", async () => {
    expect(await comingSoon(req("http://localhost:8787/"), env())).toBeNull();
  });

  it("opens the team address only through Cloudflare Access", async () => {
    expect(await comingSoon(req("https://dev.balikgamit.site/login", { "cf-access-jwt-assertion": "jwt" }), env())).toBeNull();
    expect((await comingSoon(req("https://dev.balikgamit.site/login"), env()))?.status).toBe(503);
    expect((await comingSoon(req("https://balikgamit.someone.workers.dev/login"), env()))?.status).toBe(503);
  });

  it("is off unless COMING_SOON is true", async () => {
    expect(await comingSoon(req("https://balikgamit.example/"), env({ COMING_SOON: "false" }))).toBeNull();
  });

  it("lets the team in with the preview key", async () => {
    const e = env({ PREVIEW_KEY: "s3cret" });
    const set = await comingSoon(req("https://balikgamit.example/login?preview=s3cret&next=1"), e);
    expect(set?.status).toBe(302);
    expect(set?.headers.get("location")).toBe("/login?next=1");
    expect(set?.headers.get("set-cookie")).toContain("bg_preview=s3cret");

    expect(await comingSoon(req("https://balikgamit.example/home", { cookie: "a=1; bg_preview=s3cret" }), e)).toBeNull();
    expect((await comingSoon(req("https://balikgamit.example/home", { cookie: "bg_preview=wrong" }), e))?.status).toBe(503);
    expect((await comingSoon(req("https://balikgamit.example/?preview=wrong"), e))?.status).toBe(503);
  });
});
