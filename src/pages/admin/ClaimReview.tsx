import { useState } from "react";
import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackLink, ClaimBadge, EmptyState, ItemPhoto, Loading, TextAreaField } from "../../components/ui";
import { MessageThread } from "../../components/MessageThread";
import { ModalLink } from "../../components/Modal";
import { decideClaim, getClaim, getProfile, itemFor, otherOpenClaims } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function ClaimReview() {
  const { claimId = "" } = useParams();
  const claim = useLoad(() => getClaim(claimId), [claimId]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

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

  async function decide(d: "approve" | "reject" | "request_info") {
    if (d === "reject" && !reason.trim()) return setError("Give a reason. The claimant will see it.");
    if (d === "request_info" && !reason.trim()) return setError("Type the question you want to ask the claimant.");
    setError("");
    await decideClaim(claim!.id, d, reason.trim() || undefined);
    setReason("");
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

      {open ? (
        <section className="panel panel--white" aria-labelledby="dec">
          <h2 id="dec" className="panel__title">
            Decision
          </h2>
          {error && <Alert>{error}</Alert>}
          <TextAreaField
            label="Reason or question (required to reject or ask; shown to the claimant)"
            rows={2}
            placeholder="e.g. Your answers didn't match the item's details."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <div className="form-actions">
            <button className="btn btn--green" onClick={() => decide("approve")}>
              <Icon name="check" size={18} strokeWidth={2.6} /> Approve
            </button>
            <button className="btn btn--outline-blue" onClick={() => decide("request_info")}>
              <Icon name="message" size={18} /> Request more info
            </button>
            <button className="btn btn--outline-danger" onClick={() => decide("reject")}>
              <Icon name="x" size={18} strokeWidth={2.4} /> Reject
            </button>
          </div>
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
  );
}
