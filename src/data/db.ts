// Small helpers shared by the data layer.
import { supabase } from "../lib/supabase";

/** Supabase result -> data, or a thrown Error with a message a person can read. */
export function must<R = unknown>(res: { data: unknown; error: { message: string; code?: string } | null }, fallback = "Something went wrong. Try again."): R {
  if (res.error) throw new Error(friendly(res.error) ?? fallback);
  return res.data as R;
}

/** Database errors raised by our functions are written for users; anything technical gets a plain fallback. */
export function friendly(error: { message: string; code?: string }): string | null {
  // P0001 = `raise exception` in our SQL functions: those messages are meant for people.
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501") return "You don't have permission to do that.";
  return null;
}

/** The calendar date in Manila for a timestamp, as YYYY-MM-DD. */
export const manilaDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** PostgREST returns a one-to-one embed as an object, and some as a one-item array. */
export const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

// Records show their reference number (BG-1001, LR-1001, CL-1001); the database functions take the
// row id. This remembers the id for every reference the app has loaded.
const ids = new Map<string, string>();
export const remember = (ref: string, id: string) => ids.set(ref, id);

type RefTable = "found_items" | "lost_reports" | "claims";
export async function idOf(table: RefTable, ref: string): Promise<string> {
  const known = ids.get(ref);
  if (known) return known;
  const row = must(await supabase.from(table).select("id").eq("ref", ref).maybeSingle()) as { id: string } | null;
  if (!row) throw new Error("We couldn't find that record. It may have been removed.");
  ids.set(ref, row.id);
  return row.id;
}
