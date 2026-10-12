import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when .env.local is missing; main.tsx then shows setup steps instead of the app. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * The browser only ever holds the URL and the public (anon / publishable) key. Row-level
 * security in the database decides what each user can read or write. Never put the
 * service key in a VITE_ variable: anything VITE_ ends up in the browser.
 */
export const supabase = createClient(url || "http://localhost:54321", anonKey || "missing-key");
