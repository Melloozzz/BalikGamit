import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { PasswordField } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { fieldErrors, resetPasswordSchema } from "../../lib/validation";

export function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  // Supabase puts an error in the URL hash when the recovery link is stale.
  useEffect(() => {
    if (location.hash.includes("error_code=otp_expired")) navigate("/reset-password/expired", { replace: true });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      await updatePassword(form.password);
      setDone(true);
    } catch {
      navigate("/reset-password/expired");
    }
  }

  if (done)
    return (
      <AuthLayout>
        <div className="auth-form auth-form--center">
          <h2 className="auth-title">Password updated</h2>
          <p className="auth-text">You can now sign in with your new password.</p>
          <Link to="/login" className="btn btn--navy btn--block btn--lg">
            Sign In
          </Link>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2 className="auth-title">Reset your password</h2>
        <PasswordField
          label="New Password"
          autoComplete="new-password"
          placeholder="Enter your new password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Confirm your new password"
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          className={errors.confirm ? "field--error" : ""}
        />
        {errors.confirm && (
          <p className="auth-error" role="alert">
            {errors.confirm}
          </p>
        )}
        <button className="btn btn--navy btn--block btn--lg">Reset Password</button>
        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
