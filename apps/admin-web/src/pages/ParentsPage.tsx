import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Parent, ParentListResponse, StudentListResponse } from "@kidzventure/shared-types";
import { api } from "../api/client";

export default function ParentsPage() {
  const [data, setData] = useState<ParentListResponse | null>(null);
  const [students, setStudents] = useState<StudentListResponse["items"]>([]);
  const [showForm, setShowForm] = useState(false);
  const [linkParent, setLinkParent] = useState<Parent | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [linkForm, setLinkForm] = useState({ student_id: "", relationship: "parent", is_primary: true });

  const load = useCallback(async () => {
    const [parents, studs] = await Promise.all([
      api.get<ParentListResponse>("/parents", { params: { page_size: 50 } }),
      api.get<StudentListResponse>("/students", { params: { page_size: 100 } }),
    ]);
    setData(parents.data);
    setStudents(studs.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/parents", {
        full_name: form.full_name,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
      setShowForm(false);
      setForm({ full_name: "", phone: "", email: "" });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to create parent. Please try again.");
    }
  }

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    if (!linkParent) return;
    if (!linkForm.student_id) {
      alert("Please select a student.");
      return;
    }
    try {
      await api.post(`/parents/${linkParent.id}/link`, linkForm);
      setLinkParent(null);
      load();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        alert("This parent is already linked to the selected student.");
        setLinkParent(null);
      } else if (err?.response?.status === 404) {
        alert("Student not found. Please refresh and try again.");
      } else {
        alert("Failed to link student. Please try again.");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parents</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} contacts</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
        >
          Add parent
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="font-semibold">New parent</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-purple px-4 py-2 text-sm text-white">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {linkParent && (
        <form onSubmit={handleLink} className="rounded-xl border border-brand-cyan/40 bg-cyan-50/50 p-6">
          <h2 className="font-semibold">Link {linkParent.full_name} to student</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              required
              value={linkForm.student_id}
              onChange={(e) => setLinkForm({ ...linkForm, student_id: e.target.value })}
              className="rounded-lg border px-3 py-2"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <input
              placeholder="Relationship"
              value={linkForm.relationship}
              onChange={(e) => setLinkForm({ ...linkForm, relationship: e.target.value })}
              className="rounded-lg border px-3 py-2"
            />
            <button type="submit" className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-medium text-slate-900">
              Link
            </button>
            <button type="button" onClick={() => setLinkParent(null)} className="text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3">{p.phone ?? "—"}</td>
                <td className="px-4 py-3">{p.email ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkForm({ student_id: students[0]?.id ?? "", relationship: "parent", is_primary: true });
                      setLinkParent(p);
                    }}
                    className="text-brand-purple hover:underline"
                  >
                    Link student
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
