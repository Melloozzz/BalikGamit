import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { LogoMark, Wordmark } from "../components/Brand";
import { Icon } from "../components/Icon";
import { Drawer, type NavItem } from "./Drawer";
import { useAuth } from "../auth/AuthContext";
import { ProfileMenu } from "../components/ProfileMenu";
import { NotificationMenu } from "../components/NotificationMenu";
import { setActor, unreadCount, useDataVersion } from "../data/api";

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.role === "super_admin";
  useDataVersion();
  const unread = unreadCount("office");
  // Demo mode: label audit-trail rows with the signed-in staff member (a database trigger does this in production).
  if (user) setActor(user.fullName);

  const nav: NavItem[] = [
    { to: "/admin", label: "Dashboard", icon: "dashboard", end: true },
    { to: "/admin/log-item", label: "Log found item", icon: "plusCircle" },
    { to: "/admin/items", label: "Found items", icon: "box" },
    { to: "/admin/lost", label: "Lost reports", icon: "report" },
    { to: "/admin/claims", label: "Claim Queue", icon: "shield" },
    { to: "/admin/unclaimed", label: "Unclaimed items", icon: "clock" },
    { to: "/admin/flagged", label: "Flagged posts", icon: "flag" },
    { to: "/admin/reports", label: "Reports", icon: "chart" },
    { to: "/admin/messages", label: "Messages", icon: "message" },
  ];

  const out = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="topbar__left">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
            <Icon name="menu" size={32} strokeWidth={2.2} />
          </button>
          <Link to="/admin" className="topbar__brand" aria-label="BalikGamit office dashboard">
            <LogoMark height={42} />
            <Wordmark tone="onLight" size={32} />
          </Link>
        </div>
        <div className="topbar__right">
          <span className="role-pill">{isSuper ? "Super admin" : "Faculty View"}</span>
          <NotificationMenu who="office" unread={unread} />
          {user && <ProfileMenu user={user} profileTo="/admin/profile" settingsTo="/admin/settings" onSignOut={out} />}
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)} items={nav} onSignOut={out} />
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
