import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { EmptyState, ItemCard, Loading, toCard } from "../../components/ui";
import { aiSearch, listFoundItems, listPublicLostReports } from "../../data/api";
import { CATEGORIES, LOCATIONS } from "../../data/mock";
import type { FoundItem } from "../../data/types";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

const sinceFor = (range: string) => {
  if (!range) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - Number(range));
  return d.toLocaleDateString("en-CA");
};

export function Home() {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [range, setRange] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<FoundItem[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const found = useLoad(() => listFoundItems({ q, category, location, since: sinceFor(range) }), [q, category, location, range]);
  const lost = useLoad(() => listPublicLostReports(), []);

  async function runAi(e: FormEvent) {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiBusy(true);
    setAiResults(await aiSearch(aiQuery));
    setAiBusy(false);
  }

  return (
    <div className="container stack-lg">
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title page-title--xl">Browse Items</h1>
          <p className="page-lead">Search through all approved lost and found items on campus.</p>
        </div>
      </header>

      {mode === "manual" ? (
        <section className="search-panel" aria-label="Manual search">
          <div className="search-panel__top">
            <h2 className="search-panel__label">Manual Search</h2>
            <button className="mode-switch" onClick={() => setMode("ai")}>
              AI-Powered Search
              <span className="mode-switch__icon">
                <Icon name="sparkle" size={18} />
              </span>
            </button>
          </div>
          <div className="search-panel__row">
            <label className="search-input">
              <Icon name="search" size={20} />
              <span className="sr-only">Search items</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items..." />
            </label>
            <FilterSelect label="Category" value={category} onChange={setCategory} all="All categories" options={CATEGORIES} />
            <FilterSelect label="Location" value={location} onChange={setLocation} all="All locations" options={LOCATIONS} />
            <FilterSelect
              label="Date"
              value={range}
              onChange={setRange}
              all="Any date"
              options={["7", "30", "90"]}
              labels={{ "7": "Past 7 days", "30": "Past 30 days", "90": "Past 90 days" }}
            />
          </div>
        </section>
      ) : (
        <section className="search-panel search-panel--ai" aria-label="AI-powered search">
          <div className="search-panel__top">
            <h2 className="search-panel__label">
              <Icon name="sparkle" size={20} /> AI-Powered Search
            </h2>
            <button className="mode-switch mode-switch--round" onClick={() => setMode("manual")} aria-label="Switch to manual search">
              <Icon name="search" size={18} />
            </button>
          </div>
          <p className="search-panel__hint">Describe what you’re looking for and our AI will find the best matches.</p>
          <form className="search-panel__row" onSubmit={runAi}>
            <label className="search-input search-input--grow">
              <span className="sr-only">Describe your item</span>
              <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ex. I lost a black wallet near the library..." />
            </label>
            <button className="btn btn--navy" disabled={aiBusy}>
              <Icon name="sparkle" size={18} /> {aiBusy ? "Searching…" : "Search"}
            </button>
          </form>
        </section>
      )}

      {mode === "ai" && aiResults ? (
        <section className="stack">
          <p className="results-count">Showing {aiResults.length} items</p>
          {aiResults.length ? (
            <div className="card-grid">
              {aiResults.map((i) => (
                <ItemCard key={i.id} {...toCard(i, longDate(i.foundOn))} />
              ))}
            </div>
          ) : (
            <EmptyState title="No close matches yet.">Try different words, or report your lost item so we can notify you when it turns up.</EmptyState>
          )}
        </section>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  all,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="filter">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={18} />
    </label>
  );
}
