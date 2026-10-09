import { Link, useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Modal, ModalLink } from "../../components/Modal";
import { Alert, CategoryPill, ClaimBadge, ItemBadge, ItemPhoto, LikelihoodBadge, Loading, ReportBadge } from "../../components/ui";
import { getFoundItem, getMatches, getProfile, getReport, listClaimsForItem, setReportStatus } from "../../data/api";
import { longDate, shortDate } from "../../lib/format";
import { ON_SHELF } from "../../data/types";
import { useLoad } from "../../lib/useLoad";

function Kv({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="kv kv--tight">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
const OfficeOnly = () => (
  <span className="office-pill">
    <Icon name="lock" size={14} strokeWidth={2.2} /> Office only
  </span>
);

export function AdminFoundItemModal() {
  const { itemId = "" } = useParams();
  const item = useLoad(() => getFoundItem(itemId, { admin: true }), [itemId]);
  const claims = useLoad(() => listClaimsForItem(itemId), [itemId]);
  if (item === undefined || !claims) return <Loading />;
  if (!item)
    return (
      <Modal office label="Item not found" eyebrow="FOUND ITEM" title="We couldn't find that item.">
        {null}
      </Modal>
    );
  const open = claims.filter((c) => c.status === "pending" || c.status === "needs_info").length;
  const onShelf = ON_SHELF.includes(item.status);
  return (
    <Modal
      office
      label={`Found item ${item.title}`}
      eyebrow={`FOUND ITEM · ${item.id}`}
      title={item.title}
      meta={`Logged ${longDate(item.foundOn)}${item.loggedBy ? ` by ${item.loggedBy}` : ""} · ${open} open claim${open === 1 ? "" : "s"}`}
      aside={<ItemBadge status={item.status} large />}
    >
      <div className="modal-admin">
        <section className="modal-admin__col">
          <ItemPhoto src={item.photo} alt={item.title} className="modal-admin__photo" />
          <CategoryPill>{item.category}</CategoryPill>
          <p className="modal-detail__desc">{item.description}</p>
          <Kv rows={[["Found at", item.location], ["Date found", longDate(item.foundOn)]]} />
          {item.disposal && (
            <Alert tone="info">
              {item.disposal.method === "donated" ? "Donated" : "Disposed of"} on {longDate(item.disposal.at)} by {item.disposal.by}. {item.disposal.note}
            </Alert>
          )}
          {item.returnedOn && <Alert tone="success">Returned to its owner on {longDate(item.returnedOn)}.</Alert>}
          {onShelf && (
            <Link to={`/admin/items/${item.id}/edit`} state={{ fromPopup: true }} className="btn btn--outline-blue modal-admin__edit">
              <Icon name="edit" size={18} /> Edit item
            </Link>
          )}
        </section>
        <section className="modal-admin__col">
          <div className="modal-private">
            <div className="panel__head">
              <h3 className="modal-admin__h">Private intake details</h3>
              <OfficeOnly />
            </div>
            <p className="intake__private">{item.privateDetails ?? "No private details were recorded at intake."}</p>
            <Kv rows={[["Exact spot", item.locationDetail ?? "Not recorded"], ["Shelf tag", item.shelfTag ?? "Not assigned"]]} />
          </div>
          <h3 className="modal-admin__h">Claims on this item ({claims.length})</h3>
          {claims.length === 0 ? (
            <p className="muted">No one has claimed this item yet.</p>
          ) : (
            <ul className="mini-list">
              {claims.map((c) => (
                <li key={c.id}>
                  <Link to={c.status === "approved" ? `/admin/claims/${c.id}/release` : `/admin/claims/${c.id}`} className="mini-row">
                    <span className="mini-row__main">
                      <strong>{getProfile(c.claimantId)?.fullName}</strong>
                      <small>
                        {c.id} · filed {shortDate(c.filedOn)}
                      </small>
                    </span>
                    <ClaimBadge status={c.status} />
                    <Icon name="chevronRight" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

export function AdminLostReportModal() {
  const { reportId = "" } = useParams();
  const report = useLoad(() => getReport(reportId), [reportId]);
  const matches = useLoad(() => getMatches(reportId), [reportId]);
  if (report === undefined || !matches) return <Loading />;
  if (!report)
    return (
      <Modal office label="Report not found" eyebrow="LOST REPORT" title="We couldn't find that report.">
        {null}
      </Modal>
    );
  const owner = getProfile(report.ownerId);
  const hidden = report.status === "hidden";
  return (
    <Modal
      office
      label={`Lost report ${report.title}`}
      eyebrow={`LOST REPORT · ${report.id}`}
      title={report.title}
      meta={
        <>
          Reported by <b>{owner?.fullName}</b> · {owner?.email}
        </>
      }
      aside={<ReportBadge status={report.status} />}
    >
      <div className="modal-admin">
        <section className="modal-admin__col">
          <ItemPhoto src={report.photo} alt={report.title} className="modal-admin__photo" />
          <CategoryPill>{report.category}</CategoryPill>
          <p className="modal-detail__desc">{report.description}</p>
          <Kv rows={[["Last seen at", report.location], ["Date lost", longDate(report.lostOn)]]} />
        </section>
        <section className="modal-admin__col">
          <div className="modal-private">
            <div className="panel__head">
              <h3 className="modal-admin__h">Owner's private details</h3>
              <OfficeOnly />
            </div>
            <p className="intake__private">{report.privateDetails ?? "The owner didn't add private details."}</p>
          </div>
          <h3 className="modal-admin__h">Possible matches ({matches.length})</h3>
          {matches.length === 0 ? (
            <p className="muted">No found items look like this report yet.</p>
          ) : (
            <ul className="mini-list">
              {matches.map((m) => (
                <li key={m.item.id}>
                  <ModalLink to={`/admin/items/${m.item.id}`} className="mini-row">
                    <ItemPhoto src={m.item.photo} alt="" className="mini-row__thumb" />
                    <span className="mini-row__main">
                      <strong>{m.item.title}</strong>
                      <small>
                        {m.item.id} · {m.item.location}
                      </small>
                    </span>
                    <LikelihoodBadge value={m.likelihood} />
                    <Icon name="chevronRight" size={18} />
                  </ModalLink>
                </li>
              ))}
            </ul>
          )}
          <div className="modal-admin__actions">
            {hidden ? (
              <button className="btn btn--outline-blue" onClick={() => setReportStatus(report.id, "active")}>
                <Icon name="eye" size={18} /> Make visible again
              </button>
            ) : (
              <button className="btn btn--outline-danger" onClick={() => setReportStatus(report.id, "hidden")}>
                <Icon name="eyeOff" size={18} /> Hide report
              </button>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
