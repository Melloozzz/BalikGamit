import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, BackLink, CategoryPill, ItemPhoto, Loading, TextAreaField } from "../../components/ui";
import { createClaim, getFoundItem } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { claimSchema, fieldErrors } from "../../lib/validation";
import { useLoad } from "../../lib/useLoad";

// [Confirm with the office] Questions could later vary by category.
const QUESTIONS = [
  "Describe any unique marks, damage, or features.",
  "What was inside or attached to the item?",
  "Where and when did you last have it?",
];

export function ClaimForm() {
  const { itemId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const item = useLoad(() => getFoundItem(itemId), [itemId]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!item) return <Loading />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = claimSchema.safeParse({ answers });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const claim = await createClaim(user!.id, itemId, answers.map((a) => a.trim()), QUESTIONS);
      navigate(`/claims/${claim.id}/submitted`);
    } catch (err) {
      setErrors({ _: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="container stack-lg">
      <BackLink to={`/items/${item.id}`}>Back</BackLink>
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
            value={answers[i]}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
            error={errors[`answers.${i}`]}
            maxLength={500}
          />
        ))}
        <div className="form-actions">
          <button className="btn btn--navy btn--lg btn--wide" disabled={busy}>
            {busy ? "Submitting…" : "Submit claim"}
          </button>
          <button type="button" className="btn btn--muted btn--lg" onClick={() => setAnswers(["", "", ""])}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
