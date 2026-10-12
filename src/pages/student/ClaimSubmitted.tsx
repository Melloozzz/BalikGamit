import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { ItemPhoto, Loading } from "../../components/ui";
import { getClaim } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

export function ClaimSubmitted() {
  const { claimId = "" } = useParams();
  const claim = useLoad(() => getClaim(claimId), [claimId]);
  if (!claim) return <Loading />;
  const item = claim.item;

  return (
    <div className="container container--narrow">
      <section className="done-card" aria-labelledby="done-h">
        <span className="done-card__icon">
          <Icon name="check" size={48} strokeWidth={2.4} />
        </span>
        <h1 id="done-h" className="done-card__title">
          Claim submitted
        </h1>
        <p className="done-card__ref">CLAIM {claim.id}</p>
        <p className="done-card__lead">Your claim is not approved yet. The office will review your answers against the item's details.</p>
        <div className="mini-item">
          <ItemPhoto src={item.photo} alt={item.title} className="mini-item__photo" />
          <div>
            <strong>{item.title}</strong>
            <span>
              Found in {item.location} · {longDate(item.foundOn)}
            </span>
          </div>
        </div>
        <h2 className="done-card__h2">What happens next</h2>
        <ol className="numbered">
          <li>The office reviews your claim.</li>
          <li>They may message you with a question. We'll notify you.</li>
          <li>If approved, pick up the item at the office with your RTU ID.</li>
        </ol>
        <div className="form-actions form-actions--split">
          <Link to={`/claims/${claim.id}`} className="btn btn--navy btn--lg">
            View claim status
          </Link>
          <Link to="/home" className="btn btn--outline btn--lg">
            Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}
