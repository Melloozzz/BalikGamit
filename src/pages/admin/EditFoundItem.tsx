import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Alert, BackButton, EmptyState, ItemBadge, Loading, PageHead } from "../../components/ui";
import { getFoundItem, listClaimsForItem, updateFoundItem } from "../../data/api";
import { ON_SHELF } from "../../data/types";
import { useLoad } from "../../lib/useLoad";
import { FoundItemForm } from "./FoundItemForm";

/** Fix a logged item's details. Changes to the public fields show to students right away. */
export function EditFoundItem() {
  const { itemId = "" } = useParams();
  const navigate = useNavigate();
  const fromPopup = !!(useLocation().state as { fromPopup?: boolean } | null)?.fromPopup;
  const item = useLoad(() => getFoundItem(itemId, { admin: true }), [itemId]);
  const claims = useLoad(() => listClaimsForItem(itemId), [itemId]);
  if (item === undefined || !claims) return <Loading />;
  if (!item)
    return (
      <div className="container stack-lg">
        <BackButton fallback="/admin/items" />
        <EmptyState title="We couldn't find that item." />
      </div>
    );
  const openClaims = claims.filter((c) => ["pending", "needs_info", "approved"].includes(c.status)).length;
  const closed = !ON_SHELF.includes(item.status);
  // From the popup: step back to that same popup so closing it returns to the list behind it.
  // Pushing a fresh popup instead leaves the old one in history, and Back would reopen it.
  const back = () => (fromPopup ? navigate(-1) : navigate(`/admin/items/${item.id}`, { replace: true }));

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin/items" />
      <PageHead
        eyebrow={`EDIT ITEM · ${item.id}`}
        title="Edit found item"
        lead="Public details update for students right away. Private details stay office-only."
        actions={<ItemBadge status={item.status} large />}
      />
      {openClaims > 0 && (
        <Alert tone="warning">
          This item has {openClaims} open claim{openClaims === 1 ? "" : "s"}. Don’t change the private details to match a claimant’s answers. Fix only what was
          recorded wrong at intake.
        </Alert>
      )}
      {closed ? (
        <Alert tone="info">
          This item is no longer with the office, so it can’t be edited. <Link to="/admin/items" replace>Back to found items</Link>
        </Alert>
      ) : (
        <FoundItemForm
          initial={{
            title: item.title,
            category: item.category,
            location: item.location,
            locationDetail: item.locationDetail ?? "",
            foundOn: item.foundOn,
            shelfTag: item.shelfTag ?? "",
            description: item.description,
            privateDetails: item.privateDetails ?? "",
            photo: item.photo,
          }}
          submitLabel="Save changes"
          onSubmit={async ({ locationDetail, shelfTag, ...v }) => {
            await updateFoundItem(item.id, { ...v, locationDetail: locationDetail || undefined, shelfTag: shelfTag || undefined });
            back();
          }}
          actions={
            <button type="button" className="btn btn--outline btn--lg" onClick={back}>
              Cancel
            </button>
          }
        />
      )}
    </div>
  );
}
