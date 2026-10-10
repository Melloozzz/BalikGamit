// Supabase calls made with the service key. The key stays in the Worker (a secret) and is never
// sent to the browser. It bypasses row-level security, so every caller in this Worker checks
// who is asking before it acts.

export interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  /** Optional: email for unread claim messages. Without it, no emails are sent. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

const headers = (env: Env, extra: HeadersInit = {}) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
  ...extra,
});

async function parse<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what} ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** PostgREST (tables and rpc/...). */
export async function rest<T = unknown>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: headers(env, init.headers) });
  return parse<T>(res, `Supabase ${path.split("?")[0]}`);
}

export const rpc = <T = unknown>(env: Env, fn: string, args: Record<string, unknown> = {}) =>
  rest<T>(env, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

/** Supabase Auth admin API. */
export async function auth<T = unknown>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, { ...init, headers: headers(env, init.headers) });
  return parse<T>(res, `Auth ${path.split("?")[0]}`);
}

/** Supabase Storage API. */
export async function storage<T = unknown>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/${path}`, { ...init, headers: headers(env, init.headers) });
  return parse<T>(res, `Storage ${path.split("?")[0]}`);
}

/** The signed-in user behind a browser token, or null. */
export async function userFromToken(env: Env, token: string): Promise<{ id: string; email: string } | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } });
  return res.ok ? ((await res.json()) as { id: string; email: string }) : null;
}

export async function profileOf(env: Env, userId: string) {
  const rows = await rest<{ id: string; role: string; is_active: boolean; full_name: string; email: string }[]>(
    env,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,is_active,full_name,email`,
  );
  return rows[0] ?? null;
}
