import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Icon } from "./Icon";
import type { Profile } from "../data/types";

const roleLabel = { student: "Student", admin: "Admin", super_admin: "Super admin" } as const;

/** Avatar button that opens View profile / Settings / Sign out. Closes on outside click, Esc, or choosing an item. */
export function ProfileMenu({
  user,
  profileTo,
  settingsTo,
  onSignOut,
  defaultOpen = false,
}: {
  user: Profile;
  profileTo: string;
  settingsTo: string;
  onSignOut: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  const close = () => setOpen(false);
  return (
    <div className="profile-menu" ref={box}>
      <button className="avatar" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} aria-label="Account menu" onClick={() => setOpen((v) => !v)}>
        <Icon name="user" size={30} strokeWidth={1.6} />
      </button>
      {open && (
        <div className="profile-menu__panel" role="menu" id={menuId}>
          <div className="profile-menu__who">
            <span className="profile-menu__initials" aria-hidden>
              {initials(user.fullName)}
            </span>
            <span>
              <strong>{user.fullName}</strong>
              <small>{user.email}</small>
              <span className="profile-menu__role">{roleLabel[user.role]}</span>
            </span>
          </div>
          <Link role="menuitem" to={profileTo} className="profile-menu__item" onClick={close}>
            <Icon name="user" size={20} /> View profile
          </Link>
          <Link role="menuitem" to={settingsTo} className="profile-menu__item" onClick={close}>
            <Icon name="settings" size={20} /> Settings
          </Link>
          <button
            role="menuitem"
            className="profile-menu__item profile-menu__item--danger"
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            <Icon name="logout" size={20} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
