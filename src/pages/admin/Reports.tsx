import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Tabs } from "../../components/Filters";
import { BackButton, PageHead } from "../../components/ui";
import { officeReport, type OfficeReport } from "../../data/api";
import { longDate, shortDate } from "../../lib/format";

type Range = "30" | "90" | "all";
const LOGGED = "#1d4eb8";
const RETURNED = "#b8860b";

/** Office reports: what came in, what went back to owners, and where things get lost. */
export function Reports() {
  const [range, setRange] = useState<Range>("90");
  const r = officeReport(range === "all" ? undefined : Number(range));

  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Items logged", value: String(r.logged) },
    { label: "Returned to owners", value: String(r.returned) },
    { label: "Return rate", value: r.returnRate === null ? "—" : `${r.returnRate}%`, note: "of items logged in this period" },
    { label: "Median days to return", value: r.medianDaysToReturn === null ? "—" : String(r.medianDaysToReturn), note: "from found to picked up" },
    { label: "Lost reports filed", value: String(r.lostReports) },
    { label: "Claims decided", value: String(r.approved + r.rejected), note: `${r.approved} approved · ${r.rejected} rejected` },
  ];

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead
        eyebrow="OFFICE REPORTS"
        title="Reports"
        lead={`${longDate(r.from)} to ${longDate(r.to)}. Counts come from the item, claim and report records.`}
        actions={
          <button className="btn btn--outline btn--lg" onClick={() => downloadCsv(r)}>
            <Icon name="download" size={20} /> Download CSV
          </button>
        }
      />
      <Tabs
        value={range}
        onChange={setRange}
        tabs={[
          { key: "30", label: "Last 30 days" },
          { key: "90", label: "Last 90 days" },
          { key: "all", label: "All time" },
        ]}
      />
      <div className="report-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="report-tile">
            <span className="report-tile__label">{t.label}</span>
            <strong className="report-tile__value">{t.value}</strong>
            {t.note && <span className="report-tile__note">{t.note}</span>}
          </div>
        ))}
      </div>
      <section className="panel chart-card" aria-labelledby="weekly-h">
        <div className="chart-card__head">
          <h2 id="weekly-h" className="chart-card__title">
            Items logged and returned, by week
          </h2>
          <ul className="legend" aria-label="Legend">
            <li>
              <span className="legend__swatch" style={{ background: LOGGED }} /> Logged
            </li>
            <li>
              <span className="legend__swatch" style={{ background: RETURNED }} /> Returned
            </li>
          </ul>
        </div>
        <WeeklyBars weeks={r.weeks} />
        <details className="chart-table">
          <summary>Show as a table</summary>
          <table className="table">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Logged</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {r.weeks.map((w) => (
                <tr key={w.start}>
                  <td>{shortDate(w.start)}</td>
                  <td>{w.logged}</td>
                  <td>{w.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <div className="report-pair">
        <RankList title="Top categories" sub="Found items logged in this period" rows={r.topCategories} />
        <RankList title="Top locations" sub="Where found items were picked up" rows={r.topLocations} />
      </div>
      <p className="muted report-foot">
        Return rate counts items logged in this period that have since gone back to their owners. Items logged near the end of the period may still be
        claimed. {r.disposed > 0 && `${r.disposed} item${r.disposed === 1 ? " was" : "s were"} donated or disposed of in this period.`}
      </p>
    </div>
  );
}

function WeeklyBars({ weeks }: { weeks: OfficeReport["weeks"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1180;
  const H = 300;
  const pad = { l: 40, r: 8, t: 12, b: 34 };
  const max = Math.max(4, ...weeks.flatMap((w) => [w.logged, w.returned]));
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const top = Math.ceil(max / step) * step;
  const band = (W - pad.l - pad.r) / Math.max(weeks.length, 1);
  const bar = Math.min(24, (band - 14) / 2);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const base = y(0);
  const col = (x: number, v: number, color: string) => {
    if (!v) return null;
    const h = base - y(v);
    const rr = Math.min(4, h);
    return <path d={`M${x},${base} V${base - h + rr} q0,-${rr} ${rr},-${rr} h${bar - 2 * rr} q${rr},0 ${rr},${rr} V${base} Z`} fill={color} />;
  };
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const hw = hover === null ? null : weeks[hover];

  return (
    <div className="weekly" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart of items logged and returned each week" className="weekly__svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#b8bcc6" : "#e6e8ec"} strokeWidth={1} />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" className="weekly__tick" fill="#5b6170" fontSize={13} fontFamily="Inter, sans-serif">
              {t}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = pad.l + band * i + band / 2;
          return (
            <g key={w.start}>
              {hover === i && <rect x={pad.l + band * i + 2} y={pad.t} width={band - 4} height={base - pad.t} fill="#f1f3f7" rx={6} />}
              {col(cx - bar - 1, w.logged, LOGGED)}
              {col(cx + 1, w.returned, RETURNED)}
              {(i % (weeks.length > 16 ? 2 : 1) === 0 || i === weeks.length - 1) && (
                <text x={cx} y={H - 10} textAnchor="middle" className="weekly__tick" fill="#5b6170" fontSize={13} fontFamily="Inter, sans-serif">
                  {shortDate(w.start).replace(/, \d{4}$/, "")}
                </text>
              )}
              <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t} fill="#000" fillOpacity={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`Week of ${shortDate(w.start)}: ${w.logged} logged, ${w.returned} returned`} />
            </g>
          );
        })}
      </svg>
      {hw && (
        <div className="weekly__tip" style={{ left: `${((pad.l + band * hover! + band / 2) / W) * 100}%` }}>
          <strong>Week of {shortDate(hw.start)}</strong>
          <span>
            <i style={{ background: LOGGED }} /> Logged <b>{hw.logged}</b>
          </span>
          <span>
            <i style={{ background: RETURNED }} /> Returned <b>{hw.returned}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function RankList({ title, sub, rows }: { title: string; sub: string; rows: { name: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="panel rank" aria-label={title}>
      <h2 className="chart-card__title">{title}</h2>
      <p className="muted">{sub}</p>
      {rows.length === 0 ? (
        <p className="muted">No items in this period.</p>
      ) : (
        <ul className="rank__list">
          {rows.map((r) => (
            <li key={r.name} className="rank__row">
              <span className="rank__name">{r.name}</span>
              <span className="rank__track">
                <span className="rank__bar" style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className="rank__n">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function downloadCsv(r: OfficeReport) {
  const rows = [
    ["BalikGamit office report", `${r.from} to ${r.to}`],
    [],
    ["Items logged", r.logged],
    ["Returned to owners", r.returned],
    ["Return rate (%)", r.returnRate ?? ""],
    ["Median days to return", r.medianDaysToReturn ?? ""],
    ["Lost reports filed", r.lostReports],
    ["Claims approved", r.approved],
    ["Claims rejected", r.rejected],
    ["Donated or disposed", r.disposed],
    [],
    ["Week of", "Logged", "Returned"],
    ...r.weeks.map((w) => [w.start, w.logged, w.returned]),
    [],
    ["Category", "Items logged"],
    ...r.topCategories.map((c) => [c.name, c.n]),
    [],
    ["Location", "Items logged"],
    ...r.topLocations.map((c) => [c.name, c.n]),
  ];
  const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `balikgamit-report-${r.from}-to-${r.to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
