import { useState } from "react";
import { BackButton, EmptyState, ItemCard, Loading, PageHead, toCard } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { listFoundItems, listPublicLostReports } from "../../data/api";
import { CATEGORIES, LOCATIONS } from "../../data/mock";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

/** Full lists behind "Found items >" and "Lost items >" on Home. */
export function AllItems({ kind }: { kind: "found" | "lost" }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");

  const found = useLoad(() => (kind === "found" ? listFoundItems({ q, category, location }) : Promise.resolve([])), [kind, q, category, location]);
  const lostAll = useLoad(() => (kind === "lost" ? listPublicLostReports() : Promise.resolve([])), [kind]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const lost = lostAll?.filter(
    (r) =>
      (!category || r.category === category) &&
      (!location || r.location === location) &&
      words.every((w) => `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(w)),
  );

  const rows =
    kind === "found"
      ? found?.map((i) => ({ key: i.id, date: i.foundOn, card: toCard(i, longDate(i.foundOn)) }))
      : lost?.map((r) => ({
          key: r.id,
          date: r.lostOn,
          card: { to: `/lost/${r.id}`, title: r.title, category: r.category, description: r.description, location: r.location, date: longDate(r.lostOn), photo: r.photo },
        }));
  const sorted = rows && [...rows].sort((a, b) => (sort === "new" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

  return (
    <div className="container stack-lg">
      <BackButton fallback="/home" />
      <PageHead
        title={kind === "found" ? "All found items" : "All lost items"}
        lead={
          kind === "found"
            ? "Everything the office is holding right now. Open an item to claim it."
            : "Items other students are looking for. If you found one, hand it to the office."
        }
      />
      <section className="search-panel" aria-label="Filter items">
        <div className="search-panel__row">
          <label className="search-input">
            <Icon name="search" size={20} />
            <span className="sr-only">Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "found" ? "Search found items..." : "Search lost items..."} />
          </label>
          <Filter label="Category" value={category} onChange={setCategory} all="All categories" options={CATEGORIES} />
          <Filter label="Location" value={location} onChange={setLocation} all="All locations" options={LOCATIONS} />
          <label className="filter">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
            <Icon name="chevronDown" size={18} />
          </label>
        </div>
      </section>
      {!sorted ? (
        <Loading />
      ) : (
        <>
          <p className="results-count">
            Showing {sorted.length} {kind === "found" ? "found" : "lost"} {sorted.length === 1 ? "item" : "items"}
          </p>
          {sorted.length ? (
            <div className="card-grid">
              {sorted.map((r) => (
                <ItemCard key={r.key} {...r.card} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing matches these filters." />
          )}
        </>
      )}
    </div>
  );
}

function Filter({ label, value, onChange, all, options }: { label: string; value: string; onChange: (v: string) => void; all: string; options: string[] }) {
  return (
    <label className="filter">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <Icon name="chevronDown" size={18} />
    </label>
  );
}
