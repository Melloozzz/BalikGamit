import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The browser only ever holds the URL and the anon key. Row-level security in the
 * database decides what each user can read or write. When the keys are missing the
 * app runs in demo mode with sample data (see src/data/api.ts).
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const isDemoMode = supabase === null;
