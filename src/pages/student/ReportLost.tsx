import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Icon } from "../../components/Icon";
import { BackButton, Alert, EmptyState, Loading, PageHead, SelectField, TextAreaField, TextField } from "../../components/ui";
import { CATEGORIES, LOCATIONS, createReport, getMyReport, updateReport, withCurrent } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { fieldErrors, lostReportSchema } from "../../lib/validation";
import { todayIso } from "../../lib/format";

const EMPTY = { title: "", category: "", location: "", lostOn: "", description: "", privateDetails: "" };
// Photos are re-encoded and shrunk in the browser before upload, so the raw file can be large.
const MAX_BYTES = 15 * 1024 * 1024;

export function ReportLost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const fromReports = (useLocation().state as { from?: string } | null)?.from === "/reports";
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<{ url: string; name: string; file: File } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Editing: null while loading, false if the report is missing or belongs to someone else.
  const [editable, setEditable] = useState<boolean | null>(editId ? null : true);

  useEffect(() => {
    if (!editId) return;
    getMyReport(user!.id, editId).then((r) => {
      if (r) setForm({ title: r.title, category: r.category, location: r.location, lostOn: r.lostOn, description: r.description, privateDetails: r.privateDetails ?? "" });
      setEditable(!!r);
    });
  }, [editId, user?.id]);

  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setErrors((x) => ({ ...x, photo: "Use a JPEG, PNG or WebP photo." }));
    if (file.size > MAX_BYTES) return setErrors((x) => ({ ...x, photo: "The photo is larger than 15 MB." }));
    // On submit the photo is shrunk and re-encoded in the browser (removing location data), then uploaded.
    setErrors(({ photo: _p, ...rest }) => rest);
    setPhoto({ url: URL.createObjectURL(file), name: file.name, file });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = lostReportSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    if (editId) {
      try {
        await updateReport(user!.id, editId, { ...parsed.data, photoFile: photo?.file });
      } catch (err) {
        setBusy(false);
        return setErrors({ _: (err as Error).message });
      }
      // Opened from My reports: step back to it so its Back button doesn't reopen this form.
      if (fromReports) navigate(-1);
      else navigate("/reports", { replace: true });
    } else {
      try {
        await createReport(user!.id, { ...parsed.data, photoFile: photo?.file });
      } catch (err) {
        setBusy(false);
        return setErrors({ _: (err as Error).message });
      }
      navigate("/report/submitted", { replace: true });
    }
  }

  if (editable === null) return <Loading />;
  if (!editable)
    return (
      <div className="container stack-lg">
        <BackButton fallback="/reports" />
        <EmptyState title="We couldn't find that report.">You can only edit reports you posted. Your reports are under My reports.</EmptyState>
      </div>
    );

  return (
    <div className="container stack-lg">
      <BackButton fallback="/home" />
      <PageHead
        title={editId ? "Edit your report" : "Report a lost item"}
        lead="Share enough public detail for matching, but keep unique identifying details private."
      />
      <form className="form-card" onSubmit={submit} noValidate>
        {errors._ && <Alert>{errors._}</Alert>}
        {Object.keys(errors).length > 1 && <Alert>Check the highlighted fields.</Alert>}
        <TextField label="Item name" placeholder="Ex. Navy blue umbrella" value={form.title} onChange={set("title")} error={errors.title} maxLength={60} />
        <div className="form-grid-3">
          <SelectField label="Category" placeholder="Choose a category" options={withCurrent(CATEGORIES, form.category)} value={form.category} onChange={set("category")} error={errors.category} />
          <SelectField label="Last-seen location" placeholder="Choose a location" options={withCurrent(LOCATIONS, form.location)} value={form.location} onChange={set("location")} error={errors.location} />
          <TextField label="Date last seen" type="date" max={todayIso()} value={form.lostOn} onChange={set("lostOn")} error={errors.lostOn} />
        </div>
        <TextAreaField
          label="Public description"
          rows={4}
          placeholder="Color, size, and general appearance..."
          value={form.description}
          onChange={set("description")}
          error={errors.description}
          hint="Avoid details only the real owner would know."
          maxLength={500}
        />
        <div className={`field ${errors.photo ? "field--error" : ""}`}>
          <span className="field__label">Photo (optional)</span>
          <label className="dropzone">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="sr-only" />
            {photo ? (
              <>
                <img src={photo.url} alt="Selected photo preview" className="dropzone__preview" />
                <span className="dropzone__name">{photo.name} · Choose another</span>
              </>
            ) : (
              <>
                <Icon name="upload" size={36} />
                <span className="dropzone__cta">Choose files</span>
                <span className="dropzone__hint">
                  JPEG, PNG or WebP.
                  <br />
                  Location data is removed before upload.
                </span>
              </>
            )}
          </label>
          {errors.photo && (
            <p className="field__error" role="alert">
              {errors.photo}
            </p>
          )}
        </div>
        <TextAreaField
          label="Private details"
          required
          locked
          rows={4}
          value={form.privateDetails}
          onChange={set("privateDetails")}
          error={errors.privateDetails}
          hint="Only you and admins can see this. Use marks, contents, or other proof of ownership."
          maxLength={500}
        />
        <div className="form-actions">
          <button className="btn btn--navy btn--lg btn--wide" disabled={busy}>
            {busy ? "Saving…" : editId ? "Save changes" : "Submit report"}
          </button>
          <button
            type="button"
            className="btn btn--muted btn--lg"
            onClick={() => {
              setForm(EMPTY);
              setPhoto(null);
              setErrors({});
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
