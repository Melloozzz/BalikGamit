import { Icon } from "./Icon";
import { Dropdown } from "./Dropdown";

/** Search box + dropdown filters used on the list pages. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search-input">
      <Icon name="search" size={20} />
      <span className="sr-only">Search</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

/** Dropdown filter. `all` adds a first "no filter" option (value ""); leave it out for a plain choice like Sort. */
export function Filter({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all?: string;
  options: string[] | { value: string; label: string }[];
}) {
  const items = [
    ...(all !== undefined ? [{ value: "", text: all }] : []),
    ...options.map((o) => (typeof o === "string" ? { value: o, text: o } : { value: o.value, text: o.label })),
  ];
  return (
    <div className="filter">
      <Dropdown className="filter__btn" label={label} value={value} items={items} onChange={onChange} />
      <Icon name="chevronDown" size={18} />
    </div>
  );
}

/** Row of tab buttons with counts. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className={`tab tab--blue ${value === t.key ? "is-active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && ` (${t.count})`}
        </button>
      ))}
    </div>
  );
}
