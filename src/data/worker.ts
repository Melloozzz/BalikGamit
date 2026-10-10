// Calls to the Cloudflare Worker (/api), for the few things that need the service key.
import { supabase } from "../lib/supabase";

export async function workerFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  }).catch(() => null);
}

/**
 * Asks the Worker to process queued AI jobs now. Fire and forget: if the Worker isn't running,
 * the scheduled run picks the jobs up later.
 */
export function kickMatching() {
  void workerFetch("/jobs/kick", { method: "POST" });
}
