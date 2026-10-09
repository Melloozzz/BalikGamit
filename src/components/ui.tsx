import { useId, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { ClaimStatus, FoundItem, LostReportStatus, FoundItemStatus, Likelihood } from "../data/types";
import { Icon, type IconName } from "./Icon";
import logo from "../assets/logo.png";
import { ModalLink } from "./Modal";
import { Dropdown } from "./Dropdown";

// ---- status badges -------------------------------------------------------------------
type Tone = "amber" | "green" | "red" | "gray" | "blue" | "navy";
const claimStatus: Record<ClaimStatus, { label: string; tone: Tone; icon?: IconName; dot?: "solid" | "ring" }> = {
  pending: { label: "Pending", tone: "amber", dot: "ring" },
  needs_info: { label: "Needs info", tone: "amber", dot: "solid" },
  approved: { label: "Approved", tone: "green", icon: "check" },
  rejected: { label: "Rejected", tone: "red", icon: "x" },
  withdrawn: { label: "Withdrawn", tone: "gray" },
  completed: { label: "Completed", tone: "green", icon: "check" },
  expired: { label: "Expired", tone: "gray", icon: "clock" },
};
const reportStatus: Record<LostReportStatus, { label: string; tone: Tone; icon?: IconName; dot?: "solid" }> = {
  active: { label: "Active", tone: "amber", dot: "solid" },
  resolved: { label: "Resolved", tone: "green", icon: "check" },
  closed: { label: "Closed", tone: "gray" },
  expired: { label: "Expired", tone: "red", icon: "clock" },
  hidden: { label: "Hidden", tone: "red", icon: "eyeOff" },
};
const itemStatus: Record<FoundItemStatus, { label: string; tone: Tone; icon?: IconName }> = {
  in_custody: { label: "In custody", tone: "blue" },
  claim_pending: { label: "Claim pending", tone: "amber" },
  ready_for_pickup: { label: "Ready for pickup", tone: "green", icon: "check" },
  returned: { label: "Returned", tone: "gray", icon: "check" },
  donated: { label: "Donated", tone: "gray", icon: "gift" },
  disposed: { label: "Disposed", tone: "gray", icon: "trash" },
};

function Badge({ label, tone, icon, dot, large }: { label: string; tone: Tone; icon?: IconName; dot?: "solid" | "ring"; large?: boolean }) {
  return (
    <span className={`badge badge--${tone}${large ? " badge--lg" : ""}`}>
      {dot && <span className={`badge__dot badge__dot--${dot}`} aria-hidden />}
      {icon && <Icon name={icon} size={large ? 14 : 12} strokeWidth={3} />}
      {label}
    </span>
  );
}

export const ClaimBadge = ({ status, large }: { status: ClaimStatus; large?: boolean }) => <Badge {...claimStatus[status]} large={large} />;
export const ReportBadge = ({ status }: { status: LostReportStatus }) => <Badge {...reportStatus[status]} />;
export const ItemBadge = ({ status, large }: { status: FoundItemStatus; large?: boolean }) => <Badge {...itemStatus[status]} large={large} />;
export const LikelihoodBadge = ({ value }: { value: Likelihood }) => (
  <span className={`likelihood likelihood--${value}`}>{value[0].toUpperCase() + value.slice(1)} likelihood</span>
);
export const CategoryPill = ({ children }: { children: ReactNode }) => <span className="category-pill">{children}</span>;

// ---- item photo with the logo fallback used on the Figma cards ----------------------
export function ItemPhoto({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  if (src) return <img src={src} alt={alt} className={`item-photo ${className}`} loading="lazy" />;
  return (
    <div className={`item-photo item-photo--empty ${className}`} role="img" aria-label={`${alt} (no photo)`}>
      <img src={logo} alt="" />
    </div>
  );
}

// ---- item card (Browse Items) ----------------------------------------------------------
export function ItemCard({
  to,
  title,
  category,
  description,
  location,
  date,
  photo,
  footer,
}: {
  to?: string;
  title: string;
  category: string;
  description: string;
  location: string;
  date: string;
  photo?: string;
  footer?: ReactNode;
}) {
  return (
    <article className="item-card">
      <ItemPhoto src={photo} alt={title} className="item-card__photo" />
      <div className="item-card__body">
        <CategoryPill>{category}</CategoryPill>
        <h3 className="item-card__title">{title}</h3>
        <p className="item-card__desc">{description}</p>
        <div className="item-card__meta">
          <span>
            <Icon name="pin" size={16} /> {location}
          </span>
          <span>
            <Icon name="calendar" size={16} /> {date}
          </span>
        </div>
        {to ? (
          <ModalLink to={to} className="item-card__link">
            View Details <Icon name="chevronRight" size={14} strokeWidth={2.4} />
          </ModalLink>
        ) : (
          footer && <p className="item-card__note">{footer}</p>
        )}
      </div>
    </article>
  );
}

export const toCard = (i: FoundItem, date: string) => ({
  to: `/items/${i.id}`,
  title: i.title,
  category: i.category,
  description: i.description,
  location: i.location,
  date,
  photo: i.photo,
});

// ---- form fields -----------------------------------------------------------------------
interface FieldShell {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

function Shell({ id, label, error, hint, required, className = "", children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? "field--error" : ""} ${className}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__req" aria-hidden> *</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, error, hint, required, className, ...input }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...input} />
    </Shell>
  );
}

export function PasswordField({ label, error, hint, className, ...input }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <div className="input-wrap">
        <input id={id} className="input input--with-btn" type={show ? "text" : "password"} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...input} />
        <button type="button" className="input-wrap__btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          <Icon name={show ? "eye" : "eyeOff"} size={22} />
        </button>
      </div>
    </Shell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...select
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; placeholder: string }) {
  const id = useId();
  const items = [{ value: "", text: placeholder }, ...options.map((o) => ({ value: o, text: o }))];
  // Callers read e.target.value, so the pick is passed on in that shape.
  const pick = (v: string) => select.onChange?.({ target: { value: v }, currentTarget: { value: v } } as ChangeEvent<HTMLSelectElement>);
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className="select-wrap">
        <Dropdown id={id} className="input select" label={typeof label === "string" ? label : placeholder} value={String(select.value ?? "")} items={items} invalid={!!error} onChange={pick} />
        <Icon name="chevronDown" size={18} className="select-wrap__icon" />
      </div>
    </Shell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className,
  locked,
  ...ta
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { locked?: boolean }) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className={locked ? "input-wrap input-wrap--locked" : "input-wrap"}>
        {locked && <Icon name="lock" size={18} className="input-wrap__lock" />}
        <textarea id={id} className="input textarea" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...ta} />
      </div>
    </Shell>
  );
}

