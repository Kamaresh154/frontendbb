import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { addEmployee, getEmployees } from "../lib/store";

interface OrgOption { id: string; name: string; slug: string; }
interface UserItem {
  id: string; email: string; full_name: string; status: string;
  organization_id: string | null; organization_name: string | null; roles: string[];
}

// Only super_admin can add: employees and franchise managers
const ROLE_OPTIONS = [
  { value: "employee",          label: "Employee" },
  { value: "franchise_manager", label: "Franchise Manager" },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin:       "bg-yellow-100 text-yellow-800",
  franchise_manager: "bg-indigo-100 text-indigo-700",
  employee:          "bg-blue-100 text-blue-700",
};

const BLANK = { email: "", password: "", full_name: "", role: "employee", organization_id: "" };

export default function UserManagementPage() {
  const { user: me } = useAuth();

  // Only super admin can access this page (enforced in App.tsx routes too)
  const [users, setUsers] = useState<UserItem[]>([]);
  const [orgs, setOrgs]   = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState(BLANK);
  const [editForm, setEditForm] = useState({ full_name: "", password: "", status: "active", role: "" });
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: UserItem[]; total: number }>("/users");
      // Show only employees + franchise_managers added by super admin (exclude other super admins)
      const filtered = res.data.items.filter((u) =>
        u.roles.some((r) => ["employee", "franchise_manager"].includes(r)) ||
        u.id === me?.id
      );
      setUsers(filtered);
    } catch { setUsers([]); }
    setLoading(false);
  };

  const loadOrgs = async () => {
    try {
      const res = await api.get<{ items: OrgOption[] }>("/franchise/organizations");
      setOrgs(res.data.items);
    } catch { setOrgs([]); }
  };

  useEffect(() => { loadUsers(); loadOrgs(); }, []);

  const createUser = async () => {
    setError("");
    if (!form.email || !form.password || !form.full_name) { setError("Email, password and name are required."); return; }
    try {
      await api.post("/users", { ...form, organization_id: form.organization_id || null });
      if (form.role === "employee") {
        const existing = getEmployees();
        if (!existing.find((e) => e.email === form.email)) {
          addEmployee({
            full_name: form.full_name,
            designation: "", department: "", basic_salary: 0,
            employee_code: "", date_of_joining: new Date().toISOString().slice(0, 10),
            phone: "", email: form.email, center_id: "", status: "active",
          });
        }
      }
      setForm(BLANK);
      setShowForm(false);
      loadUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create user.");
    }
  };

  const updateUser = async (id: string) => {
    setError("");
    try {
      const payload: Record<string, string> = {};
      if (editForm.full_name) payload.full_name = editForm.full_name;
      if (editForm.password)  payload.password  = editForm.password;
      if (editForm.status)    payload.status    = editForm.status;
      if (editForm.role)      payload.role      = editForm.role;
      await api.patch(`/users/${id}`, payload);
      setEditId(null);
      loadUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update user.");
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Remove this user? They will no longer be able to log in.")) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to remove user.");
    }
  };

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.organization_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const employeeCount  = users.filter((u) => u.roles.includes("employee")).length;
  const franchiseCount = users.filter((u) => u.roles.includes("franchise_manager")).length;

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Super Admin only · {employeeCount} employee{employeeCount !== 1 ? "s" : ""} · {franchiseCount} franchise manager{franchiseCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button type="button" onClick={() => { setForm(BLANK); setShowForm(true); setError(""); }}
          className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 shadow-sm">
          + Add User
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-5 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-xs text-yellow-800 flex items-start gap-2">
        <span className="text-base flex-shrink-0">🔐</span>
        <span>Only <strong>Super Admin</strong> can create accounts. Allowed roles: <strong>Employee</strong> and <strong>Franchise Manager</strong>. No admin-level accounts can be created here.</span>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">New User Account</h2>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email Address *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                placeholder="user@company.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Password *</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {form.role === "franchise_manager" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Franchise / Organization</label>
                <select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                  <option value="">— Select franchise —</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={createUser} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-medium text-white">Create Account</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {error && !showForm && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</p>}

      {/* Search */}
      <div className="mb-4">
        <input type="text" placeholder="Search by name, email or organization…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total Users</p>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-blue-100 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-700">{employeeCount}</p>
          <p className="text-xs text-slate-500 mt-1">Employees</p>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-indigo-100 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-indigo-700">{franchiseCount}</p>
          <p className="text-xs text-slate-500 mt-1">Franchise Managers</p>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400 text-sm">Loading users…</p>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-slate-400 text-sm">No users found. Click "+ Add User" to create one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Organization</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((u) => (
                <>
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                          {u.full_name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3 text-slate-500">{u.organization_name ?? <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-4 py-3">
                      {u.roles.filter((r) => r !== "super_admin").map((r) => (
                        <span key={r} className={`mr-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[r] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.replace(/_/g, " ")}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== me?.id && (
                        <div className="flex gap-1">
                          <button type="button"
                            onClick={() => { setEditId(editId === u.id ? null : u.id); setEditForm({ full_name: u.full_name, password: "", status: u.status, role: u.roles[0] ?? "employee" }); setError(""); }}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                            ✏️ Edit
                          </button>
                          <button type="button" onClick={() => deleteUser(u.id)}
                            className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                            🗑 Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editId === u.id && (
                    <tr key={`edit-${u.id}`} className="bg-purple-50">
                      <td colSpan={6} className="px-4 py-4">
                        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                            <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">New Password (optional)</label>
                            <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                              placeholder="Leave blank to keep"
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
                            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => updateUser(u.id)} className="rounded-xl bg-brand-purple px-4 py-1.5 text-xs font-medium text-white">Save Changes</button>
                          <button type="button" onClick={() => setEditId(null)} className="rounded-xl border px-4 py-1.5 text-xs text-slate-600">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
