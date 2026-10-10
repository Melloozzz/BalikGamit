import { Link } from "react-router";
import { Icon, type IconName } from "../../components/Icon";
import { ClaimBadge, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { getDashboardCounts, listAllClaims } from "../../data/api";
import { shortDate, timeOfDayGreeting } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function Dashboard() {
  const claims = useLoad(() => listAllClaims(), []);
  const counts = useLoad(() => getDashboardCounts(), []);
  if (!claims || !counts) return <Loading />;
  const stats: { icon: IconName; n: number; label: string; to?: string }[] = [
    { icon: "box", n: counts.inCustody, label: "Items in custody", to: "/admin/items" },
    { icon: "clock", n: counts.claimsToAct, label: "Claims needing action", to: "/admin/claims" },
    { icon: "flag", n: counts.flagged, label: "Flagged posts", to: "/admin/flagged" },
  ];

  return (
    <div className="container stack-lg dash">
      <PageHead
        eyebrow="OFFICE WORKSPACE"
        title={timeOfDayGreeting()}
        lead="Here’s what needs attention across BalikGamit today."
        actions={
          <Link to="/admin/log-item" className="btn btn--blue btn--lg">
            <Icon name="plusCircle" size={22} /> Log Found Item
          </Link>
        }
      />
      <div className="stat-grid">
        {stats.map((s) => {
          const body = (
            <>
              <span className="stat__icon">
                <Icon name={s.icon} size={20} />
              </span>
              {s.to && <Icon name="arrowRight" size={20} className="stat__arrow" />}
              <strong className="stat__n">{s.n}</strong>
              <span className="stat__label">{s.label}</span>
            </>
          );
          return s.to ? (
            <Link key={s.label} to={s.to} className="stat">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="stat">
              {body}
            </div>
          );
        })}
      </div>
      <section className="table-card" aria-labelledby="rc">
        <div className="dash__rc-head">
          <h2 id="rc" className="table-card__title">
            Recent Claims
          </h2>
          <Link to="/admin/claims" className="dash__all">
            View all
          </Link>
        </div>
        <ul>
          {claims.slice(0, 5).map((c) => {
            const item = c.item;
            return (
              <li key={c.id}>
                <Link to={`/admin/claims/${c.id}`} className="recent-row">
                  <ItemPhoto src={item.photo} alt="" className="recent-row__thumb" />
                  <span className="recent-row__main">
                    <strong>{item.title}</strong>
                    <span>
                      {c.claimant?.fullName} · {shortDate(c.filedOn)}
                    </span>
                  </span>
                  <ClaimBadge status={c.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