// ---- small pieces ---------------------------------------------------------------------
export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "warning" | "success"; children: ReactNode }) {
  const icon: IconName = tone === "error" ? "alert" : tone === "warning" ? "alert" : tone === "success" ? "checkCircle" : "info";
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

/**
 * Goes to `to` without leaving this page behind it in history, so `to`'s own Back button can't return here.
 * Opened from `to` (a link with `state={{ from: to }}`): steps back. Otherwise: replaces this page with `to`.
 */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  const cameFrom = (useLocation().state as { from?: string } | null)?.from === to;
  return (
    <Link
      to={to}
      replace
      className="back-link"
      onClick={(e) => {
        if (!cameFrom) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      <Icon name="chevronLeft" size={18} strokeWidth={2} />
      {children}
    </Link>
  );
}

/**
 * Goes back one page; if the page was opened directly (no history), replaces it with `fallback`.
 * Replacing (not pushing) matters: a pushed fallback leaves this page behind it, so the fallback's
 * own Back button would step straight back here.
 */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="back-link"
      onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }))}
    >
      <Icon name="chevronLeft" size={18} strokeWidth={2} />
      {label}
    </button>
  );
}

export function PageHead({ eyebrow, title, lead, actions }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

export function Loading() {
  return (
    <p className="loading" role="status">
      Loading…
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}
