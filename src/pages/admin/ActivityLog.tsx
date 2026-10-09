import { useState } from "react";
import { Link } from "react-router";
import { Icon, type IconName } from "../../components/Icon";
import { Filter, SearchBox } from "../../components/Filters";
import { initials } from "../../components/ProfileMenu";
import { BackButton, EmptyState, Loading, PageHead } from "../../components/ui";
import { listActivity } from "../../data/api";
import type { Activity } from "../../data/types";
import { longDate, todayIso } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

const KIND: Record<Activity["kind"], { label: string; icon: IconName }> = {
  logged: { label: "Logged items", icon: "plusCircle" },
  edited: { label: "Edited items", icon: "edit" },
  approved: { label: "Approved claims", icon: "checkCircle" },
  rejected: { label: "Rejected claims", icon: "x" },
  asked: { label: "Messages to claimants", icon: "message" },
  released: { label: "Released items", icon: "release" },
  returned_to_custody: { label: "Back on the shelf", icon: "box" },
  hid: { label: "Hid reports", icon: "eyeOff" },
  unhid: { label: "Unhid reports", icon: "eye" },
  donated: { label: "Donated items", icon: "gift" },
  disposed: { label: "Disposed items", icon: "trash" },
  extended: { label: "Kept longer", icon: "clock" },
  places: { label: "Categories & locations", icon: "tag" },
  admins: { label: "Office accounts", icon: "users" },
};
const TZ = "Asia/Manila";
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** Audit trail of office actions. Read-only: rows come from a database trigger. */
export function ActivityLog() {
  const rows = useLoad(() => listActivity(), []);
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [kind, setKind] = useState("");
  if (!rows) return <Loading />;

  const people = [...new Set(rows.map((r) => r.actor))].sort();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(
    (r) =>
      (!who || r.actor === who) &&
      (!kind || r.kind === kind) &&
      words.every((w) => `${r.actor} ${r.text} ${r.subject ?? ""}`.toLowerCase().includes(w)),
  );
  const days = new Map<string, Activity[]>();
  for (const r of shown) days.set(dayOf(r.at), [...(days.get(dayOf(r.at)) ?? []), r]);
  const today = todayIso();

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin/settings" />
      <PageHead eyebrow="AUDIT TRAIL" title="Activity log" lead="Every office action, newest first. Entries are recorded automatically and can’t be edited or deleted." />
      <section className="search-panel" aria-label="Filter activity">
        <div className="search-panel__row">
          <SearchBox value={q} onChange={setQ} placeholder="Search by item, claim ID or name..." />
          <Filter label="Person" value={who} onChange={setWho} all="Everyone" options={people} />
          <Filter
            label="Action"
            value={kind}
            onChange={setKind}
            all="All actions"
            options={Object.entries(KIND).map(([value, k]) => ({ value, label: k.label }))}
          />
        </div>
      </section>
      {shown.length === 0 ? (
        <EmptyState title="No activity matches these filters." />
      ) : (
        [...days].map(([day, list]) => (
          <section key={day} className="activity-day" aria-label={longDate(day)}>
            <h2 className="activity-day__h">{day === today ? `Today · ${longDate(day)}` : longDate(day)}</h2>
            <ul className="activity">
              {list.map((r) => {
                const body = (
                  <>
                    <span className="activity__time">{timeOf(r.at)}</span>
                    <span className="activity__avatar" aria-hidden>
                      {initials(r.actor)}
                    </span>
                    <span className="activity__main">
                      <span>
                        <strong>{r.actor}</strong> {r.text}
                      </span>
                      {r.subject && <small>{r.subject}</small>}
                    </span>
                    <span className="activity__kind" title={KIND[r.kind].label}>
                      <Icon name={KIND[r.kind].icon} size={18} />
                    </span>
                    {r.href ? <Icon name="chevronRight" size={18} className="activity__go" /> : <span className="activity__go" />}
                  </>
                );
                return (
                  <li key={r.id}>
                    {r.href ? (
                      <Link to={r.href} state={r.href.match(/^\/admin\/(items|lost)\//) ? { background: { pathname: "/admin/activity", search: "", hash: "", state: null, key: "act" } } : undefined} className="activity__row">
                        {body}
                      </Link>
                    ) : (
                      <div className="activity__row">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
