import { useState } from "react";
import { Link, NavLink } from "react-router";
import { BrandLockup } from "./Brand";
import { Icon } from "./Icon";
import { useAuth, isAdmin } from "../auth/AuthContext";
import { Drawer, type NavItem } from "../layouts/Drawer";

const pages: NavItem[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/about", label: "About us", icon: "info", end: true },
  { to: "/privacy", label: "Privacy Notice", icon: "shield" },
  { to: "/terms", label: "Terms of Use", icon: "claims" },
];

/** Header for the public and sign-in pages. On phones the links and Sign In / Sign Up move into a side menu. */
export function SiteHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const home = user ? (isAdmin(user) ? "/admin" : "/home") : null;
  const close = () => setOpen(false);

  return (
    <>
      <header className="site-top">
        <BrandLockup />
        <nav className="site-top__nav" aria-label="Site">
          {pages.slice(0, 2).map((p) => (
            <NavLink key={p.to} to={p.to} end={p.end}>
              {p.label}
            </NavLink>
          ))}
        </nav>
        <nav className="site-top__actions" aria-label="Account">
          {home ? (
            <Link to={home} className="btn btn--gold">
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
        <button className="icon-btn site-top__menu" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Icon name="menu" size={26} strokeWidth={2} />
        </button>
      </header>
      <Drawer
        className="drawer--site"
        open={open}
        onClose={close}
        items={pages}
        footer={
          home ? (
            <Link to={home} className="btn btn--gold btn--block" onClick={close}>
              Open BalikGamit
            </Link>
          ) : (
            <>
              <Link to="/signup" className="btn btn--gold btn--block" onClick={close}>
                Sign Up
              </Link>
              <Link to="/login" className="btn btn--outline btn--block" onClick={close}>
                Sign In
              </Link>
            </>
          )
        }
      />
    </>
  );
}
