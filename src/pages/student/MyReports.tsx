import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackButton, CategoryPill, EmptyState, Loading, PageHead, ReportBadge } from "../../components/ui";
import { listMyReports, setReportStatus } from "../../data/api";
import type { LostReport } from "../../data/types";
import { useAuth } from "../../auth/AuthContext";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import { useAction } from "../../lib/useAction";

const TABS = [
  { key: "all", label: "All", test: () => true },
  { key: "active", label: "Active", test: (r: LostReport) => r.status === "active" },
  { key: "resolved", label: "Resolved", test: (r: LostReport) => r.status === "resolved" || r.status === "closed" },
  { key: "attention", label: "Needs attention", test: (r: LostReport) => r.status === "expired" || r.status === "hidden" },
] as const;

export function MyReports() {
  const { user } = useAuth();
  const reports = useLoad(() => listMyReports(user!.id), [user?.id]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const action = useAction();
  if (!reports) return <Loading />;
  const shown = reports.filter(TABS.find((t) => t.key === tab)!.test);

  return (
    <div className="container stack-lg">
      <BackButton fallback="/home" />
      <PageHead
        title="My reports"
        lead="Track report status and review possible matches from items in Office custody."
        actions={
          <Link to="/report" className="btn btn--navy">
            <Icon name="plus" size={20} /> Report a lost item
          </Link>
        }
      />
      {action.error && <Alert>{action.error}</Alert>}
      <div className="tabs" role="tablist" aria-label="Filter reports">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? "is-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} ({reports.filter(t.test).length})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nothing here.">Reports you file will show up in this list.</EmptyState>
      ) : (
        <ul className="stack">
          {shown.map((r) => (
            <li key={r.id} className="report-card">
              <div className="report-card__main">
                <div className="report-card__badges">
                  <CategoryPill>{r.category}</CategoryPill>
                  <ReportBadge status={r.status} />
                </div>
                <h2 className="report-card__title">{r.title}</h2>
                <p>{r.description}</p>
                <p className="meta-line">
                  <span>
                    <Icon name="pin" size={18} /> {r.location}
                  </span>
                  <span>
                    <Icon name="calendar" size={18} /> Lost {longDate(r.lostOn)}
                  </span>
                </p>
              </div>
              <div className="report-card__side">
                <ReportActions r={r} action={action} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportActions({ r, action }: { r: LostReport; action: ReturnType<typeof useAction> }) {
  if (r.status === "active")
    return (
      <>
        {r.matchCount > 0 ? (
          <>
            <p className="match-chip">
              <Icon name="search" size={20} /> {r.matchCount} possible matches found
            </p>
            <Link to={`/reports/${r.id}/matches`} state={{ from: "/reports" }} className="btn btn--navy btn--block">
              View matches
            </Link>
          </>
        ) : (
          <p className="side-note">No matches yet. We'll notify you when a possible match is logged.</p>
        )}
        <div className="report-card__row">
          <Link to={`/report?edit=${r.id}`} state={{ from: "/reports" }} className="btn btn--outline btn--sm">
            Edit
          </Link>
          <button className="link-btn" disabled={action.busy} onClick={() => action.run(() => setReportStatus(r.id, "resolved"))}>
            I found it myself
          </button>
        </div>
      </>
    );
  if (r.status === "expired")
    return (
      <>
        <p className="side-note">{r.statusNote}</p>
        <button className="btn btn--navy btn--block" disabled={action.busy} onClick={() => action.run(() => setReportStatus(r.id, "active"))}>
          Renew report
        </button>
      </>
    );
  if (r.status === "hidden")
    return (
      <>
        <p className="side-note side-note--danger">{r.statusNote}</p>
        <Link to={`/report?edit=${r.id}`} state={{ from: "/reports" }} className="btn btn--outline btn--block">
          Edit report
        </Link>
      </>
    );
  return <p className="side-note">{r.statusNote ?? "This report is closed."}</p>;
}
