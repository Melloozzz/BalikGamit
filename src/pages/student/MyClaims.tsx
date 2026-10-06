import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { BackButton, ClaimBadge, EmptyState, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { itemFor, listMyClaims } from "../../data/api";
import { OFFICE } from "../../data/mock";
import type { Claim } from "../../data/types";
import { useAuth } from "../../auth/AuthContext";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

function subline(c: Claim) {
  switch (c.status) {
    case "pending":
      return `Filed ${longDate(c.filedOn)} · Waiting for the office to review`;
    case "approved":
      return `Pick up by ${longDate(c.pickupBy!)} at ${OFFICE.name}`;
    case "rejected":
      return c.decisionReason ?? "Rejected by the office";
    case "completed":
      return `Picked up ${longDate(c.history[c.history.length - 1].at)}`;
    default:
      return `Filed ${longDate(c.filedOn)}`;
  }
}

export function MyClaims() {
  const { user } = useAuth();
  const claims = useLoad(() => listMyClaims(user!.id), [user?.id]);
  if (!claims) return <Loading />;
  const needsInfo = claims.find((c) => c.status === "needs_info");

  return (
    <div className="container stack-lg">
      <BackButton fallback="/home" />
      <PageHead title="My claims" lead="Follow each claim and reply when the office has a question." />
      {needsInfo && (
        <div className="callout callout--amber">
          <Icon name="message" size={26} />
          <p>
            <b>The office has a question about your claim</b> for {itemFor(needsInfo.itemId)?.title}.
          </p>
          <Link to={`/claims/${needsInfo.id}`} className="btn btn--navy btn--sm">
            Reply now
          </Link>
        </div>
      )}
      {claims.length === 0 ? (
        <EmptyState title="You haven't made any claims yet.">
          Find your item on the <Link to="/home">Browse Items</Link> page and tap “This is mine”.
        </EmptyState>
      ) : (
        <ul className="row-list">
          {claims.map((c) => {
            const item = itemFor(c.itemId)!;
            return (
              <li key={c.id}>
                <Link to={`/claims/${c.id}`} className={`row-card ${c.status === "needs_info" ? "row-card--attention" : ""}`}>
                  <ItemPhoto src={item.photo} alt="" className="row-card__thumb" />
                  <div className="row-card__main">
                    <strong className="row-card__title">{item.title}</strong>
                    <span className="row-card__sub">
                      Claim {c.id} · {subline(c)}
                    </span>
                  </div>
                  <ClaimBadge status={c.status} />
                  <span className="row-card__view">
                    View <Icon name="chevronRight" size={18} strokeWidth={2} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
