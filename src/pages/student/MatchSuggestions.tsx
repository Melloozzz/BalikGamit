import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { BackLink, EmptyState, ItemPhoto, LikelihoodBadge, Loading } from "../../components/ui";
import { getMatches, getReport } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function MatchSuggestions() {
  const { reportId = "" } = useParams();
  const report = useLoad(() => getReport(reportId), [reportId]);
  const matches = useLoad(() => getMatches(reportId), [reportId]);
  if (report === undefined || matches === undefined) return <Loading />;
  if (report === null)
    return (
      <div className="container">
        <BackLink to="/reports">My reports</BackLink>
        <EmptyState title="We couldn't find that report." />
      </div>
    );

  return (
    <div className="container stack-lg">
      <BackLink to="/reports">My reports</BackLink>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title">Possible matches</h1>
          <p className="page-lead">
            Items in Office custody that may be your <b className="navy">{report.title}</b>, most likely first.
          </p>
        </div>
      </header>
      <p className="ai-note">
        <Icon name="sparkle" size={20} /> These suggestions come from AI and may be wrong. The office checks every claim before releasing an
        item.
      </p>
      {matches.length === 0 ? (
        <EmptyState title="No possible matches yet.">We'll notify you when a found item looks like yours.</EmptyState>
      ) : (
        <ol className="stack">
          {matches.map((m) => (
            <li key={m.item.id} className={`match-card ${m.likelihood === "high" ? "match-card--top" : ""}`}>
              <ItemPhoto src={m.item.photo} alt={m.item.title} className="match-card__photo" />
              <div className="match-card__main">
                <p className="match-card__badges">
                  <LikelihoodBadge value={m.likelihood} />
                  <span className="muted">
                    #{m.rank} · Item {m.item.id}
                  </span>
                </p>
                <h2 className="match-card__title">{m.item.title}</h2>
                <p className="muted">
                  Found in {m.item.location} · {longDate(m.item.foundOn)}
                </p>
                <p className="why-box">
                  <b className="navy">Why it may match:</b> {m.why}
                  {m.but && (
                    <>
                      {" "}
                      <b className="amber-text">But:</b> {m.but}
                    </>
                  )}
                </p>
              </div>
              <div className="match-card__actions">
                <Link to={`/items/${m.item.id}/claim`} className="btn btn--navy btn--block">
                  This is mine
                </Link>
                <Link to={`/items/${m.item.id}`} className="btn btn--outline btn--block">
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="dashed-box">
        <div>
          <p className="dashed-box__title">None of these are yours?</p>
          <p className="muted">Your report stays active. We'll notify you when a new possible match is logged.</p>
        </div>
        <Link to="/home">Browse all found items</Link>
      </div>
    </div>
  );
}
