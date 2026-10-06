import { Link } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Icon } from "../../components/Icon";

export function ResetLinkSent() {
  return (
    <AuthLayout>
      <div className="auth-form auth-form--center">
        <span className="auth-icon">
          <Icon name="message" size={40} />
        </span>
        <h2 className="auth-title">Check your email</h2>
        <p className="auth-text">
          If an account exists for that email, we’ve sent a password reset link. The link works for a limited time.
        </p>
        <p className="auth-text auth-text--muted">Check your spam folder if you don’t see it.</p>
        <Link to="/forgot-password" className="btn btn--navy btn--block btn--lg">
          Resend link
        </Link>
        <p className="auth-switch">
          Back to <Link to="/login">Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
