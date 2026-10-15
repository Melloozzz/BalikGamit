import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { EmptyState, ItemPhoto, Loading } from "../../components/ui";
import { getMyReport } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

/** Same layout as ClaimSubmitted. */
export function ReportSubmitted() {
  const { reportId = "" } = useParams();
  const { user } = useAuth();
  const report = useLoad(() => getMyReport(user!.id, reportId), [user?.id, reportId]);
  if (report === undefined) return <Loading />;
  if (!report)
    return (
      <div className="container container--narrow">
        <EmptyState title="We couldn't find that report.">Your reports are under My reports.</EmptyState>
      </div>
    );

  return (
    <div className="container container--narrow">
      <section className="done-card" aria-labelledby="done-h">
        <span className="done-card__icon">
          <Icon name="check" size={34} strokeWidth={2.4} />
        </span>
        <h1 id="done-h" className="done-card__title">
          Report submitted
        </h1>
        <p className="done-card__ref">REPORT {report.id}</p>
        <p className="done-card__lead">Your report is active. We'll compare it with found items the office logs.</p>
        <div className="mini-item">
          <ItemPhoto src={report.photo} alt={report.title} className="mini-item__photo" />
          <div>
            <strong>{report.title}</strong>
            <span>
              Lost in {report.location} · {longDate(report.lostOn)}
            </span>
          </div>
        </div>
        <h2 className="done-card__h2">What happens next</h2>
        <ol className="numbered">
          <li>We compare your report with items the office logs.</li>
          <li>If something looks like a match, we'll notify you. Review it in My reports.</li>
          <li>If it's yours, submit a claim, then pick it up at the office with your RTU ID.</li>
        </ol>
        <div className="form-actions form-actions--split">
          <Link to="/reports" className="btn btn--navy btn--lg">
            View my reports
          </Link>
          <Link to="/home" className="btn btn--outline btn--lg">
            Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}
