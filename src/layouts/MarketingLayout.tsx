import { Link, Outlet } from "react-router";
import { BrandLockup } from "../components/Brand";
import { SiteFooter } from "../components/Footer";
import { useAuth, isAdmin } from "../auth/AuthContext";

/** Landing, About, Privacy Notice and Terms of Use. */
export function MarketingLayout() {
  const { user } = useAuth();
  return (
    <div className="site">
      <header className="site-top">
        <BrandLockup />
        <nav className="site-top__actions" aria-label="Account">
          {user ? (
            <Link to={isAdmin(user) ? "/admin" : "/home"} className="btn btn--gold">
              Open BalikGamit
            </Link>
          ) : (
            <>
              <Link to="/login" className="site-top__signin">
                Sign In
              </Link>
              <Link to="/signup" className="btn btn--gold">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
