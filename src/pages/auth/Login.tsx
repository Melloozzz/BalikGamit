import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { PasswordField, TextField } from "../../components/ui";
import { AuthError, useAuth, isAdmin } from "../../auth/AuthContext";
import { isDemoMode } from "../../lib/supabase";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await signIn(email, password);
      navigate(from ?? (isAdmin(profile) ? "/admin" : "/home"), { replace: true });
    } catch (err) {
      const e2 = err instanceof AuthError ? err : new AuthError("unknown", "Something went wrong. Try again.");
      setError({ code: e2.code, message: e2.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2 className="auth-welcome">
          <span>WELCOME TO</span>
          <span className="auth-welcome__name">BalikGamit!</span>
        </h2>
        {error && (
          <p className="auth-error" role="alert">
            {error.message}
          </p>
        )}
        <TextField
          label="Institutional Email"
          type="email"
          autoComplete="email"
          placeholder="Ex. 0000-000000@rtu.edu.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          className={error ? "field--error" : ""}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={error?.code === "invalid_credentials" ? "field--error" : ""}
        />
        <Link to="/forgot-password" className="auth-forgot">
          Forgot password?
        </Link>
        <button className="btn btn--navy btn--block btn--lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
        <p className="auth-switch">
          New to BalikGamit? <Link to="/signup">Create an account</Link>
        </p>
        {isDemoMode && (
          <p className="demo-note">
            Demo mode: sign in as <b>angela.reyes@rtu.edu.ph</b> (student) or <b>maria.santos@rtu.edu.ph</b> (office), with any
            password of 8+ characters.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
