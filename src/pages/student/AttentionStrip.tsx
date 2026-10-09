import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { itemFor, listMyClaims, listMyReports } from "../../data/api";
import { longDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Card = { key: string; to: string; tone: "amber" | "blue" | "green"; eyebrow: string; title: string; text: string };

/** Phone home: a sideways row of the things waiting on the student (replies, matches, pickups). */
export function AttentionStrip() {
  const { user } = useAuth();
  const claims = useLoad(() => listMyClaims(user!.id), [user?.id]);
  const reports = useLoad(() => listMyReports(user!.id), [user?.id]);
  if (!claims || !reports) return null;

  const cards: Card[] = [];
  for (const c of claims) {
    const item = itemFor(c.itemId);
    if (!item) continue;
    if (c.status === "needs_info")
      cards.push({ key: c.id, to: `/claims/${c.id}`, tone: "amber", eyebrow: "REPLY NEEDED", title: item.title, text: `The office asked about claim ${c.id}` });
    if (c.status === "approved")
      cards.push({ key: c.id, to: `/claims/${c.id}`, tone: "green", eyebrow: "READY FOR PICKUP", title: item.title, text: c.pickupBy ? `Pick up by ${longDate(c.pickupBy)}` : "Bring your RTU ID" });
  }
  for (const r of reports) {
    // Same count My reports shows.
    const n = r.status === "active" ? r.matchCount : 0;
    if (n > 0) cards.push({ key: r.id, to: `/reports/${r.id}/matches`, tone: "blue", eyebrow: `${n} POSSIBLE MATCH${n === 1 ? "" : "ES"}`, title: r.title, text: `For your report ${r.id}` });
  }
  const order = { amber: 0, blue: 1, green: 2 };
  cards.sort((a, b) => order[a.tone] - order[b.tone]);
  if (!cards.length) return null;

  return (
    <section className="attention" aria-labelledby="attention-h">
      <h2 id="attention-h" className="m-section-title">
        Needs your attention
      </h2>
      <div className="attention__row">
        {cards.map((c) => (
          <Link key={c.key} to={c.to} className={`attention__card attention__card--${c.tone}`}>
            <span className="attention__eyebrow">{c.eyebrow}</span>
            <strong>{c.title}</strong>
            <span>{c.text}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
