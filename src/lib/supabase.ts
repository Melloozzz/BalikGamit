import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when .env.local is missing; main.tsx then shows setup steps instead of the app. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Reset-password and invite links sign the person in only so they can choose a password. This
 * mark makes the rest of the app treat them as signed out until they set it or sign in normally
 * (AuthContext). Read from the link before the Supabase client below clears it from the address bar.
 */
export const SETTING_PASSWORD_KEY = "bg-setting-password";
if (typeof window !== "undefined") {
  const link = window.location.hash + window.location.search;
  const type = /[#&?]type=([a-z_]+)/.exec(link)?.[1];
  try {
    if (type === "recovery" || type === "invite") localStorage.setItem(SETTING_PASSWORD_KEY, "1");
    // Any other email link (e.g. a sign-up confirmation) starts a normal session, so a mark left
    // by an unfinished reset in this browser must not hide it.
    else if (type || /[#&]access_token=/.test(link)) localStorage.removeItem(SETTING_PASSWORD_KEY);
  } catch {
    // Storage blocked: the reset page still works; only the extra guard is lost.
  }
}

/**
 * The browser only ever holds the URL and the public (anon / publishable) key. Row-level
 * security in the database decides what each user can read or write. Never put the
 * service key in a VITE_ variable: anything VITE_ ends up in the browser.
 */
export const supabase = createClient(url || "http://localhost:54321", anonKey || "missing-key");
