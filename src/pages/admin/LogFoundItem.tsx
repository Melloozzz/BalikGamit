import { useState } from "react";
import { Link } from "react-router";
import { BackButton, Alert, PageHead } from "../../components/ui";
import { logFoundItem } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY_ITEM, FoundItemForm } from "./FoundItemForm";

export function LogFoundItem() {
  const { user } = useAuth();
  const [savedId, setSavedId] = useState("");

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead eyebrow="OFFICE INTAKE" title="Log a found item" lead="Record public details and keep ownership evidence separate for claim review." />
      {savedId && (
        <Alert tone="success">
          Saved as <b>{savedId}</b>. Students can now see it, and matching against open lost reports has started.{" "}
          <Link to="/admin/items">See all found items</Link>
        </Alert>
      )}
      <FoundItemForm
        initial={EMPTY_ITEM}
        submitLabel="Save item record"
        onSubmit={async ({ locationDetail, shelfTag, ...v }) => {
          // Production: this insert also queues AI matching against open lost reports in the Worker.
          const item = await logFoundItem({ ...v, locationDetail: locationDetail || undefined, shelfTag: shelfTag || undefined, loggedBy: user?.fullName });
          setSavedId(item.id);
        }}
      />
    </div>
  );
}
