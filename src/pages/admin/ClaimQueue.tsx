import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { BackButton, ClaimBadge, EmptyState, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { listAllClaims } from "../../data/api";
import { shortDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function ClaimQueue() {
  const claims = useLoad(() => listAllClaims(), []);
  const [view, setView] = useState<"open" | "all">("open");
  if (!claims) return <Loading />;
  const open = claims.filter((c) => c.status === "pending" || c.status === "needs_info" || c.status === "approved");
  const shown = view === "open" ? open : claims;

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead eyebrow="OFFICE REVIEW" title="Claim Queue" lead="Review proof answers against private intake details before deciding." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "open"} className={`tab tab--blue ${view === "open" ? "is-active" : ""}`} onClick={() => setView("open")}>
          Needs action ({open.length})
        </button>
        <button role="tab" aria-selected={view === "all"} className={`tab tab--blue ${view === "all" ? "is-active" : ""}`} onClick={() => setView("all")}>
          All ({claims.length})
        </button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No claims waiting." />
      ) : (
        <div className="table-card table-scroll">
          <table className="table table--stack">
            <thead>
              <tr>
                <th>Item</th>
                <th>Claimant</th>
                <th>Date filed</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const item = c.item;
                const who = c.claimant;
                const to = c.status === "approved" ? `/admin/claims/${c.id}/release` : `/admin/claims/${c.id}`;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link to={to} state={{ from: "/admin/claims" }} className="cell-item">
                        <ItemPhoto src={item.photo} alt="" className="cell-item__thumb" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {c.id} · {item.id}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="cell-two">
                        <span>{who?.fullName}</span>
                        <small>{who?.email}</small>
                      </span>
                    </td>
                    <td>{shortDate(c.filedOn)}</td>
                    <td>
                      <ClaimBadge status={c.status} />
                    </td>
                    <td>
                      <Link to={to} state={{ from: "/admin/claims" }} aria-label={`Open ${c.id}`} className="icon-btn">
                        <Icon name="chevronRight" size={20} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
