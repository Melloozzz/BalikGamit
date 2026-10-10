import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { emit } from "../data/events";
import { listMessages, sendMessage, subscribeToMessages } from "../data/api";
import { blockMessage, findBlockedDetail } from "../lib/validation";
import { shortDateTime } from "../lib/format";
import { useLoad } from "../lib/useLoad";

/**
 * Claim-scoped chat. People appear only by alias ("Office" / "Owner"). New messages arrive live
 * through Supabase Realtime; row-level security limits the thread to the claimant and the office.
 */
export function MessageThread({ claimId, viewer, open }: { claimId: string; viewer: "owner" | "office"; open: boolean }) {
  const msgs = useLoad(() => listMessages(claimId), [claimId]);
  useEffect(() => subscribeToMessages(claimId, emit), [claimId]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  // Scroll only the thread box to the newest message. scrollIntoView would also scroll the page.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  const alias = (from: "owner" | "office") =>
    from === viewer ? (viewer === "office" ? "You (Office)" : "You") : from === "office" ? "Office" : "Owner";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const blocked = findBlockedDetail(body);
    if (blocked) return setError(blockMessage[blocked]);
    setError("");
    setBusy(true);
    try {
      await sendMessage(claimId, body);
      setText("");
    } catch (err) {
      // The database also blocks contact details, rate-limits, and refuses closed threads.
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = viewer === "owner" ? "Messages with the Office" : "Messages with the claimant";
  return (
    <section className="panel thread" aria-labelledby="thread-h">
      <h2 id="thread-h" className="panel__title">
        {title}
      </h2>
      <p className="panel__sub">
        <Icon name="lock" size={14} />{" "}
        {viewer === "owner"
          ? "Only you and office staff can see this thread."
          : "The student sees you as “Office.” Sending a question moves the claim to Needs info."}
      </p>
      <div className="thread__list" aria-live="polite" ref={list}>
        {msgs?.length === 0 && <p className="muted">No messages yet.</p>}
        {msgs?.map((m) => {
          const mine = m.from === viewer;
          return (
            <div key={m.id} className={`bubble-row ${mine ? "bubble-row--mine" : ""}`}>
              <span className="bubble-row__meta">
                {alias(m.from)} · {shortDateTime(m.at)}
              </span>
              <p className={`bubble ${mine ? "bubble--mine" : ""}`}>{m.body}</p>
            </div>
          );
        })}
      </div>
      {open ? (
        <form className="thread__form" onSubmit={submit}>
          <label className="field__label" htmlFor={`reply-${claimId}`}>
            {viewer === "owner" ? "Your reply" : "Ask the claimant a question"}
          </label>
          <div className="thread__compose">
            <textarea
              id={`reply-${claimId}`}
              className={`input textarea ${error ? "input--error" : ""}`}
              rows={3}
              maxLength={1000}
              placeholder={viewer === "owner" ? "Type your answer to the office" : "Ask the claimant a question"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn btn--navy" disabled={busy}>
              <Icon name="send" size={18} /> Send
            </button>
          </div>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : (
            <p className="field__hint">Don't share phone numbers, emails, or social media accounts here.</p>
          )}
        </form>
      ) : (
        <p className="muted">This thread is closed because the claim has ended.</p>
      )}
    </section>
  );
}
