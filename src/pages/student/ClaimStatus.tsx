import { useState } from "react";
import { useParams } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackLink, ClaimBadge, EmptyState, ItemPhoto, Loading } from "../../components/ui";
import { MessageThread } from "../../components/MessageThread";
import { OFFICE, getClaim, withdrawClaim } from "../../data/api";
import type { Claim } from "../../data/types";
import { longDate, longDateTime } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Step = { key: string; label: string; detail: string; state: "done" | "current" | "todo" | "stopped" };

function stepsFor(c: Claim): Step[] {
  const at = (s: string) => c.history.find((h) => h.status === s)?.at;
  const reviewed = at("under_review") ?? at("needs_info") ?? at("approved") ?? at("rejected");
  const decided = at("approved") ?? at("rejected");
  const done = c.status === "completed";
  const stopped = ["rejected", "withdrawn", "expired"].includes(c.status);
  return [
    { key: "s", label: "Submitted", detail: longDateTime(c.filedOn), state: "done" },
    {
      key: "r",
      label: c.status === "needs_info" ? "Needs info · now" : "Under review",
      detail: c.status === "needs_info" ? "The office asked you a question. Reply in the messages." : reviewed ? longDateTime(reviewed) : "The office will review your answers",
      state: c.status === "needs_info" ? "current" : reviewed || decided ? "done" : "current",
    },
    {
      key: "d",
      label: c.status === "rejected" ? "Rejected" : c.status === "withdrawn" ? "Withdrawn" : "Decision",
      detail: decided ? `${c.status === "rejected" ? c.decisionReason ?? "Rejected" : "Approved"} · ${longDateTime(decided)}` : "Approved or rejected by the office",
      state: stopped ? "stopped" : decided ? "done" : "todo",
    },
    {
      key: "p",
      label: "Picked up",
      detail: done ? longDateTime(c.history[c.history.length - 1].at) : "At the office, with your RTU ID",
      state: done ? "done" : c.status === "approved" ? "current" : "todo",
    },
  ];
}

export function ClaimStatusPage() {
  const { claimId = "" } = useParams();
  const claim = useLoad(() => getClaim(claimId), [claimId]);
  const [confirming, setConfirming] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  if (claim === undefined) return <Loading />;
  if (claim === null)
    return (
      <div className="container">
        <BackLink to="/claims">My claims</BackLink>
        <EmptyState title="We couldn't find that claim." />
      </div>
    );
  const item = claim.item;
  const open = claim.status === "pending" || claim.status === "needs_info";
  const threadOpen = open || claim.status === "approved";

  return (
    <div className="container stack-lg">
      <BackLink to="/claims">My claims</BackLink>
      <section className="claim-head">
        <ItemPhoto src={item.photo} alt={item.title} className="claim-head__photo" />
        <div className="claim-head__main">
          <p className="claim-head__ref">
            CLAIM {claim.id} · ITEM {item.id}
          </p>
          <h1 className="claim-head__title">{item.title}</h1>
          <p className="meta-line">
            <span>
              <Icon name="pin" size={18} /> Found in {item.location}
            </span>
            <span>
              <Icon name="calendar" size={18} /> Found {longDate(item.foundOn)}
            </span>
          </p>
        </div>
        <div className="claim-head__side">
          <ClaimBadge status={claim.status} large />
          {open &&
            (confirming ? (
              <span className="confirm-inline">
                Withdraw this claim?
                <button className="link-btn link-btn--danger" onClick={() => withdrawClaim(claim.id).catch((e: Error) => setWithdrawError(e.message))}>
                  Yes, withdraw
                </button>
                <button className="link-btn" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </span>
            ) : (
              <button className="link-btn link-btn--danger" onClick={() => setConfirming(true)}>
                Withdraw claim
              </button>
            ))}
        </div>
      </section>

      {withdrawError && <Alert>{withdrawError}</Alert>}
      <div className="two-col">
        <section className="panel" aria-labelledby="prog-h">
          <h2 id="prog-h" className="panel__title">
            Claim progress
          </h2>
          <ol className="timeline">
            {stepsFor(claim).map((s) => (
              <li key={s.key} className={`timeline__step timeline__step--${s.state}`}>
                <span className="timeline__dot">{s.state === "done" && <Icon name="check" size={14} strokeWidth={3} />}</span>
                <div>
                  <strong>{s.label}</strong>
                  <span>{s.detail}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="note-box">
            {claim.status === "approved"
              ? `Pick up the item at ${claim.pickupOffice ?? OFFICE.name} by ${longDate(claim.pickupBy!)}. Bring your RTU ID.`
              : `If your claim is approved, pick up the item at ${OFFICE.name} within ${OFFICE.pickupDays} working days. Bring your RTU ID.`}
          </p>
        </section>
        <MessageThread claimId={claim.id} viewer="owner" open={threadOpen} />
      </div>
    </div>
  );
}
