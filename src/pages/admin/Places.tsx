import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { Alert, BackButton, PageHead } from "../../components/ui";
import { addPlace, listPlaces, renamePlace, setPlaceArchived, useDataVersion } from "../../data/api";

type Kind = "category" | "location";

/** Super admin: the lists behind every category and location dropdown. */
export function Places() {
  useDataVersion();
  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead
        eyebrow="SUPER ADMIN SETTINGS"
        title="Categories & locations"
        lead="These lists fill the dropdowns on every form and filter. Archive a name instead of deleting it, so old records keep their labels."
      />
      <div className="places-grid">
        <PlacePanel kind="category" title="Categories" sub="Used when logging found items, reporting lost items and filtering." />
        <PlacePanel kind="location" title="Locations" sub="Buildings and spots on the Pasig campus." />
      </div>
    </div>
  );
}

function PlacePanel({ kind, title, sub }: { kind: Kind; title: string; sub: string }) {
  const rows = listPlaces(kind);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const live = rows.filter((r) => !r.archived);
  const archived = rows.filter((r) => r.archived);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    if (await run(() => addPlace(kind, name))) setName("");
  }
  const usage = (r: { items: number; reports: number }) =>
    r.items + r.reports === 0 ? "Not used yet" : `${r.items} found item${r.items === 1 ? "" : "s"} · ${r.reports} lost report${r.reports === 1 ? "" : "s"}`;

  return (
    <section className="panel places" aria-labelledby={`${kind}-h`}>
      <div className="places__head">
        <h2 id={`${kind}-h`} className="places__title">
          {title} <span className="places__count">{live.length}</span>
        </h2>
        <p className="muted">{sub}</p>
      </div>
      <form className="places__add" onSubmit={add}>
        <label className="sr-only" htmlFor={`${kind}-new`}>
          New {kind} name
        </label>
        <input id={`${kind}-new`} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind} name`} maxLength={40} />
        <button className="btn btn--blue">
          <Icon name="plus" size={18} /> Add
        </button>
      </form>
      {error && <Alert>{error}</Alert>}
      <ul className="places__list">
        {live.map((r) => (
          <li key={r.name} className="place-row">
            {editing === r.name ? (
              <form
                className="place-row__edit"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => renamePlace(kind, r.name, draft))) setEditing(null);
                }}
              >
                <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus maxLength={40} aria-label={`Rename ${r.name}`} />
                <button className="btn btn--blue btn--sm">Save</button>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="place-row__main">
                  <strong>{r.name}</strong>
                  <small>{usage(r)}</small>
                </span>
                <button
                  className="icon-btn place-row__btn"
                  aria-label={`Rename ${r.name}`}
                  title="Rename"
                  onClick={() => {
                    setEditing(r.name);
                    setDraft(r.name);
                  }}
                >
                  <Icon name="edit" size={18} />
                </button>
                <button className="icon-btn place-row__btn" aria-label={`Archive ${r.name}`} title="Archive" onClick={() => run(() => setPlaceArchived(kind, r.name, true))}>
                  <Icon name="archive" size={18} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <>
          <h3 className="places__sub">Archived</h3>
          <ul className="places__list">
            {archived.map((r) => (
              <li key={r.name} className="place-row place-row--archived">
                <span className="place-row__main">
                  <strong>{r.name}</strong>
                  <small>{usage(r)} · hidden from dropdowns</small>
                </span>
                <button className="btn btn--outline btn--sm" onClick={() => run(() => setPlaceArchived(kind, r.name, false))}>
                  <Icon name="restore" size={16} /> Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
