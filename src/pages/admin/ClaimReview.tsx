import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackLink, ClaimBadge, EmptyState, ItemPhoto, Loading, TextAreaField } from "../../components/ui";
import { MessageThread } from "../../components/MessageThread";
import { Modal, ModalLink } from "../../components/Modal";
import { decideClaim, getClaim, getProfile, itemFor, otherOpenClaims } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function ClaimReview() {
  const { claimId = "" } = useParams();
  const claim = useLoad(() => getClaim(claimId), [claimId]);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  // The popup keeps the close handler from when it opened, so read "saving" through a ref.
  const savingRef = useRef(false);

  if (claim === undefined) return <Loading />;
  if (claim === null)
    return (
      <div className="container">
        <BackLink to="/admin/claims">Claim Queue</BackLink>
        <EmptyState title="We couldn't find that claim." />
      </div>
    );

  const item = itemFor(claim.itemId)!;
  const who = getProfile(claim.claimantId);
  const others = otherOpenClaims(claim);
  const open = claim.status === "pending" || claim.status === "needs_info";

  async function decide(d: "approve" | "reject") {
    if (savingRef.current) return;
    if (d === "reject" && !reason.trim()) return setReasonError("Give a reason. The claimant will see it.");
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await decideClaim(claim!.id, d, d === "reject" ? reason.trim() : undefined);
      savingRef.current = false;
      closeDialog();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save the decision. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function closeDialog() {
    if (savingRef.current) return;
    setDialog(null);
    setReason("");
    setReasonError("");
    setSaveError("");
  }

  return (
    <div className="container stack-lg">
      <BackLink to="/admin/claims">Claim Queue</BackLink>
      <header className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">
            CLAIM {claim.id} · ITEM <ModalLink to={`/admin/items/${item.id}`}>{item.id}</ModalLink>
          </p>
          <h1 className="page-title">{item.title}</h1>
          <p className="page-lead">
            Claimed by <b>{who?.fullName}</b> · {who?.email} · filed {longDate(claim.filedOn)}
          </p>
        </div>
        <ClaimBadge status={claim.status} large />
      </header>

      {open && others.length > 0 && (
        <div className="callout callout--warn">
          <Icon name="alert" size={20} />
          <p>
            This item has{" "}
            <b>
              {others.length} other pending claim{others.length > 1 ? "s" : ""}
            </b>{" "}
            ({others.map((o) => o.id).join(", ")}). Approving this one closes the other{others.length > 1 ? "s" : ""}.
          </p>
        </div>
      )}

      <div className="two-col">
        <section className="panel panel--white" aria-labelledby="ans">
          <h2 id="ans" className="panel__title">
            Claimant's answers
          </h2>
          <dl className="qa">
            {claim.answers.map((a) => (
              <div key={a.question}>
                <dt>{a.question}</dt>
                <dd>{a.answer}</dd>
              </div>
            ))}
            {claim.linkedReportId && (
              <div>
                <dt>Linked lost report</dt>
                <dd>
                  <ModalLink to={`/admin/lost/${claim.linkedReportId}`}>{claim.linkedReportId}</ModalLink>
                </dd>
              </div>
            )}
          </dl>
        </section>
        <section className="panel panel--white panel--emph" aria-labelledby="priv">
          <div className="panel__head">
            <h2 id="priv" className="panel__title">
              Private intake details
            </h2>
            <span className="office-pill">
              <Icon name="lock" size={14} strokeWidth={2.2} /> Office only
            </span>
          </div>
          <div className="intake">
            <ItemPhoto src={item.photo} alt={item.title} className="intake__photo" />
            <div className="intake__meta">
              <span>
                Logged {longDate(item.foundOn)}
                {item.loggedBy ? ` by ${item.loggedBy}` : ""}
              </span>
              <span>
                Found in {item.location}
                {item.locationDetail ? `, ${item.locationDetail.toLowerCase()}` : ""}
              </span>
              {item.shelfTag && <span>Shelf tag: {item.shelfTag}</span>}
            </div>
          </div>
          <p className="intake__private">{item.privateDetails ?? "No private details were recorded at intake."}</p>
          <p className="field__hint">Never shown to students and never sent to the AI service.</p>
          <ModalLink to={`/admin/items/${item.id}`} className="link-strong">
            View item details and other claims
          </ModalLink>
        </section>
      </div>

      <div className="two-col">
        {open ? (
          <section className="panel panel--white decision" aria-labelledby="dec">
            <h2 id="dec" className="panel__title">
              Decision
            </h2>
            <p className="field__hint">To ask the claimant something first, send them a message. The claim shows as "Needs info" until they reply.</p>
            <div className="form-actions">
              <button className="btn btn--green" onClick={() => setDialog("approve")}>
                <Icon name="check" size={18} strokeWidth={2.6} /> Approve
              </button>
              <button className="btn btn--outline-danger" onClick={() => setDialog("reject")}>
                <Icon name="x" size={18} strokeWidth={2.4} /> Reject
              </button>
            </div>
            {dialog === "approve" && (
              <Modal office narrow label="Approve this claim" eyebrow={`APPROVE CLAIM · ${claim.id}`} title="Approve this claim?" onClose={closeDialog}>
                <p>
                  <b>{who?.fullName}</b> will be asked to pick up <b>{item.title}</b> at the office.
                  {others.length > 0 && (
                    <>
                      {" "}
                      This also rejects{" "}
                      <b>
                        {others.length} other claim{others.length > 1 ? "s" : ""}
                      </b>{" "}
                      on this item ({others.map((o) => o.id).join(", ")}).
                    </>
                  )}
                </p>
                {saveError && <Alert>{saveError}</Alert>}
                <div className="form-actions form-actions--split">
                  <button className="btn btn--outline" onClick={closeDialog} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btn--green" onClick={() => decide("approve")} disabled={saving}>
                    {saving ? "Saving…" : "Approve claim"}
                  </button>
                </div>
              </Modal>
            )}
            {dialog === "reject" && (
              <Modal office narrow label="Reject this claim" eyebrow={`REJECT CLAIM · ${claim.id}`} title="Reject this claim?" onClose={closeDialog}>
                <TextAreaField
                  label="Reason (shown to the claimant)"
                  required
                  rows={3}
                  placeholder="e.g. Your answers didn't match the item's details."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  error={reasonError}
                  disabled={saving}
                />
                {saveError && <Alert>{saveError}</Alert>}
                <div className="form-actions form-actions--split">
                  <button className="btn btn--outline" onClick={closeDialog} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn btn--danger" onClick={() => decide("reject")} disabled={saving}>
                    {saving ? "Saving…" : "Reject claim"}
                  </button>
                </div>
              </Modal>
            )}
          </section>
        ) : claim.status === "approved" ? (
          <Alert tone="success">
            Approved. When the claimant comes to the office, <Link to={`/admin/claims/${claim.id}/release`}>open the release checklist</Link>.
          </Alert>
        ) : (
          <Alert tone="info">This claim is closed ({claim.status.replace("_", " ")}).</Alert>
        )}

        <MessageThread claimId={claim.id} viewer="office" open={open || claim.status === "approved"} />
      </div>
    </div>
  );
}
