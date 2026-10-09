import { NavLink } from "react-router";
import { Icon, type IconName } from "./Icon";

const tabs: { to: string; label: string; icon: IconName; end?: boolean; dot?: boolean }[] = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/report", label: "Report", icon: "plusCircle", end: true },
  { to: "/messages", label: "Messages", icon: "message", dot: true },
  { to: "/claims", label: "My Claims", icon: "shield" },
  { to: "/account", label: "Account", icon: "user" },
];

/** Phone-only bottom navigation for students. Replaces the slide-out menu below 600px. */
export function TabBar({ waiting }: { waiting: number }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tabbar__tab ${isActive ? "is-active" : ""}`}>
          <span className="tabbar__icon">
            <Icon name={t.icon} size={24} />
            {t.dot && waiting > 0 && <span className="tabbar__dot" aria-label={`${waiting} waiting`} />}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
