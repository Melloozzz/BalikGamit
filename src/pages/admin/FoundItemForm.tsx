import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { SelectField, TextAreaField, TextField } from "../../components/ui";
import { CATEGORIES, LOCATIONS } from "../../data/mock";
import { fieldErrors, foundItemSchema } from "../../lib/validation";
import { todayIso } from "../../lib/format";

export const EMPTY_ITEM = {
  title: "",
  category: "",
  location: "",
  locationDetail: "",
  foundOn: todayIso(),
  shelfTag: "",
  description: "",
  privateDetails: "",
};
export type ItemFormValues = typeof EMPTY_ITEM & { photo?: string };

/** The office's found-item form, shared by Log found item and Edit found item. */
export function FoundItemForm({
  initial,
  submitLabel,
  onSubmit,
  actions,
}: {
  initial: ItemFormValues;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  /** Extra buttons next to submit, e.g. Cancel */
  actions?: ReactNode;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY_ITEM) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  // An archived category or location stays selectable on records that already use it.
  const withCurrent = (list: string[], v: string) => (v && !list.includes(v) ? [...list, v] : list);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = foundItemSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      await onSubmit({ ...form, ...parsed.data } as ItemFormValues);
      if (initial === EMPTY_ITEM) setForm(EMPTY_ITEM);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card form-card--white form-card--narrow" onSubmit={submit} noValidate>
      <TextField label="Item name" placeholder="Ex. Black leather wallet" value={form.title} onChange={set("title")} error={errors.title} maxLength={60} />
      <div className="form-grid-2">
        <SelectField label="Category" placeholder="Choose a category" options={withCurrent(CATEGORIES, form.category)} value={form.category} onChange={set("category")} error={errors.category} />
        <SelectField label="Found location" placeholder="Choose a location" options={withCurrent(LOCATIONS, form.location)} value={form.location} onChange={set("location")} error={errors.location} />
      </div>
      <div className="form-grid-2">
        <TextField label="Exact spot (optional)" placeholder="Ex. Window-side tables" value={form.locationDetail} onChange={set("locationDetail")} maxLength={80} />
        <TextField label="Date found" type="date" max={todayIso()} value={form.foundOn} onChange={set("foundOn")} error={errors.foundOn} />
      </div>
      <TextField label="Shelf tag" placeholder="Ex. A-14" hint="Where the item is stored in the office." value={form.shelfTag} onChange={set("shelfTag")} error={errors.shelfTag} maxLength={10} />
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
              if (f) setForm((v) => ({ ...v, photo: URL.createObjectURL(f) }));
            }}
          />
          {form.photo ? <img src={form.photo} alt="Selected item photo" className="dropzone__preview" /> : <Icon name="upload" size={24} />}
          <span>{form.photo ? "Choose another photo" : "Choose a photo (JPEG, up to 2 MB)"}</span>
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
      <div className="form-buttons">
        <button className="btn btn--blue btn--lg" disabled={busy}>
          {submitLabel}
        </button>
        {actions}
      </div>
    </form>
  );
}
