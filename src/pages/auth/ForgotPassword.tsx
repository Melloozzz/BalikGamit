import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { TextField } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { isRtuEmail } from "../../lib/validation";

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isRtuEmail(email)) return setError("Enter your RTU email address (@rtu.edu.ph).");
    await requestPasswordReset(email.trim());
    navigate("/reset-link-sent");
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2 className="auth-title">Forgot your password?</h2>
        <p className="auth-text auth-text--center">Enter your RTU email and we’ll send you a link to reset your password.</p>
        <TextField
          label="Institutional Email"
          type="email"
          autoComplete="email"
          placeholder="Ex. 0000-000000@rtu.edu.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <button className="btn btn--navy btn--block btn--lg">Send reset link</button>
        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
