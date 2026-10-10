import { useState, type FormEvent } from "react";
import { BackButton, Alert, Loading, PageHead, SelectField, TextField } from "../../components/ui";
import { inviteAdmin, listAdmins, setAdminActive } from "../../data/api";
import { useAuth } from "../../auth/AuthContext";
import { isRtuEmail } from "../../lib/validation";
import { useLoad } from "../../lib/useLoad";

export function ManageAdmins() {
  const { user } = useAuth();
  const admins = useLoad(() => listAdmins(), []);
  const [form, setForm] = useState({ name: "", email: "", role: "Admin" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  if (!admins) return <Loading />;

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setMsg({ tone: "error", text: "Enter the admin's full name." });
    if (!isRtuEmail(form.email)) return setMsg({ tone: "error", text: "Use an @rtu.edu.ph email address." });
    try {
      // Existing account: the role changes now. New person: the Worker emails an invite (it holds the service key).
      const how = await inviteAdmin(form.name.trim(), form.email.trim(), form.role === "Super admin" ? "super_admin" : "admin");
      setMsg({
        tone: "success",
        text: how === "promoted" ? `${form.email.trim()} already had an account. Their role is updated.` : `Invite sent to ${form.email.trim()}.`,
      });
      setForm({ name: "", email: "", role: "Admin" });
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="container stack-lg">
      <BackButton fallback="/admin/settings" />
      <PageHead eyebrow="SUPER ADMIN" title="Manage admins" lead="Admins log found items, review claims and moderate posts. Nobody can sign up as an admin." />
      <div className="two-col two-col--admins">
        <div className="table-card table-scroll">
          <table className="table table--stack">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="cell-two">
                      <strong>{a.fullName}</strong>
                      <small>{a.email}</small>
                    </span>
                  </td>
                  <td>{a.role === "super_admin" ? "Super admin" : "Admin"}</td>
                  <td>
                    <span className={`badge ${a.active ? "badge--green" : "badge--gray"}`}>{a.active ? "Active" : "Deactivated"}</span>
                  </td>
                  <td>
                    {a.id === user?.id ? (
                      <small className="muted">You</small>
                    ) : (
                      <button
                        className={`link-btn ${a.active ? "link-btn--danger" : ""}`}
                        onClick={() => setAdminActive(a.id, !a.active).catch((err: Error) => setMsg({ tone: "error", text: err.message }))}
                      >
                        {a.active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="panel panel--white" onSubmit={invite} noValidate>
          <h2 className="panel__title">Add an admin</h2>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <TextField label="Full name" placeholder="Ex. Juan Dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="RTU email" type="email" placeholder="name@rtu.edu.ph" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <SelectField label="Role" placeholder="Choose a role" options={["Admin", "Super admin"]} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <button className="btn btn--blue btn--block btn--lg">Send invite</button>
          <p className="field__hint">
            If they already have a BalikGamit account, they get the role right away. Otherwise they get an email to set a password. Nobody can change
            their own role.
          </p>
        </form>
      </div>
    </div>
  );
}
