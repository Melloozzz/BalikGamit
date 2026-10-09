import { useState } from "react";
import { Icon } from "../../components/Icon";
import { ModalLink } from "../../components/Modal";
import { Alert, BackButton, EmptyState, ItemBadge, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { OFFICE, daysHeld, disposeItem, extendHold, holdEnds, listDisposed, listUnclaimed } from "../../data/api";
import type { FoundItem } from "../../data/types";
import { longDate, shortDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

const EXTEND_DAYS = 30;

/** Found items past the holding period with no open claim: donate, dispose, or keep longer. */
export function Unclaimed() {
  const items = useLoad(() => listUnclaimed(), []);
  const done = useLoad(() => listDisposed(), []);
  const [msg, setMsg] = useState("");
  if (!items || !done) return <Loading />;

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin/items" />
      <PageHead
        eyebrow="HOLDING PERIOD"
        title="Unclaimed items"
        lead={`Items held longer than ${OFFICE.holdingDays} days with no open claim. Decide what happens to each one.`}
      />
      <Alert tone="info">
        The holding period is <b>{OFFICE.holdingDays} days</b> from the date an item was found [confirm with the office]. Items with an open claim never show
        here.
      </Alert>
      {msg && <Alert tone="success">{msg}</Alert>}
      {items.length === 0 ? (
        <EmptyState title="Nothing is past the holding period." />
      ) : (
        <ul className="stack">
          {items.map((i) => (
            <UnclaimedCard key={i.id} item={i} onDone={setMsg} />
          ))}
        </ul>
      )}
      <section className="table-card" aria-labelledby="done-h">
        <h2 id="done-h" className="table-card__title table-card__title--sm">
          Recently donated or disposed
        </h2>
        {done.length === 0 ? (
          <p className="muted table-card__empty">Nothing yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Outcome</th>
                  <th>Note</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {done.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <ModalLink to={`/admin/items/${i.id}`} className="cell-two">
                        <strong>{i.title}</strong>
                        <small>{i.id}</small>
                      </ModalLink>
                    </td>
                    <td>
                      <ItemBadge status={i.status} />
                    </td>
                    <td className="cell-note">{i.disposal!.note}</td>
                    <td>
                      <span className="cell-two">
                        <span>{i.disposal!.by}</span>
                        <small>{shortDate(i.disposal!.at)}</small>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UnclaimedCard({ item, onDone }: { item: FoundItem; onDone: (m: string) => void }) {
  const [mode, setMode] = useState<"donated" | "disposed" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const held = daysHeld(item);
  const over = held - OFFICE.holdingDays;

  async function confirm() {
    if (note.trim().length < 5) return setError(mode === "donated" ? "Say where it was donated." : "Say why it was disposed of.");
    try {
      await disposeItem(item.id, mode!, note.trim());
      onDone(`${item.title} (${item.id}) was marked as ${mode}.`);
    } catch (e) {
      // Ex. a student filed a claim after this page loaded.
      setError((e as Error).message);
    }
  }

  async function keepLonger() {
    try {
      await extendHold(item.id, EXTEND_DAYS);
      onDone(`${item.title} will be kept ${EXTEND_DAYS} more days.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <li className="unclaimed">
      <div className="unclaimed__row">
        <ItemPhoto src={item.photo} alt="" className="unclaimed__thumb" />
        <div className="unclaimed__main">
          <ModalLink to={`/admin/items/${item.id}`} className="unclaimed__title">
            {item.title}
          </ModalLink>
          <p className="unclaimed__meta">
            {item.id}
            {item.shelfTag && ` · Shelf ${item.shelfTag}`} · {item.category}
          </p>
          <p className="unclaimed__meta">
            Found {longDate(item.foundOn)} at {item.location} · held <b className="held--late">{held} days</b> ({over} past the limit
            {item.holdUntil ? `, kept until ${shortDate(holdEnds(item))}` : ""})
          </p>
        </div>
        {!mode && (
          <div className="unclaimed__actions">
            <button className="btn btn--outline-blue btn--sm" onClick={() => setMode("donated")}>
              <Icon name="gift" size={16} /> Donate
            </button>
            <button className="btn btn--outline-danger btn--sm" onClick={() => setMode("disposed")}>
              <Icon name="trash" size={16} /> Dispose
            </button>
            <button className="btn btn--outline btn--sm" onClick={keepLonger}>
              <Icon name="clock" size={16} /> Keep {EXTEND_DAYS} more days
            </button>
          </div>
        )}
      </div>
      {!mode && error && <Alert>{error}</Alert>}
      {mode && (
        <div className="unclaimed__confirm">
          <label className="field">
            <span className="field__label">{mode === "donated" ? "Where is it going?" : "Why is it being disposed of?"}</span>
            <textarea
              className="input textarea"
              rows={2}
              value={note}
              autoFocus
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "donated" ? "Ex. Given to the RTU Student Council donation drive" : "Ex. Broken and can't be reused"}
              aria-invalid={!!error}
            />
            {error && <span className="field__error">{error}</span>}
          </label>
          <p className="muted">This can’t be undone. Students won’t see the item anymore, and the record stays in the activity log.</p>
          <div className="form-buttons">
            <button className={`btn ${mode === "donated" ? "btn--blue" : "btn--danger"}`} onClick={confirm}>
              {mode === "donated" ? "Confirm donation" : "Confirm disposal"}
            </button>
            <button
              className="btn btn--outline"
              onClick={() => {
                setMode(null);
                setNote("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
