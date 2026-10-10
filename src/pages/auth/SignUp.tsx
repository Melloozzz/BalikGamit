import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { PasswordField, TextField } from "../../components/ui";
import { AuthError, useAuth } from "../../auth/AuthContext";
import { fieldErrors, signUpSchema } from "../../lib/validation";
import { PrivacyNoticeModal } from "../public/Privacy";

export function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "", consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const set =(k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      await signUp(form.fullName.trim(), form.email.trim(), form.password);
      navigate("/check-email", { state: { email: form.email.trim() } });
    } catch (err) {
      if (err instanceof AuthError && err.code === "weak_password") setErrors({ password: err.message });
      else setErrors({ _: err instanceof AuthError ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form auth-form--tight" onSubmit={submit} noValidate>
        <h2 className="auth-join">
          <span className="gold">Join</span> BalikGamit!
        </h2>
        {(errors._ || errors.email?.includes("@rtu.edu.ph")) && (
          <p className="auth-error" role="alert">
            {errors._ ?? errors.email}
          </p>
        )}
        <TextField label="Full name" autoComplete="name" placeholder="Ex. Juan Dela Cruz" value={form.fullName} onChange={set("fullName")} error={errors.fullName} />
        <TextField
          label="Institutional Email"
          type="email"
          autoComplete="email"
          placeholder="Ex. 0000-000000@rtu.edu.ph"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          hint="8+ characters with uppercase, lowercase, a number and a symbol."
        />
        <PasswordField label="Confirm Password" autoComplete="new-password" placeholder="Re-enter your password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />
        <label className={`consent ${errors.consent ? "consent--error" : ""}`}>
          <input type="checkbox" checked={form.consent} onChange={set("consent")} />
          <span>
            I agree to the{" "}
            <button
              type="button"
              className="consent__link"
              onClick={(e) => {
                // Inside the checkbox label: open the notice without ticking the box.
                e.preventDefault();
                setShowPrivacy(true);
              }}
            >
              Privacy Notice
            </button>
            , including that my report descriptions are shared with an AI matching service.
          </span>
        </label>
        {errors.consent && (
          <p className="field__error" role="alert">
            {errors.consent}
          </p>
        )}
        <button className="btn btn--navy btn--block btn--lg" disabled={busy}>
          {busy ? "Creating account…" : "Sign Up"}
        </button>
        <p className="auth-switch">
          Already registered? <Link to="/login">Sign In</Link>
        </p>
      </form>
      {/* A popup, not a new tab, so the half-filled form is still here after reading it. */}
      {showPrivacy && <PrivacyNoticeModal onClose={() => setShowPrivacy(false)} />}
    </AuthLayout>
  );
}
