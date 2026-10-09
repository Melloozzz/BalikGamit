import { useEffect, useRef, type ReactNode } from "react";
import { NavLink } from "react-router";
import { Icon, type IconName } from "../components/Icon";
import { LogoTile, Wordmark } from "../components/Brand";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

/** Slide-in navigation used by the menu button on student and admin pages (Figma "Sidebar | Home"). */
export function Drawer({ open, onClose, items, onSignOut, footer, className = "" }: { open: boolean; onClose: () => void; items: NavItem[]; onSignOut?: () => void; footer?: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`drawer ${className} ${open ? "drawer--open" : ""}`} aria-hidden={!open}>
      <div className="drawer__scrim" onClick={onClose} />
      <div className="drawer__panel" ref={panel} role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="drawer__head">
          <LogoTile size={44} />
          <Wordmark size={30} />
          <button className="icon-btn drawer__close" onClick={onClose} aria-label="Close menu">
            <Icon name="x" size={22} />
          </button>
        </div>
        <nav className="drawer__nav">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `drawer__link ${isActive ? "is-active" : ""}`} onClick={onClose}>
              <Icon name={i.icon} size={20} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        {footer && <div className="drawer__foot">{footer}</div>}
        {onSignOut && (
          <button className="drawer__link drawer__signout" onClick={onSignOut}>
            <Icon name="logout" size={20} />
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
