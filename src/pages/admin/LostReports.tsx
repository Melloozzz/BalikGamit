import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { ModalLink } from "../../components/Modal";
import { Filter, SearchBox, Tabs } from "../../components/Filters";
import { BackButton, EmptyState, ItemPhoto, Loading, PageHead, ReportBadge } from "../../components/ui";
import { dashboardCounts, listAllLostReports } from "../../data/api";
import { CATEGORIES, LOCATIONS } from "../../data/mock";
import type { LostReportStatus } from "../../data/types";
import { shortDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type View = "active" | "hidden" | "done" | "expired" | "all";
const IN_VIEW: Record<View, (s: LostReportStatus) => boolean> = {
  active: (s) => s === "active",
  hidden: (s) => s === "hidden",
  done: (s) => s === "resolved" || s === "closed",
  expired: (s) => s === "expired",
  all: () => true,
};

/** Office view of every lost report students have posted. */
export function LostReports() {
  const reports = useLoad(() => listAllLostReports(), []);
  const [view, setView] = useState<View>("active");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  if (!reports) return <Loading />;

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = reports.filter(
    (r) =>
      (!category || r.category === category) &&
      (!location || r.location === location) &&
      words.every((w) => `${r.id} ${r.title} ${r.description} ${r.owner?.fullName ?? ""} ${r.owner?.email ?? ""}`.toLowerCase().includes(w)),
  );
  const shown = filtered.filter((r) => IN_VIEW[view](r.status));
  const count = (k: View) => filtered.filter((r) => IN_VIEW[k](r.status)).length;
  const flagged = dashboardCounts().flagged;

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead eyebrow="STUDENT POSTS" title="Lost reports" lead="Every lost report students have posted. Open one to see the owner’s private details and possible matches." />
      {flagged > 0 && (
        <Link to="/admin/flagged" className="notice-bar notice-bar--flag">
          <Icon name="flag" size={20} />
          <span>
            <strong>
              {flagged} {flagged === 1 ? "report was" : "reports were"} flagged by students
            </strong>{" "}
            and still visible. Review them before they stay up longer.
          </span>
          <Icon name="arrowRight" size={20} className="notice-bar__arrow" />
        </Link>
      )}
      <section className="search-panel" aria-label="Filter lost reports">
        <div className="search-panel__row">
          <SearchBox value={q} onChange={setQ} placeholder="Search by item, ID, owner name or email..." />
          <Filter label="Category" value={category} onChange={setCategory} all="All categories" options={CATEGORIES} />
          <Filter label="Location" value={location} onChange={setLocation} all="All locations" options={LOCATIONS} />
        </div>
      </section>
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { key: "active", label: "Active", count: count("active") },
          { key: "hidden", label: "Hidden", count: count("hidden") },
          { key: "done", label: "Resolved", count: count("done") },
          { key: "expired", label: "Expired", count: count("expired") },
          { key: "all", label: "All", count: filtered.length },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title="No reports match these filters." />
      ) : (
        <div className="table-card table-scroll">
          <table className="table table--stack">
            <thead>
              <tr>
                <th>Report</th>
                <th>Owner</th>
                <th>Last seen</th>
                <th>Matches</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <ModalLink to={`/admin/lost/${r.id}`} className="cell-item">
                      <ItemPhoto src={r.photo} alt="" className="cell-item__thumb" />
                      <span>
                        <strong>{r.title}</strong>
                        <small>
                          {r.id} · {r.category}
                        </small>
                      </span>
                    </ModalLink>
                  </td>
                  <td>
                    <span className="cell-two">
                      <span>{r.owner?.fullName}</span>
                      <small>{r.owner?.email}</small>
                    </span>
                  </td>
                  <td>
                    <span className="cell-two">
                      <span>{r.location}</span>
                      <small>{shortDate(r.lostOn)}</small>
                    </span>
                  </td>
                  <td>
                    <span className={r.matchCount ? "held" : "held muted"}>{r.matchCount || "None"}</span>
                  </td>
                  <td>
                    <span className="cell-badges">
                      <ReportBadge status={r.status} />
                      {r.flags > 0 && (
                        <span className="flag-count" title={`${r.flags} flag${r.flags === 1 ? "" : "s"} from students`}>
                          <Icon name="flag" size={12} strokeWidth={2.4} /> {r.flags}
                        </span>
                      )}
                    </span>
                  </td>
                  <td>
                    <ModalLink to={`/admin/lost/${r.id}`} aria-label={`Open ${r.id}`} className="icon-btn">
                      <Icon name="chevronRight" size={20} />
                    </ModalLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
