// Photos live in two private Storage buckets: found-photos (office uploads) and
// lost-photos (each student uploads into a folder named after their user id).
// Pages get short-lived signed URLs; the buckets are never public.
import { supabase } from "../lib/supabase";

export type Bucket = "found-photos" | "lost-photos";

const MAX_SIDE = 1600;
const MAX_BYTES = 2 * 1024 * 1024; // the buckets' file size limit

/**
 * Re-encodes the photo as JPEG in the browser. Drawing it onto a canvas drops every piece of
 * metadata, including GPS location (Data Privacy commitment in the proposal), and shrinks it
 * under the bucket's 2 MB limit.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP photo.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("That photo is too large. Try a smaller one.");
}

/** Uploads a prepared photo and returns its storage path. `folder` is required for lost-photos (the user's id). */
export async function uploadPhoto(bucket: Bucket, file: File, folder: string): Promise<string> {
  const blob = await preparePhoto(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("The photo didn't upload. Check your connection and try again.");
  return path;
}

/** Best effort: a leftover file is harmless, so failures are ignored. */
export async function removePhotos(bucket: Bucket, paths: string[]) {
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

// Signed URLs last an hour; reuse them for 50 minutes so lists don't re-sign on every load.
const TTL = 3600;
const cache = new Map<string, { url: string; until: number }>();

/** Signed URLs for many paths in one request. Paths the viewer can't read are left out. */
export async function signedUrls(bucket: Bucket, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(`${bucket}/${p}`);
    if (hit && hit.until > now) out.set(p, hit.url);
    else missing.push(p);
  }
  if (missing.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, TTL);
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        out.set(row.path, row.signedUrl);
        cache.set(`${bucket}/${row.path}`, { url: row.signedUrl, until: now + 50 * 60_000 });
      }
    }
  }
  return out;
}
