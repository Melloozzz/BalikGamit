import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isOfficeRole, type Profile } from "../data/types";
import { loadReference } from "../data/reference";
import { supabase } from "../lib/supabase";
import { PASSWORD_RULE, isRtuEmail } from "../lib/validation";
import { PRIVACY_NOTICE_VERSION } from "../lib/consent";

interface AuthState {
  user: Profile | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  /** Re-read the signed-in profile, e.g. after changing your name in Settings. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export class AuthError extends Error {
  constructor(public code: "wrong_domain" | "invalid_credentials" | "inactive" | "weak_password" | "unknown", message: string) {
    super(message);
  }
}

/** Supabase error -> a message a student can act on. */
function toAuthError(error: { code?: string; message: string }): AuthError {
  if (error.code === "weak_password") return new AuthError("weak_password", PASSWORD_RULE);
  // The sign-up trigger rejects non-RTU emails; Supabase reports that as a generic database error.
  if (/database error/i.test(error.message))
    return new AuthError("wrong_domain", "Please sign up with your RTU email address (@rtu.edu.ph).");
  return new AuthError("unknown", error.message);
}

async function loadProfile(userId: string): Promise<Profile | null> {
  // `profiles` holds the role; the role is never taken from anything the client sends.
  const { data } = await supabase.from("profiles").select("id, full_name, email, role, is_active, created_at").eq("id", userId).single();
  return data
    ? {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        role: data.role,
        active: data.is_active,
        joinedOn: String(data.created_at).slice(0, 10),
      }
    : null;
}

/** Profile plus the reference lists (categories and locations need a signed-in user). */
async function loadSession(userId: string | undefined): Promise<Profile | null> {
  const [profile] = await Promise.all([userId ? loadProfile(userId) : Promise.resolve(null), loadReference()]);
  return profile && profile.active ? profile : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const profile = await loadSession(data.session?.user.id);
      if (!alive) return;
      setUser(profile);
      setReady(true);
    });
    // Supabase runs this callback while it holds its auth lock, so database calls are deferred
    // until after it returns; awaiting them inside the callback can hang the client.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => {
        loadSession(session?.user.id).then((p) => alive && setUser(p));
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isRtuEmail(email)) throw new AuthError("wrong_domain", "Please sign up with your RTU email address (@rtu.edu.ph).");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new AuthError("invalid_credentials", "Incorrect email or password.");
    const profile = await loadProfile(data.user.id);
    if (!profile) throw new AuthError("unknown", "Your account isn't set up yet. Try again in a minute.");
    if (!profile.active) {
      await supabase.auth.signOut();
      throw new AuthError("inactive", "This account has been deactivated. Contact the office if you think this is a mistake.");
    }
    await loadReference();
    setUser(profile);
    return profile;
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    if (!isRtuEmail(email)) throw new AuthError("wrong_domain", "Please sign up with your RTU email address (@rtu.edu.ph).");
    // A database trigger also rejects non-@rtu.edu.ph emails, so this check can't be bypassed.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // consent_version is stored on the profile as the record of the Privacy Notice they agreed to.
      options: {
        data: { full_name: fullName, consent_version: PRIVACY_NOTICE_VERSION },
        emailRedirectTo: `${location.origin}/login`,
      },
    });
    if (error) throw toAuthError(error);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    // Always succeeds from the user's point of view, so the page never reveals whether an account exists.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw toAuthError(error);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) setUser(await loadProfile(data.session.user.id));
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, requestPasswordReset, updatePassword, refreshProfile }),
    [user, ready, signIn, signUp, signOut, requestPasswordReset, updatePassword, refreshProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

export const isAdmin = (p: Profile | null) => isOfficeRole(p?.role);
