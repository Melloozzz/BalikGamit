import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { PasswordField, TextField } from "../../components/ui";
import { AuthError, useAuth } from "../../auth/AuthContext";
import { fieldErrors, isRtuEmail, resetPasswordSchema } from "../../lib/validation";

/** Where the office invite email lands (worker/index.ts): the new admin chooses their first password. */
export function SetPassword() {
  const { updatePassword, signOut, requestPasswordReset } = useAuth();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Supabase puts an error in the URL hash when the invite link is stale.
  const [expired, setExpired] = useState(() => location.hash.includes("error_code="));
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  // A new link that opens this page again (not Reset Password).
  async function sendNewLink(e: FormEvent) {
    e.preventDefault();
    if (!isRtuEmail(email)) return setEmailError("Enter your RTU email address (@rtu.edu.ph).");
    setEmailError("");
    await requestPasswordReset(email.trim(), "/set-password");
    setLinkSent(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      await updatePassword(form.password);
      // The invite link signed them in; sign out so they sign in with the new password.
      await signOut();
      setDone(true);
    } catch (err) {
      // A weak password is theirs to fix here; anything else means the invite link no longer works.
      if (err instanceof AuthError && err.code === "weak_password") setErrors({ password: err.message });
      else setExpired(true);
    }
  }

  if (expired && linkSent)
    return (
      <AuthLayout>
        <div className="auth-form auth-form--center">
          <h2 className="auth-title">Check your email</h2>
          <p className="auth-text">If {email.trim()} has a BalikGamit account, we sent it a new link to set up your password.</p>
          <p className="auth-switch">
            Already set your password? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </AuthLayout>
    );

  if (expired)
    return (
      <AuthLayout>
        <form className="auth-form" onSubmit={sendNewLink} noValidate>
          <h2 className="auth-title">This Invite Link Has Expired</h2>
          <p className="auth-text auth-text--strong">
            Invite links work only once and for a short time. Enter your RTU email and we'll send you a new link.
          </p>
          <TextField
            label="Institutional Email"
            type="email"
            autoComplete="email"
            placeholder="Ex. 0000-000000@rtu.edu.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <button className="btn btn--navy btn--block btn--lg">Send a New Link</button>
          <p className="auth-switch">
            Already set your password? <Link to="/login">Sign In</Link>
          </p>
        </form>
      </AuthLayout>
    );

  if (done)
    return (
      <AuthLayout>
        <div className="auth-form auth-form--center">
          <h2 className="auth-title">Your account is ready</h2>
          <p className="auth-text">Sign in with your RTU email and the password you just created.</p>
          <Link to="/login" className="btn btn--navy btn--block btn--lg">
            Sign In
          </Link>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2 className="auth-title">Set up your account</h2>
        <p className="auth-text">You've been added to the BalikGamit office team. Create a password to finish.</p>
        <PasswordField
          label="New Password"
          autoComplete="new-password"
          placeholder="Create your password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password}
          hint="8+ characters with uppercase, lowercase, a number and a symbol."
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type your password again"
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          className={errors.confirm ? "field--error" : ""}
        />
        {errors.confirm && (
          <p className="auth-error" role="alert">
            {errors.confirm}
          </p>
        )}
        <button className="btn btn--navy btn--block btn--lg">Create Password</button>
        <p className="auth-switch">
          Already set your password? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
