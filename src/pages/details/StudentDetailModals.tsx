import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { CategoryPill, ItemPhoto, Loading } from "../../components/ui";
import { getFoundItem, getPublicLostReport, listMyClaims } from "../../data/api";
import { OFFICE } from "../../data/mock";
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
  const unavailable = item.status === "ready_for_pickup" || item.status === "returned";
  return (
    <Modal label={`Found item ${item.title}`} eyebrow={`FOUND ITEM · ${item.id}`} title={item.title}>
      <div className="modal-detail">
        <ItemPhoto src={item.photo} alt={item.title} className="modal-detail__photo" />
        <div className="modal-detail__info">
          <CategoryPill>{item.category}</CategoryPill>
          <p className="modal-detail__desc">{item.description} It is secured by the campus Office while ownership is verified.</p>
          <Facts
            rows={[
              { icon: "pin", label: "FOUND AT", value: item.location },
              { icon: "calendar", label: "DATE FOUND", value: longDate(item.foundOn) },
            ]}
          />
        </div>
      </div>
      <div className="modal-detail__foot">
        <div className="think-box">
          <p className="think-box__title">
            <Icon name="shield" size={18} /> Think it’s yours?
          </p>
          <p>Answer a few questions only the owner would know. The office checks them against details recorded at intake.</p>
        </div>
        <div className="modal-detail__cta">
          {open ? (
            <Link to={`/claims/${open.id}`} className="btn btn--navy btn--block btn--lg">
              View your claim ({open.id})
            </Link>
          ) : unavailable ? (
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
  if (report === undefined) return <Loading />;
  if (!report)
    return (
      <Modal label="Report not found" eyebrow="LOST ITEM" title="This report isn't listed anymore.">
        <p className="muted">The owner may have found it, or the report expired.</p>
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
        </div>
      </div>
    </Modal>
  );
}
