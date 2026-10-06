import { ModalLink } from "../../components/Modal";
import { Icon } from "../../components/Icon";
import { BackButton, EmptyState, Loading, PageHead } from "../../components/ui";
import { listFlaggedPosts, setFlaggedVisible } from "../../data/api";
import { useLoad } from "../../lib/useLoad";

export function FlaggedPosts() {
  const posts = useLoad(() => listFlaggedPosts(), []);
  if (!posts) return <Loading />;
  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead eyebrow="CONTENT MODERATION" title="Flagged posts" lead="Protect student privacy and keep public listings useful." />
      {posts.length === 0 ? (
        <EmptyState title="Nothing is flagged right now." />
      ) : (
        <ul className="stack">
          {posts.map((p) => (
            <li key={p.id} className="flag-card">
              <span className="flag-card__icon">
                <Icon name="flag" size={22} />
              </span>
              <div className="flag-card__main">
                <p className="flag-card__title">
                  <strong>{p.title}</strong>
                  <span className={`badge ${p.visible ? "badge--green" : "badge--pink"}`}>{p.visible ? "Visible" : "Hidden"}</span>
                </p>
                <p className="muted">
                  {p.id} · <ModalLink to={`/admin/lost/${p.reportId}`}>{p.reportId}</ModalLink> · reported by {p.reporterLabel}
                </p>
                <p>
                  <b>Flag reason:</b> {p.reason}
                </p>
              </div>
              <button className="btn btn--outline" onClick={() => setFlaggedVisible(p.id, !p.visible)}>
                <Icon name={p.visible ? "eyeOff" : "eye"} size={20} /> {p.visible ? "Hide" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
