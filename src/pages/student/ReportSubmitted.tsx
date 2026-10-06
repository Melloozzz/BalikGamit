import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { BackLink } from "../../components/ui";

export function ReportSubmitted() {
  return (
    <div className="container stack-lg">
      <BackLink to="/home">Back</BackLink>
      <section className="done-card done-card--blue">
        <span className="done-card__icon done-card__icon--ring">
          <Icon name="check" size={40} strokeWidth={2.4} />
        </span>
        <h1 className="done-card__title done-card__title--gold">Your report is active</h1>
        <p className="done-card__lead">We’ll compare it with found items logged by the Office. Check My Reports for possible matches.</p>
        <Link to="/reports" className="btn btn--navy btn--lg">
          View my reports
        </Link>
      </section>
    </div>
  );
}
