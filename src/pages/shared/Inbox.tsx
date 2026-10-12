import { Link, useSearchParams } from "react-router";
import { Icon } from "../../components/Icon";
import { notifLook as look } from "../../components/NotificationMenu";
import { BackButton, ClaimBadge, EmptyState, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { listNotifications, listThreads, markNotificationsRead } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { shortDateTime } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

/** The bell page: notifications and claim messages in one place, for students and office staff. */
export function Inbox({ who, only }: { who: "student" | "office"; only?: "messages" }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = only === "messages" || params.get("tab") === "messages" ? "messages" : "notifications";
  const office = who === "office";
  const notes = useLoad(() => listNotifications(who), [who]);
  const threads = useLoad(() => listThreads(office ? "office" : "owner", user?.id), [who, user?.id]);
  if (!notes || !threads) return <Loading />;

  const unread = notes.filter((n) => !n.read);
  const waiting = threads.filter((t) => t.awaitingYou);
  const claimHref = (id: string) => (office ? `/admin/claims/${id}` : `/claims/${id}`);
  const setTab = (t: string) => setParams(t === "messages" ? { tab: "messages" } : {}, { replace: true });

  return (
    <div className={`container container--mid stack-lg inbox ${only ? "inbox--messages" : ""}`}>
      <BackButton fallback={office ? "/admin" : "/home"} />
      <PageHead
        eyebrow={office ? "OFFICE INBOX" : undefined}
        title={only ? "Messages" : "Notifications"}
        lead={
          only
            ? office
              ? "Conversations with claimants, one per claim."
              : "Conversations with the office about your claims."
            : office
              ? "New claims, replies from claimants, and items that need attention."
              : "Updates on your reports and claims, and messages from the office."
        }
        actions={
          tab === "notifications" &&
          unread.length > 0 && (
            <button className="link-btn" onClick={() => void markNotificationsRead(undefined, who).catch(() => undefined)}>
              Mark all as read
            </button>
          )
        }
      />
      {!only && (
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "notifications"} className={`tab ${office ? "tab--blue" : ""} ${tab === "notifications" ? "is-active" : ""}`} onClick={() => setTab("notifications")}>
          <Icon name="bell" size={16} /> Notifications{unread.length > 0 && <span className="tab__count">{unread.length}</span>}
        </button>
        <button role="tab" aria-selected={tab === "messages"} className={`tab ${office ? "tab--blue" : ""} ${tab === "messages" ? "is-active" : ""}`} onClick={() => setTab("messages")}>
          <Icon name="message" size={16} /> Messages{waiting.length > 0 && <span className="tab__count">{waiting.length}</span>}
        </button>
      </div>
      )}

      {tab === "notifications" ? (
        notes.length === 0 ? (
          <EmptyState title="You're all caught up." />
        ) : (
          <ul className={`notif-list ${office ? "notif-list--office" : ""}`}>
            {notes.map((n) => (
              <li key={n.id}>
                <Link to={n.href} className={`notif ${n.read ? "" : "notif--unread"}`} onClick={() => void markNotificationsRead([n.id], who).catch(() => undefined)}>
                  <span className={`notif__icon tone-${look[n.kind].tone}`}>
                    <Icon name={look[n.kind].icon} size={22} />
                  </span>
                  <span className="notif__text">
                    <strong>{n.title}</strong>
                    <span>{n.detail}</span>
                    <small>{shortDateTime(n.at)}</small>
                  </span>
                  {!n.read && <span className="notif__dot" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : threads.length === 0 ? (
        <EmptyState title="No messages yet.">{office ? "Messages appear here when you ask a claimant a question." : "The office will message you here if they need more details about a claim."}</EmptyState>
      ) : (
        <>
          <p className="field__hint">
            <Icon name="lock" size={14} /> Messages stay inside each claim. {office ? "Students see you as “Office.”" : "Only you and office staff can read them."}
          </p>
          <ul className={`thread-list ${office ? "thread-list--office" : ""}`}>
            {threads.map((t) => {
              const mine = t.last.from === (office ? "office" : "owner");
              return (
                <li key={t.claim.id}>
                  <Link to={claimHref(t.claim.id)} className={`thread-row ${t.awaitingYou ? "thread-row--waiting" : ""}`}>
                    <ItemPhoto src={t.photo} alt="" className="thread-row__thumb" />
                    <span className="thread-row__body">
                      <strong className="thread-row__title">{t.itemTitle}</strong>
                      <small className="thread-row__date">{shortDateTime(t.last.at)}</small>
                      <span className="thread-row__meta">
                        Claim {t.claim.id}
                        {office && t.claimantName ? ` · ${t.claimantName}` : ""} <ClaimBadge status={t.claim.status} />
                      </span>
                      {t.awaitingYou && <span className="thread-row__flag">Reply needed</span>}
                      <span className="thread-row__preview">
                        <b>{mine ? "You" : office ? "Owner" : "Office"}:</b> {t.last.body}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={20} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
