// "Under construction" gate. While COMING_SOON is "true" (wrangler.jsonc), visitors get
// public/coming-soon/index.html instead of the app. The team uses dev.balikgamit.site, which
// Cloudflare Access (Zero Trust) limits to their emails; local dev stays open. Set the
// PREVIEW_KEY secret to let the team into the real domain too: visit /?preview=<key> once.

export type GateEnv = { ASSETS: Fetcher; COMING_SOON?: string; PREVIEW_KEY?: string };

const OPEN_HOSTS = /^(localhost|127\.0\.0\.1)$/;
export const TEAM_HOST = "dev.balikgamit.site";
const COOKIE = "bg_preview";

/** The coming-soon response for this request, or null to serve the app as usual. */
export async function comingSoon(req: Request, env: GateEnv): Promise<Response | null> {
  if (env.COMING_SOON !== "true") return null;
  const url = new URL(req.url);
  if (OPEN_HOSTS.test(url.hostname)) return null;
  // Access does the real check; requiring its token here is a safety net, so the team address
  // shows the coming-soon page instead of the app if the Access application is ever removed.
  if (url.hostname === TEAM_HOST && req.headers.has("cf-access-jwt-assertion")) return null;
  // The page's own files.
  if (url.pathname.startsWith("/coming-soon/") || url.pathname === "/favicon.png") return null;

  if (env.PREVIEW_KEY) {
    if (url.searchParams.get("preview") === env.PREVIEW_KEY) {
      url.searchParams.delete("preview");
      return new Response(null, {
        status: 302,
        headers: {
          location: url.pathname + url.search,
          "set-cookie": `${COOKIE}=${encodeURIComponent(env.PREVIEW_KEY)}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
        },
      });
    }
    if (readCookie(req, COOKIE) === env.PREVIEW_KEY) return null;
  }

  // 503 + Retry-After tells search engines the site is temporarily down, not gone.
  const closed = { "retry-after": "86400", "x-robots-tag": "noindex", "cache-control": "no-store" };
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return Response.json({ error: "BalikGamit isn't open yet." }, { status: 503, headers: closed });
  }
  const page = await env.ASSETS.fetch(new URL("/coming-soon/", url));
  return new Response(page.body, { status: 503, headers: { ...closed, "content-type": "text/html; charset=utf-8" } });
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
