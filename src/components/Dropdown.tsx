import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type DropdownItem = { value: string; text: string };

/**
 * The app's dropdown, used instead of a native <select> everywhere: browsers and phones draw
 * the native list in the system font, so this list uses the app's own font and colours.
 * Renders only the trigger button; the caller wraps it and adds the chevron, as with a <select>.
 */
export function Dropdown({
  id,
  className,
  label,
  value,
  items,
  invalid,
  onChange,
}: {
  id?: string;
  className: string;
  label: string;
  value: string;
  items: DropdownItem[];
  invalid?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // A value missing from the list (ex. an archived category on an old record) still shows as
  // itself and stays selected, instead of the field silently showing the first option.
  const options = value && !items.some((i) => i.value === value) ? [...items, { value, text: value }] : items;
  const current = options.find((i) => i.value === value) ?? options[0];

  // Pinned to the screen next to the button (filter rows scroll sideways and would clip it).
  // Opens upward when the button sits low on the screen.
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    // On desktop index.html zooms the page. Rects come back in screen px, but the list's own
    // left/top get zoomed again, so convert everything to page px first.
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const rect = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { left: b.left / z, top: b.top / z, bottom: b.bottom / z, width: b.width / z, height: b.height / z };
    };
    const r = rect(btn.current);
    const W = window.innerWidth / z;
    const H = window.innerHeight / z;
    const head = document.querySelector(".topbar, .admin-top");
    const header = head ? rect(head).bottom : 0;
    const tabbar = document.querySelector(".tabbar");
    const footer = tabbar && getComputedStyle(tabbar).display !== "none" ? rect(tabbar).height : 0;
    const width = Math.min(Math.max(r.width, 220), W - 32);
    const left = Math.max(16, Math.min(r.left, W - width - 16));
    const below = H - r.bottom - footer - 16;
    const above = r.top - header - 16;
    setPos(
      below >= 240 || below >= above
        ? { left, width, top: r.bottom + 8, maxHeight: below }
        : { left, width, bottom: H - r.top + 8, maxHeight: above },
    );
  }, [open]);

  useEffect(() => {
    // Focus the selected option, or the first one, so arrow keys always work once it's open.
    const target = list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]');
    if (pos) target?.focus({ preventScroll: true });
  }, [pos]);

  // Close on a click outside, or when the page or filter row scrolls (the list would drift away).
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => !list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node);
    const onDown = (e: PointerEvent) => outside(e) && setOpen(false);
    const onScroll = (e: Event) => outside(e) && setOpen(false);
    // Only a width change closes it: phone browsers also resize when the address bar hides.
    const width = window.innerWidth;
    const onResize = () => window.innerWidth !== width && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      setPos(null);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const opts = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      opts[(at + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      opts[e.key === "Home" ? 0 : opts.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`${className} ${current.value === "" ? "is-empty" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={id ? undefined : `${label}: ${current.text}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
      >
        {current.text}
      </button>
      {open &&
        pos &&
        createPortal(
          <ul ref={list} role="listbox" aria-label={label} className="dropdown" style={pos} onKeyDown={onListKey}>
            {options.map((i) => (
              <li
                key={i.value}
                role="option"
                tabIndex={-1}
                aria-selected={i.value === value}
                className="dropdown__option"
                onClick={() => pick(i.value)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(i.value))}
              >
                <span>{i.text}</span>
                {i.value === value && <Icon name="check" size={18} strokeWidth={2.4} />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
