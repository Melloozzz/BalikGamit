import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, type LinkProps, type Location } from "react-router";
import { Icon } from "./Icon";

/** Details links that have no page of their own: on a direct visit, this is the page shown behind the popup. */
export function detailFallback(pathname: string): string | null {
  if (/^\/items\/[^/]+\/?$/.test(pathname)) return "/items";
  if (/^\/lost\/[^/]+\/?$/.test(pathname)) return "/lost";
  if (/^\/admin\/items\/[^/]+\/?$/.test(pathname)) return "/admin/items";
  if (/^\/admin\/lost\/[^/]+\/?$/.test(pathname)) return "/admin/lost";
  return null;
}

/** Opens a details route as a popup over the current page. */
export function ModalLink({ to, children, ...rest }: LinkProps) {
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background ?? location;
  return (
    <Link to={to} state={{ background }} {...rest}>
      {children}
    </Link>
  );
}

export function Modal({
  label,
  eyebrow,
  title,
  aside,
  meta,
  office,
  narrow,
  onClose,
  children,
}: {
  label: string;
  eyebrow: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  office?: boolean;
  /** Smaller dialog for short forms */
  narrow?: boolean;
  /** A popup opened by page state, not a route: closing just calls this and the address doesn't change. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const box = useRef<HTMLDivElement>(null);
  // Opened from a link: go back to that page. Opened directly: show the list behind it.
  const fromLink = !!(location.state as { background?: unknown } | null)?.background;
  const close = onClose ?? (() => (fromLink ? navigate(-1) : navigate(detailFallback(location.pathname) ?? "/", { replace: true })));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className={`modal ${office ? "modal--office" : ""} ${narrow ? "modal--narrow" : ""}`}>
      <div className="modal__scrim" onClick={close} />
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={box}>
        <header className="modal__head">
          <div className="modal__titles">
            <p className="modal__eyebrow">{eyebrow}</p>
            <h2 className="modal__title">{title}</h2>
            {meta && <p className="modal__meta">{meta}</p>}
          </div>
          {aside}
          <button className="modal__close" onClick={close} aria-label="Close">
            <Icon name="x" size={22} strokeWidth={2.2} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
