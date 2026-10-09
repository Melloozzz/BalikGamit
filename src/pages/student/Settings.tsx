import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Icon } from "../../components/Icon";
import { Alert, BackButton, PageHead, PasswordField, TextField } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { fieldErrors, resetPasswordSchema } from "../../lib/validation";

export function Settings({ area = "student" }: { area?: "student" | "office" }) {
  const office = area === "office";
  const panel = office ? "panel panel--white" : "panel panel--gray";
  const btn = office ? "btn btn--blue" : "btn btn--navy";
  const { user, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.fullName ?? "");
  const [saved, setSaved] = useState("");
  const [pw, setPw] = useState({ current: "", password: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState({ matches: true, claims: true, newClaims: true, replies: true, flagged: false });
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    // Production: supabase.from("profiles").update({ full_name: name }).eq("id", user.id)
    setSaved("Profile saved.");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password: pw.password, confirm: pw.confirm });
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (!pw.current) errs.current = "Enter your current password.";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    await updatePassword(pw.password);
    setPw({ current: "", password: "", confirm: "" });
    setSaved("Password updated.");
  }

  return (
    <div className="container container--mid stack-lg">
      <BackButton fallback={office ? "/admin" : "/home"} />
      <PageHead
        eyebrow={office ? "OFFICE ACCOUNT" : undefined}
        title="Settings"
        lead={office ? "Office tools, your profile, password and notifications." : "Manage your profile, password, and notifications."}
      />
      {saved && <Alert tone="success">{saved}</Alert>}

      {office && (
        <section className="panel panel--white tools" aria-labelledby="tools-h">
          <h2 id="tools-h" className="panel__title">
            Office tools
          </h2>
          <Link to="/admin/activity" className="tools__row">
            <span className="tools__icon">
              <Icon name="history" size={22} />
            </span>
            <span className="tools__text">
              <strong>Activity log</strong>
              <span>Who logged, edited, released, donated or disposed of items</span>
            </span>
            <Icon name="chevronRight" size={20} />
          </Link>
          {user?.role === "super_admin" && (
            <>
              <Link to="/admin/admins" className="tools__row">
                <span className="tools__icon">
                  <Icon name="users" size={22} />
                </span>
                <span className="tools__text">
                  <strong>
                    Manage admins <span className="tools__only">Super admin only</span>
                  </strong>
                  <span>Add office staff, set roles and deactivate accounts</span>
                </span>
                <Icon name="chevronRight" size={20} />
              </Link>
              <Link to="/admin/places" className="tools__row">
                <span className="tools__icon">
                  <Icon name="tag" size={22} />
                </span>
                <span className="tools__text">
                  <strong>
                    Categories &amp; locations <span className="tools__only">Super admin only</span>
                  </strong>
                  <span>Add, rename or archive the lists students choose from</span>
                </span>
                <Icon name="chevronRight" size={20} />
              </Link>
            </>
          )}
        </section>
      )}

      <form className={panel} onSubmit={saveProfile}>
        <h2 className="panel__title">Profile</h2>
        <div className="form-grid-2">
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="RTU email" value={user?.email ?? ""} readOnly disabled hint="Your RTU email can't be changed." />
        </div>
        <div>
          <button className={btn}>Save changes</button>
        </div>
      </form>

      <form className={panel} onSubmit={changePassword}>
        <h2 className="panel__title">Change password</h2>
        <div className="form-grid-3">
          <PasswordField label="Current password" placeholder="Enter current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErrors.current} />
          <PasswordField label="New password" placeholder="Enter new password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} error={pwErrors.password} />
          <PasswordField label="Confirm new password" placeholder="Re-enter new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErrors.confirm} />
        </div>
        <div>
          <button className={btn}>Update password</button>
        </div>
      </form>

      <section className={panel} aria-labelledby="np">
        <h2 id="np" className="panel__title">
          Notifications
        </h2>
        {office ? (
          <>
            <Toggle label="New claims" text="Email me when a student files a claim on an item." checked={prefs.newClaims} onChange={(v) => setPrefs({ ...prefs, newClaims: v })} />
            <Toggle label="Claimant replies" text="Email me when a claimant answers a question in a claim thread." checked={prefs.replies} onChange={(v) => setPrefs({ ...prefs, replies: v })} />
            <Toggle label="Flagged posts" text="Email me when a lost report is flagged for contact details." checked={prefs.flagged} onChange={(v) => setPrefs({ ...prefs, flagged: v })} />
          </>
        ) : (
          <>
            <Toggle label="Possible matches" text="Email me when a found item may match one of my reports." checked={prefs.matches} onChange={(v) => setPrefs({ ...prefs, matches: v })} />
            <Toggle label="Claim updates" text="Email me when my claim status changes or the office sends a message." checked={prefs.claims} onChange={(v) => setPrefs({ ...prefs, claims: v })} />
          </>
        )}
        <p className="field__hint">You'll always see notifications in the app.</p>
      </section>

      {office ? (
        <section className="panel panel--white" aria-labelledby="pa">
          <h2 id="pa" className="panel__title">
            Account access
          </h2>
          <p>Office accounts can't be deleted from here. A super admin can deactivate an admin account in Manage admins.</p>
        </section>
      ) : (
      <section className="panel panel--danger" aria-labelledby="pa">
        <h2 id="pa" className="panel__title">
          Privacy and account
        </h2>
        <p>
          Read how BalikGamit collects and uses your information in the <Link to="/privacy">Privacy Notice</Link>.
        </p>
        {confirmDelete ? (
          <div className="confirm-box">
            <p>
              <b>Delete your account?</b> This permanently deletes your account, reports, and claims.
            </p>
            <div className="form-actions">
              <button
                className="btn btn--danger"
                onClick={async () => {
                  // Production: Worker route /api/account (service key) deletes the user and their rows.
                  await signOut();
                  navigate("/");
                }}
              >
                Yes, delete my account
              </button>
              <button className="btn btn--outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="row-wrap">
            <button className="btn btn--outline-danger" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} /> Delete my account
            </button>
            <span className="field__hint">This permanently deletes your account, reports, and claims. It can't be undone.</span>
          </div>
        )}
      </section>
      )}
    </div>
  );
}

function Toggle({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <span>{text}</span>
      </span>
      <input type="checkbox" role="switch" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
