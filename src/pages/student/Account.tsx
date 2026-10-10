import { Link, useNavigate } from "react-router";
import { Icon, type IconName } from "../../components/Icon";
import { Loading } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { listMyReports, unreadCount } from "../../data/api";
import { useLoad } from "../../lib/useLoad";

/** Phone "Account" tab: everything that left the menu (reports, notifications, settings) in one list. */
export function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const reports = useLoad(() => (user ? listMyReports(user.id) : Promise.resolve([])), [user?.id]);
  // Hooks stay above the early return. The layout's live subscription refreshes this count.
  const unread = useLoad(() => unreadCount(), []) ?? 0;
  if (!user || !reports) return <Loading />;
  const initials = user.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  const Row = ({ to, icon, label, count, badge }: { to: string; icon: IconName; label: string; count?: number; badge?: number }) => (
    <Link to={to} className="account__row">
      <Icon name={icon} size={22} />
      <span className="account__label">{label}</span>
      {count !== undefined && <span className="account__count">{count}</span>}
      {badge ? <span className="account__badge">{badge}</span> : null}
      <Icon name="chevronRight" size={18} />
    </Link>
  );

  return (
    <div className="account">
      <header className="account__head">
        <span className="account__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="account__who">
          <strong>{user.fullName}</strong>
          <span>{user.email}</span>
        </span>
      </header>
      <div className="account__body">
        <nav className="account__group" aria-label="Your activity">
          <Row to="/reports" icon="report" label="My reports" count={reports.length} />
          <Row to="/notifications" icon="bell" label="Notifications" badge={unread} />
        </nav>
        <nav className="account__group" aria-label="Account">
          <Row to="/profile" icon="user" label="My profile" />
          <Row to="/settings" icon="settings" label="Settings" />
          <Row to="/privacy" icon="shield" label="Privacy Notice" />
          <Row to="/terms" icon="claims" label="Terms of Use" />
        </nav>
        <button
          className="account__signout"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          <Icon name="logout" size={20} /> Sign out
        </button>
      </div>
    </div>
  );
}
