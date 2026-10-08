import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Icon, type IconName } from "./Icon";
import { listNotifications, markNotificationsRead } from "../data/api";
import type { Notification } from "../data/types";
import { shortDateTime } from "../lib/format";
import { useLoad } from "../lib/useLoad";

export const notifLook: Record<Notification["kind"], { icon: IconName; tone: string }> = {
  question: { icon: "message", tone: "amber" },
  matches: { icon: "search", tone: "blue" },
  approved: { icon: "check", tone: "green" },
  expiring: { icon: "clock", tone: "red" },
  hidden: { icon: "eyeOff", tone: "gray" },
  rejected: { icon: "x", tone: "red" },
  new_claim: { icon: "shield", tone: "blue" },
  reply: { icon: "message", tone: "amber" },
  flagged: { icon: "flag", tone: "red" },
  pickup_due: { icon: "clock", tone: "amber" },
};

const SHOWN = 5;

/** Bell button that opens a card with the latest notifications. "Show more" goes to the full Notifications page. */
export function NotificationMenu({ who, unread, light = false }: { who: "student" | "office"; unread: number; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const notes = useLoad(() => listNotifications(who), [who]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="notif-menu" ref={box}>
      <button
        className={`icon-btn ${light ? "icon-btn--light" : ""} topbar__bell`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={28} />
        {unread > 0 && <span className="count-dot">{unread}</span>}
      </button>
      {open && (
        <div className={`notif-menu__panel ${who === "office" ? "notif-menu__panel--office" : ""}`} role="dialog" aria-label="Notifications" id={panelId}>
          <div className="notif-menu__head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={() => markNotificationsRead(undefined, who)}>
                Mark all as read
              </button>
            )}
          </div>
          {!notes ? (
            <p className="notif-menu__empty">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="notif-menu__empty">You're all caught up.</p>
          ) : (
            <>
              <ul className="notif-list notif-menu__list">
                {notes.slice(0, SHOWN).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.href}
                      className={`notif ${n.read ? "" : "notif--unread"}`}
                      onClick={() => {
                        markNotificationsRead([n.id], who);
                        setOpen(false);
                      }}
                    >
                      <span className={`notif__icon tone-${notifLook[n.kind].tone}`}>
                        <Icon name={notifLook[n.kind].icon} size={20} />
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
            </>
          )}
          <Link to={who === "office" ? "/admin/notifications" : "/notifications"} className="notif-menu__more" onClick={() => setOpen(false)}>
            Show more
          </Link>
        </div>
      )}
    </div>
  );
}
