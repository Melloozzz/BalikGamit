import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { initials } from "../../components/ProfileMenu";
import { BackButton, PageHead } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { OFFICE, getProfileStats } from "../../data/api";
import { useLoad } from "../../lib/useLoad";
import { longDate } from "../../lib/format";

const roleLabel = { student: "Student", faculty: "Faculty", staff: "Staff", admin: "Admin", super_admin: "Super admin" } as const;

/** "View profile" from the account menu. Read-only summary; edits happen in Settings. */
export function ProfilePage({ area }: { area: "student" | "office" }) {
  const { user } = useAuth();
  const stats = useLoad(() => (user ? getProfileStats(user) : Promise.resolve([])), [user?.id]) ?? [];
  if (!user) return null;
  const office = area === "office";
  const base = office ? "/admin" : "";

  return (
    <div className={`container container--mid stack-lg ${office ? "" : ""}`}>
      <BackButton fallback={office ? "/admin" : "/home"} />
      <PageHead eyebrow={office ? "OFFICE ACCOUNT" : undefined} title="My profile" lead="How your account appears in BalikGamit." />

      <section className={`profile-card ${office ? "profile-card--office" : ""}`} aria-label="Account summary">
        <span className="profile-card__avatar" aria-hidden>
          {initials(user.fullName)}
        </span>
        <div className="profile-card__who">
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
          <div className="row-wrap">
            <span className="profile-card__role">{roleLabel[user.role]}</span>
            {user.joinedOn && <span className="profile-card__since">Member since {longDate(user.joinedOn)}</span>}
          </div>
        </div>
        <Link to={`${base}/settings`} className={`btn ${office ? "btn--blue" : "btn--navy"}`}>
          <Icon name="settings" size={18} /> Edit in Settings
        </Link>
      </section>

      <ul className="profile-stats">
        {stats.map((s) => (
          <li key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>

      <section className={`panel ${office ? "panel--white" : "panel--gray"}`} aria-labelledby="acct">
        <h2 id="acct" className="panel__title">
          Account details
        </h2>
        <dl className="kv">
          <div>
            <dt>Full name</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt>RTU email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel[user.role]}</dd>
          </div>
          {office ? (
            <div>
              <dt>Office</dt>
              <dd>{OFFICE.name}</dd>
            </div>
          ) : (
            <div>
              <dt>Sign-in</dt>
              <dd>RTU email and password</dd>
            </div>
          )}
        </dl>
        {office ? (
          <p className="field__hint">
            {user.role === "super_admin"
              ? "Super admins can log items, review claims, moderate posts, and add or deactivate admins."
              : "Admins can log items, review claims, and moderate posts. Only a super admin can change roles."}
          </p>
        ) : (
          <p className="field__hint">Your student number is never stored. Other students never see your name or email.</p>
        )}
      </section>

      {!office && (
        <nav className="profile-links" aria-label="Your activity">
          <Link to="/reports">
            <Icon name="report" size={20} /> My reports <Icon name="chevronRight" size={18} />
          </Link>
          <Link to="/claims">
            <Icon name="shield" size={20} /> My claims <Icon name="chevronRight" size={18} />
          </Link>
          <Link to="/notifications">
            <Icon name="bell" size={20} /> Notifications & messages <Icon name="chevronRight" size={18} />
          </Link>
        </nav>
      )}
    </div>
  );
}
