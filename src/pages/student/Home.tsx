import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { Filter } from "../../components/Filters";
import { EmptyState, ItemCard, Loading, toCard } from "../../components/ui";
import { CATEGORIES, LOCATIONS, listFoundItems, listPublicLostReports } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import { AttentionStrip } from "./AttentionStrip";

const sinceFor = (range: string) => {
  if (!range) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - Number(range));
  return d.toLocaleDateString("en-CA");
};

export function Home() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [range, setRange] = useState("");

  const found = useLoad(() => listFoundItems({ q, category, location, since: sinceFor(range) }), [q, category, location, range]);
  const lost = useLoad(() => listPublicLostReports(), []);

  return (
    <div className="container stack-lg home">
      <header className="page-head home__head">
        <div className="page-head__text">
          <h1 className="page-title page-title--xl">Browse Items</h1>
          <p className="page-lead">Search through all approved lost and found items on campus.</p>
        </div>
      </header>

      <section className="search-panel" aria-label="Search">
        <h2 className="search-panel__label">Search</h2>
        <div className="search-panel__row">
          <label className="search-input">
            <Icon name="search" size={20} />
            <span className="sr-only">Search items</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items..." />
          </label>
          <div className="search-panel__filters">
            <Filter label="Category" value={category} onChange={setCategory} all="All categories" options={CATEGORIES} />
            <Filter label="Location" value={location} onChange={setLocation} all="All locations" options={LOCATIONS} />
            <Filter
              label="Date"
              value={range}
              onChange={setRange}
              all="Any date"
              options={[
                { value: "7", label: "Past 7 days" },
                { value: "30", label: "Past 30 days" },
                { value: "90", label: "Past 90 days" },
              ]}
            />
          </div>
        </div>
      </section>

      <AttentionStrip />

      <section className="stack" aria-labelledby="found-h">
        <div className="section-head">
          <h2 id="found-h" className="section-label">
            <Link to="/items" className="section-link">
              Found items <Icon name="chevronRight" size={16} />
            </Link>
          </h2>
          {found && found.length > 6 && (
            <Link to="/items" className="section-head__all">
              View all {found.length}
            </Link>
          )}
        </div>
        {!found ? (
          <Loading />
        ) : found.length ? (
          <div className="card-grid">
            {found.slice(0, 6).map((i) => (
              <ItemCard key={i.id} {...toCard(i, longDate(i.foundOn))} />
            ))}
          </div>
        ) : (
          <EmptyState title="No found items match these filters." />
        )}
      </section>
      <section className="stack" aria-labelledby="lost-h">
        <div className="section-head">
          <h2 id="lost-h" className="section-label">
            <Link to="/lost" className="section-link">
              Lost items <Icon name="chevronRight" size={16} />
            </Link>
          </h2>
          {lost && lost.length > 3 && (
            <Link to="/lost" className="section-head__all">
              View all {lost.length}
            </Link>
          )}
        </div>
        {!lost ? (
          <Loading />
        ) : (
          <div className="card-grid">
            {lost.slice(0, 3).map((r) => (
              <ItemCard
                key={r.id}
                to={`/lost/${r.id}`}
                title={r.title}
                category={r.category}
                description={r.description}
                location={r.location}
                date={longDate(r.lostOn)}
                photo={r.photo}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
