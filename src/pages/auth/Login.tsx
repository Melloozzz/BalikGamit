import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { PasswordField, TextField } from "../../components/ui";
import { AuthError, useAuth, isAdmin } from "../../auth/AuthContext";

export function Login() {
  const { signIn, user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The sign-up confirmation link lands here. A bad or used link comes back with an error in the hash.
  const [error, setError] = useState<{ code: string; message: string } | null>(() =>
    new URLSearchParams(location.hash.slice(1)).get("error_code")
      ? { code: "link", message: "That confirmation link has expired or was already used. Sign in below; if your email isn’t confirmed yet, you can get a new link from there." }
      : null,
  );
  const [busy, setBusy] = useState(false);

  // A working confirmation link signs the person in from the URL, so send them on.
  useEffect(() => {
    if (ready && user) navigate(from ?? (isAdmin(user) ? "/admin" : "/home"), { replace: true });
  }, [ready, user, from, navigate]);

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
            {error.code === "unconfirmed" && (
              <>
                {" "}
                <Link to="/check-email" state={{ email: email.trim() }}>
                  Resend the link
                </Link>
              </>
            )}
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
      </form>
    </AuthLayout>
  );
}
