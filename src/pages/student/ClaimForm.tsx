import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, BackButton, CategoryPill, EmptyState, ItemPhoto, Loading, TextAreaField } from "../../components/ui";
import { createClaim, getFoundItem, isClaimable, listProofQuestions } from "../../data/api";
import { claimSchema, fieldErrors } from "../../lib/validation";
import { useLoad } from "../../lib/useLoad";


export function ClaimForm() {
  const { itemId = "" } = useParams();
  const navigate = useNavigate();
  const item = useLoad(() => getFoundItem(itemId), [itemId]);
  // The office's proof questions: the general ones plus this category's own (proof_questions table).
  const questions = useLoad(() => (item ? listProofQuestions(item.category) : Promise.resolve([])), [item?.category]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (item === undefined || (item && questions === undefined)) return <Loading />;
  const QUESTIONS = questions ?? [];
  if (!item || !isClaimable(item))
    return (
      <div className="container stack-lg">
        <BackButton fallback="/items" />
        <EmptyState title="This item can't be claimed.">The office no longer has it, or it's already being returned to its owner.</EmptyState>
      </div>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = claimSchema.safeParse({ answers: QUESTIONS.map((_, i) => answers[i] ?? "") });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const claim = await createClaim(itemId, QUESTIONS.map((_, i) => (answers[i] ?? "").trim()), QUESTIONS);
      // Replace the form so Back can't reopen a claim that was already sent.
      navigate(`/claims/${claim.id}/submitted`, { replace: true });
    } catch (err) {
      setErrors({ _: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="container stack-lg">
      <BackButton fallback={`/items/${item.id}`} />
      <form className="detail-card" onSubmit={submit} noValidate>
        <header>
          <p className="detail-card__eyebrow">CLAIMING {item.id}</p>
          <h1 className="page-title">Tell me why it’s yours</h1>
          <p className="page-lead">Your answers are private and will only be used by the Office to verify ownership.</p>
        </header>
        <div className="claim-item">
          <ItemPhoto src={item.photo} alt={item.title} className="claim-item__photo" />
          <div>
            <CategoryPill>{item.category}</CategoryPill>
            <h2 className="claim-item__title">{item.title}</h2>
            <p className="muted">Found at {item.location}</p>
          </div>
        </div>
        {errors._ && <Alert>{errors._}</Alert>}
        {QUESTIONS.map((q, i) => (
          <TextAreaField
            key={q}
            label={q}
            rows={3}
            value={answers[i] ?? ""}
            onChange={(e) => setAnswers((a) => QUESTIONS.map((_, j) => (j === i ? e.target.value : (a[j] ?? ""))))}
            error={errors[`answers.${i}`]}
            maxLength={500}
          />
        ))}
        <div className="form-actions">
          <button className="btn btn--navy btn--lg btn--wide" disabled={busy}>
            {busy ? "Submitting…" : "Submit claim"}
          </button>
          <button type="button" className="btn btn--muted btn--lg" onClick={() => setAnswers([])}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
