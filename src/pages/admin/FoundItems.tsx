import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { ModalLink } from "../../components/Modal";
import { Filter, SearchBox, Tabs } from "../../components/Filters";
import { BackButton, EmptyState, ItemBadge, ItemPhoto, Loading, PageHead } from "../../components/ui";
import { CATEGORIES, LOCATIONS, OFFICE, daysHeld, isUnclaimed, listAllFoundItems } from "../../data/api";
import { ON_SHELF, type FoundItem } from "../../data/types";
import { shortDate } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type View = "shelf" | "returned" | "gone" | "all";
const IN_VIEW: Record<View, (i: FoundItem) => boolean> = {
  shelf: (i) => ON_SHELF.includes(i.status),
  returned: (i) => i.status === "returned",
  gone: (i) => i.status === "donated" || i.status === "disposed",
  all: () => true,
};

/** Office inventory: every found item, including returned and disposed ones. */
export function FoundItems() {
  const items = useLoad(() => listAllFoundItems(), []);
  const [view, setView] = useState<View>("shelf");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  if (!items) return <Loading />;

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!location || i.location === location) &&
      words.every((w) => `${i.id} ${i.title} ${i.description} ${i.shelfTag ?? ""}`.toLowerCase().includes(w)),
  );
  const shown = filtered.filter(IN_VIEW[view]);
  const count = (k: View) => filtered.filter(IN_VIEW[k]).length;
  const unclaimed = items.filter(isUnclaimed).length;

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead
        eyebrow="INVENTORY"
        title="Found items"
        lead="Everything the office has logged. Open an item for its private details and claims."
        actions={
          <Link to="/admin/log-item" className="btn btn--blue btn--lg">
            <Icon name="plusCircle" size={22} /> Log Found Item
          </Link>
        }
      />
      {unclaimed > 0 && (
        <Link to="/admin/unclaimed" className="notice-bar">
          <Icon name="clock" size={20} />
          <span>
            <strong>
              {unclaimed} {unclaimed === 1 ? "item is" : "items are"} past the {OFFICE.holdingDays}-day holding period
            </strong>{" "}
            with no open claim. Decide what happens to them.
          </span>
          <Icon name="arrowRight" size={20} className="notice-bar__arrow" />
        </Link>
      )}
      <section className="search-panel" aria-label="Filter found items">
        <div className="search-panel__row search-panel__row--split">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name, ID or shelf tag..." />
          <Filter label="Category" value={category} onChange={setCategory} all="All categories" options={CATEGORIES} />
          <Filter label="Location" value={location} onChange={setLocation} all="All locations" options={LOCATIONS} />
        </div>
      </section>
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { key: "shelf", label: "On the shelf", count: count("shelf") },
          { key: "returned", label: "Returned", count: count("returned") },
          { key: "gone", label: "Donated or disposed", count: count("gone") },
          { key: "all", label: "All", count: filtered.length },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title="No items match these filters." />
      ) : (
        <div className="table-card table-scroll">
          <table className="table table--stack">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Found</th>
                <th>Held</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const days = daysHeld(i);
                const late = isUnclaimed(i);
                return (
                  <tr key={i.id}>
                    <td>
                      <ModalLink to={`/admin/items/${i.id}`} className="cell-item">
                        <ItemPhoto src={i.photo} alt="" className="cell-item__thumb" />
                        <span>
                          <strong>{i.title}</strong>
                          <small>
                            {i.id}
                            {i.shelfTag && ` · Shelf ${i.shelfTag}`}
                          </small>
                        </span>
                      </ModalLink>
                    </td>
                    <td>{i.category}</td>
                    <td>
                      <span className="cell-two">
                        <span>{i.location}</span>
                        <small>{shortDate(i.foundOn)}</small>
                      </span>
                    </td>
                    <td>
                      <span className={late ? "held held--late" : "held"}>
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                    </td>
                    <td>
                      <ItemBadge status={i.status} />
                    </td>
                    <td>
                      <ModalLink to={`/admin/items/${i.id}`} aria-label={`Open ${i.id}`} className="icon-btn">
                        <Icon name="chevronRight" size={20} />
                      </ModalLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
