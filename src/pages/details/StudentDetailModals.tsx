import { useState } from "react";
import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { Alert, CategoryPill, ItemPhoto, Loading } from "../../components/ui";
import { OFFICE, flagReport, getFoundItem, getPublicLostReport, isClaimable, listMyClaims } from "../../data/api";
import type { FlagReason } from "../../data/types";
import { useAuth } from "../../auth/AuthContext";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

function Facts({ rows }: { rows: { icon: "pin" | "calendar" | "hash"; label: string; value: string }[] }) {
  return (
    <dl className="facts">
      {rows.map((r) => (
        <div key={r.label}>
          <Icon name={r.icon} size={18} />
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FoundItemModal() {
  const { itemId = "" } = useParams();
  const { user } = useAuth();
  const item = useLoad(() => getFoundItem(itemId), [itemId]);
  const myClaims = useLoad(() => listMyClaims(user!.id), [user?.id]);
  if (item === undefined) return <Loading />;
  if (!item)
    return (
      <Modal label="Item not found" eyebrow="FOUND ITEM" title="This item isn't listed anymore.">
        <p className="muted">It may have been returned to its owner.</p>
      </Modal>
    );
  const open = myClaims?.find((c) => c.itemId === item.id && !["rejected", "withdrawn", "expired"].includes(c.status));
  const gone = item.status === "donated" || item.status === "disposed";
  return (
    <Modal label={`Found item ${item.title}`} eyebrow={`FOUND ITEM · ${item.id}`} title={item.title}>
      <div className="modal-detail">
        <ItemPhoto src={item.photo} alt={item.title} className="modal-detail__photo" />
        <div className="modal-detail__info">
          <CategoryPill>{item.category}</CategoryPill>
          <p className="modal-detail__desc">
            {item.description}
            {!gone && " It is secured by the campus Office while ownership is verified."}
          </p>
          <Facts
            rows={[
              { icon: "pin", label: "FOUND AT", value: item.location },
              { icon: "calendar", label: "DATE FOUND", value: longDate(item.foundOn) },
            ]}
          />
        </div>
      </div>
      <div className="modal-detail__foot">
        {!gone && (
          <div className="think-box">
            <p className="think-box__title">
              <Icon name="shield" size={18} /> Think it’s yours?
            </p>
            <p>Answer a few questions only the owner would know. The office checks them against details recorded at intake.</p>
          </div>
        )}
        <div className="modal-detail__cta">
          {open ? (
            <Link to={`/claims/${open.id}`} className="btn btn--navy btn--block btn--lg">
              View your claim ({open.id})
            </Link>
          ) : gone ? (
            <p className="muted">The office no longer has this item. It was {item.status} after the holding period.</p>
          ) : !isClaimable(item) ? (
            <p className="muted">This item is already being returned to its owner.</p>
          ) : (
            <Link to={`/items/${item.id}/claim`} className="btn btn--navy btn--block btn--lg">
              This is mine
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function LostItemModal() {
  const { reportId = "" } = useParams();
  const { user } = useAuth();
  const report = useLoad(() => getPublicLostReport(reportId, user?.id), [reportId, user?.id]);
  const [reporting, setReporting] = useState(false);
  if (report === undefined) return <Loading />;
  if (!report)
    return (
      <Modal label="Report not found" eyebrow="LOST ITEM" title="This report isn't listed anymore.">
        <p className="muted">The owner may have found it, or the report expired.</p>
      </Modal>
    );
  if (reporting)
    return (
      <Modal narrow label={`Report the post ${report.title}`} eyebrow={`REPORT THIS POST · ${report.id}`} title={report.title}>
        <ReportPostForm reportId={report.id} userId={user!.id} onBack={() => setReporting(false)} />
      </Modal>
    );
  return (
    <Modal label={`Lost item ${report.title}`} eyebrow={`LOST ITEM · ${report.id}`} title={report.title}>
      <div className="modal-detail">
        <ItemPhoto src={report.photo} alt={report.title} className="modal-detail__photo" />
        <div className="modal-detail__info">
          <CategoryPill>{report.category}</CategoryPill>
          <p className="modal-detail__desc">{report.description}</p>
          <Facts
            rows={[
              { icon: "pin", label: "LAST SEEN AT", value: report.location },
              { icon: "calendar", label: "DATE LOST", value: longDate(report.lostOn) },
            ]}
          />
        </div>
      </div>
      <div className="modal-detail__foot">
        <div className="think-box">
          <p className="think-box__title">
            <Icon name={report.mine ? "info" : "bagUp"} size={18} /> {report.mine ? "This is your report" : "Found this item?"}
          </p>
          <p>
            {report.mine
              ? "Other students see it without your name. We’ll notify you when a possible match is logged."
              : `Bring it to ${OFFICE.name}. The office logs it and matches it to this report. Please don’t contact the owner directly.`}
          </p>
        </div>
        <div className="modal-detail__cta">
          {report.mine ? (
            <Link to="/reports" className="btn btn--navy btn--block btn--lg">
              Go to my reports
            </Link>
          ) : (
            <Link to="/home" className="btn btn--outline btn--block btn--lg">
              Browse found items
            </Link>
          )}
          {!report.mine && (
            <button type="button" className="report-link" onClick={() => setReporting(true)}>
              <Icon name="flag" size={16} /> Report this post
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

const REASONS: { key: FlagReason; label: string; hint?: string }[] = [
  { key: "contact", label: "It shows personal contact details", hint: "A phone number, email, social media account or student number." },
  { key: "fake", label: "It’s fake, spam or a joke" },
  { key: "offensive", label: "It’s offensive or inappropriate" },
  { key: "other", label: "Something else" },
];

/** A student flags another student's lost report. The office decides whether to hide it. */
function ReportPostForm({ reportId, userId, onBack }: { reportId: string; userId: string; onBack: () => void }) {
  const [reason, setReason] = useState<FlagReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent)
    return (
      <div className="report-done">
        <span className="report-done__icon">
          <Icon name="checkCircle" size={34} />
        </span>
        <h3>Thanks. The office will review this post.</h3>
        <p className="muted">
          If it breaks the posting rules, the office hides it and asks the owner to fix it. The owner never sees who reported it.
        </p>
        <button type="button" className="btn btn--navy btn--lg" onClick={onBack}>
          Back to the post
        </button>
      </div>
    );

  async function send() {
    if (!reason) return setError("Choose what’s wrong with this post.");
    setBusy(true);
    try {
      await flagReport(reportId, userId, reason, note);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="report-form">
      <p className="report-form__lead">
        Tell the office what’s wrong with this post. The person who posted it won’t see who reported it.
      </p>
      <fieldset className="report-form__reasons">
        <legend className="field__label">What’s wrong?</legend>
        {REASONS.map((r) => (
          <label key={r.key} className={`reason ${reason === r.key ? "is-checked" : ""}`}>
            <input
              type="radio"
              name="reason"
              value={r.key}
              checked={reason === r.key}
              onChange={() => {
                setReason(r.key);
                setError("");
              }}
            />
            <span>
              <strong>{r.label}</strong>
              {r.hint && <small>{r.hint}</small>}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span className="field__label">Anything else the office should know? (optional)</span>
        <textarea className="input textarea" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. The description has a Facebook link." />
      </label>
      {error && <Alert>{error}</Alert>}
      <div className="form-buttons">
        <button type="button" className="btn btn--navy btn--lg" onClick={send} disabled={busy}>
          <Icon name="flag" size={18} /> Send report
        </button>
        <button type="button" className="btn btn--outline btn--lg" onClick={onBack}>
          Cancel
        </button>
      </div>
    </div>
  );
}
