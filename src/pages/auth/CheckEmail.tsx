import { useState } from "react";
import { Link, useLocation } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Icon } from "../../components/Icon";
import { supabase } from "../../lib/supabase";

export function CheckEmail() {
  const email = (useLocation().state as { email?: string } | null)?.email ?? "your RTU email";
  const [sent, setSent] = useState(false);

  async function resend() {
    if (supabase && email.includes("@")) await supabase.auth.resend({ type: "signup", email });
    setSent(true);
  }

  return (
    <AuthLayout>
      <div className="auth-form auth-form--center">
        <span className="auth-icon">
          <Icon name="message" size={40} />
        </span>
        <h2 className="auth-title">Verify your email</h2>
        <p className="auth-text">We sent a confirmation link to</p>
        <p className="auth-email">{email}</p>
        <p className="auth-text">Open it to activate your account, then sign in. Check your spam folder if you don’t see it.</p>
        <button className="btn btn--navy btn--block btn--lg" onClick={resend} disabled={sent}>
          {sent ? "Email sent again" : "Resend email"}
        </button>
        <p className="auth-switch">
          Wrong email? <Link to="/signup">Sign up again</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
