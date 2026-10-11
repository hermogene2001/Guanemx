"use client";

import { useCallback, useEffect, useState } from "react";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "USER" | "AGENT" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  createdAt: string;
};

export default function UserManagementPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadUsers = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    const result = await response.json() as { users?: ManagedUser[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load users.");
    setUsers(result.users ?? []);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setError("");
      void loadUsers(query).catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
      });
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [loadUsers, query]);

  async function save(user: ManagedUser, form: HTMLFormElement) {
    const values = new FormData(form);
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          phone: values.get("phone"),
          role: values.get("role"),
          status: values.get("status"),
          password: values.get("password"),
        }),
      });
      const result = await response.json() as { user?: ManagedUser; error?: string };
      if (!response.ok || !result.user) {
        setError(result.error ?? "User could not be updated.");
        return;
      }
      const savedUser = result.user;
      setUsers((current) => current.map((item) => item.id === user.id ? savedUser : item));
      setNotice(values.get("password") ? `Updated ${savedUser.email} and changed their password.` : `Updated ${savedUser.email}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to reach GuanemX. Try again.");
    } finally {
      setBusyId("");
    }
  }

  return <section className="finance-card">
    <span className="label">REGISTERED ACCOUNTS</span>
    <h2>Manage users</h2>
    <p>Update profile details, roles, account status, and passwords. Role changes, suspensions, and password changes revoke the user’s active sessions. Leave the password field blank to keep the current password.</p>
    <label className="auth-field">Search by name or email<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" /></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {notice && <p className="finance-success" role="status">{notice}</p>}
    {users.length === 0 ? <p className="finance-empty">{query ? "No matching accounts found." : "No accounts found."}</p> : <div className="user-table-scroll"><table className="user-management-table">
      <thead><tr><th scope="col">Account</th><th scope="col">Name</th><th scope="col">Phone</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">New password</th><th scope="col">Actions</th></tr></thead>
      <tbody>{users.map((user) => {
        const formId = `user-edit-${user.id}`;
        return <tr key={`${user.id}-${user.name}-${user.phone ?? ""}-${user.role}-${user.status}`}>
          <td><form id={formId} hidden onSubmit={(event) => { event.preventDefault(); void save(user, event.currentTarget); }} /><strong>{user.email}{user.id === currentUserId ? " · You" : ""}</strong><small>Joined {new Date(user.createdAt).toLocaleDateString()}</small></td>
          <td><input aria-label={`Name for ${user.email}`} form={formId} name="name" defaultValue={user.name} minLength={2} maxLength={80} required /></td>
          <td><input aria-label={`Phone for ${user.email}`} form={formId} name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+250..." /></td>
          <td><select aria-label={`Role for ${user.email}`} form={formId} name="role" defaultValue={user.role} disabled={user.id === currentUserId}><option value="USER">User</option><option value="AGENT">Agent</option><option value="ADMIN">Admin</option></select></td>
          <td><select aria-label={`Status for ${user.email}`} form={formId} name="status" defaultValue={user.status} disabled={user.id === currentUserId}><option value="ACTIVE">Active</option><option value="PENDING_VERIFICATION">Pending verification</option><option value="SUSPENDED">Suspended</option></select></td>
          <td><input aria-label={`New password for ${user.email}`} form={formId} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} placeholder="Leave blank to keep" /></td>
          <td><button className="button button-quiet" form={formId} disabled={busyId === user.id}>{busyId === user.id ? "Saving…" : "Save changes"}</button></td>
        </tr>;
      })}</tbody>
    </table></div>}
    <p className="finance-empty">Showing up to 100 most recently created matching accounts.</p>
  </section>;
}
