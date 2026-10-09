import { useState } from "react";
import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackLink, ItemBadge, ItemPhoto, Loading } from "../../components/ui";
import { confirmRelease, getClaim, getProfile, itemFor, returnToCustody } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function ReleaseItem() {
  const { claimId = "" } = useParams();
  const claim = useLoad(() => getClaim(claimId), [claimId]);
  const [checks, setChecks] = useState({ id: false, item: false });
  if (!claim) return <Loading />;
  const item = itemFor(claim.itemId)!;
  const who = getProfile(claim.claimantId);

  if (claim.status !== "approved")
    return (
      <div className="container stack-lg">
        <BackLink to="/admin/claims">Claim Queue</BackLink>
        <Alert tone={claim.status === "completed" ? "success" : "info"}>
          {claim.status === "completed"
            ? `${item.title} was released to ${who?.fullName}. The claim and its messages are closed.`
            : `This claim is ${claim.status.replace("_", " ")}, so there's nothing to release.`}{" "}
          <Link to="/admin/claims" replace>Back to the queue</Link>
        </Alert>
      </div>
    );

  return (
    <div className="container stack-lg">
      <BackLink to="/admin/claims">Claim Queue</BackLink>
      <header className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">
            RELEASE · CLAIM {claim.id} · ITEM {item.id}
          </p>
          <h1 className="page-title">{item.title}</h1>
          <p className="page-lead">
            Approved for <b>{who?.fullName}</b> · pick up by {longDate(claim.pickupBy!)}
          </p>
        </div>
        <ItemBadge status={item.status} large />
      </header>
      <div className="two-col two-col--release">
        <section className="panel panel--white" aria-labelledby="it">
          <h2 id="it" className="panel__title">
            Item
          </h2>
          <div className="intake">
            <ItemPhoto src={item.photo} alt={item.title} className="intake__photo" />
            <div className="intake__meta">
              <span>{item.description}</span>
              <span>
                Found at {item.location}, {longDate(item.foundOn)}
              </span>
              {item.shelfTag && <b>Shelf tag: {item.shelfTag}</b>}
            </div>
          </div>
        </section>
        <section className="panel panel--white panel--emph" aria-labelledby="ho">
          <h2 id="ho" className="panel__title">
            Handover checklist
          </h2>
          <label className="check-row">
            <input type="checkbox" checked={checks.id} onChange={(e) => setChecks({ ...checks, id: e.target.checked })} />
            <span>
              I checked the claimant's <b>RTU ID</b>, and the name matches <b>{who?.fullName}</b>.
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={checks.item} onChange={(e) => setChecks({ ...checks, item: e.target.checked })} />
            <span>The claimant confirmed this is their item.</span>
          </label>
          <div className="kv-box">
            <div>
              <small>RELEASED BY</small>
              <span>Office staff (you)</span>
            </div>
            <div>
              <small>DATE AND TIME</small>
              <span>Recorded when you confirm</span>
            </div>
          </div>
          <button className="btn btn--green btn--lg" disabled={!checks.id || !checks.item} onClick={() => confirmRelease(claim.id)}>
            <Icon name="release" size={20} /> Confirm release
          </button>
          <p className="field__hint">Confirming closes the claim and its messages, marks the item Returned, and resolves the linked lost report.</p>
        </section>
      </div>
      <section className="dashed-box">
        <div>
          <p className="dashed-box__title">Claimant didn't come by the deadline?</p>
          <p className="muted">Return the item to custody. The claim expires, and the claimant is notified.</p>
        </div>
        <button className="btn btn--outline-danger" onClick={() => returnToCustody(claim.id)}>
          Return to custody
        </button>
      </section>
    </div>
  );
}
