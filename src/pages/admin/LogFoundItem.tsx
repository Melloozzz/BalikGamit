import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { Icon } from "../../components/Icon";
import { BackButton, Alert, PageHead, SelectField, TextAreaField, TextField } from "../../components/ui";
import { logFoundItem } from "../../data/api";
import { CATEGORIES, LOCATIONS } from "../../data/mock";
import { useAuth } from "../../auth/AuthContext";
import { fieldErrors, foundItemSchema } from "../../lib/validation";
import { todayIso } from "../../lib/format";

const EMPTY = { title: "", category: "", location: "", foundOn: todayIso(), description: "", privateDetails: "" };

export function LogFoundItem() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = foundItemSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    // Production: this insert also queues AI matching against open lost reports in the Worker.
    const item = await logFoundItem({ ...parsed.data, photo, loggedBy: user?.fullName });
    setSavedId(item.id);
    setForm(EMPTY);
    setPhoto(undefined);
  }

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin" />
      <PageHead eyebrow="OFFICE INTAKE" title="Log a found item" lead="Record public details and keep ownership evidence separate for claim review." />
      {savedId && (
        <Alert tone="success">
          Saved as <b>{savedId}</b>. Students can now see it, and matching against open lost reports has started.{" "}
          <Link to="/admin">Back to dashboard</Link>
        </Alert>
      )}
      <form className="form-card form-card--white form-card--narrow" onSubmit={submit} noValidate>
        <TextField label="Item name" placeholder="Ex. Black leather wallet" value={form.title} onChange={set("title")} error={errors.title} maxLength={60} />
        <div className="form-grid-2">
          <SelectField label="Category" placeholder="Choose a category" options={CATEGORIES} value={form.category} onChange={set("category")} error={errors.category} />
          <SelectField label="Found location" placeholder="Choose a location" options={LOCATIONS} value={form.location} onChange={set("location")} error={errors.location} />
        </div>
        <TextField label="Date found" type="date" max={todayIso()} value={form.foundOn} onChange={set("foundOn")} error={errors.foundOn} />
        <TextAreaField label="Public description" rows={3} placeholder="General appearance visible to students..." value={form.description} onChange={set("description")} error={errors.description} maxLength={500} />
        <div className="field">
          <span className="field__label">Item photo</span>
          <label className="dropzone dropzone--small">
            <input
              type="file"
              accept="image/jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(URL.createObjectURL(f));
              }}
            />
            {photo ? <img src={photo} alt="Selected item photo" className="dropzone__preview" /> : <Icon name="upload" size={24} />}
            <span>{photo ? "Choose another photo" : "Choose a photo (JPEG, up to 2 MB)"}</span>
          </label>
        </div>
        <TextAreaField
          label="Private verification details"
          locked
          rows={3}
          value={form.privateDetails}
          onChange={set("privateDetails")}
          error={errors.privateDetails}
          hint="Admin-only. Record contents, markings, or hidden features a claimant should know."
          maxLength={500}
        />
        <div>
          <button className="btn btn--blue btn--lg">Save item record</button>
        </div>
      </form>
    </div>
  );
}
