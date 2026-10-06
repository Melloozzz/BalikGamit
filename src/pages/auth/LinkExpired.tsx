import { Link } from "react-router";
import { AuthLayout } from "../../layouts/AuthLayout";

export function LinkExpired() {
  return (
    <AuthLayout>
      <div className="auth-form auth-form--center">
        <h2 className="auth-title">This Link Has Expired</h2>
        <p className="auth-text auth-text--strong">
          For your security, password reset links only work for a short time. Request a new one below.
        </p>
        <Link to="/forgot-password" className="btn btn--navy btn--block btn--lg">
          Request New Link
        </Link>
        <p className="auth-switch">
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
