import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { LogoTile, Wordmark } from "../components/Brand";
import { Icon } from "../components/Icon";
import { AppFooter } from "../components/Footer";
import { Drawer, type NavItem } from "./Drawer";
import { ProfileMenu } from "../components/ProfileMenu";
import { useAuth } from "../auth/AuthContext";
import { unreadCount, useDataVersion } from "../data/api";

const nav: NavItem[] = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/report", label: "Report lost item", icon: "report", end: true },
  { to: "/reports", label: "My Reports", icon: "claims" },
  { to: "/claims", label: "My Claims", icon: "shield" },
  { to: "/notifications", label: "Notifications & messages", icon: "bell" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export function StudentLayout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useDataVersion();
  const unread = unreadCount();

  const out = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <button className="icon-btn icon-btn--light" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
            <Icon name="menu" size={32} strokeWidth={2} />
          </button>
          <Link to="/home" className="topbar__brand" aria-label="BalikGamit home">
            <LogoTile size={48} />
            <Wordmark size={28} />
          </Link>
        </div>
        <div className="topbar__right">
          <Link to="/notifications" className="icon-btn icon-btn--light topbar__bell" aria-label={`Notifications, ${unread} unread`}>
            <Icon name="bell" size={28} />
            {unread > 0 && <span className="count-dot">{unread}</span>}
          </Link>
          {user && <ProfileMenu user={user} profileTo="/profile" settingsTo="/settings" onSignOut={out} />}
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)} items={nav} onSignOut={out} />
      <main className="app__main">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}
