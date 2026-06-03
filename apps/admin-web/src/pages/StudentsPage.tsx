import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Center, Student, StudentListResponse } from "@kidzventure/shared-types";
import { api } from "../api/client";

export default function StudentsPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", center_id: "", admission_no: "" });

  const load = useCallback(async () => {
    const org = await api.get<{ id: string }>("/organizations/me");
    setOrgId(org.data.id);
    const centersRes = await api.get<Center[]>(`/organizations/${org.data.id}/centers`);
    setCenters(centersRes.data);
    const studentsRes = await api.get<StudentListResponse>("/students", {
      params: { search: search || undefined, page: 1, page_size: 50 },
    });
    setData(studentsRes.data);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.post<Student>("/students", {
      full_name: form.full_name,
      center_id: form.center_id,
      admission_no: form.admission_no || undefined,
    });
    setShowForm(false);
    setForm({ full_name: "", center_id: centers[0]?.id ?? "", admission_no: "" });
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} enrolled</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, center_id: centers[0]?.id ?? "" }));
              setShowForm(true);
            }}
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
          >
            Add student
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-semibold">New student</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-600">Full name</span>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label>
              <span className="text-sm text-slate-600">Center</span>
              <select
                required
                value={form.center_id}
                onChange={(e) => setForm({ ...form, center_id: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm text-slate-600">Admission no.</span>
              <input
                value={form.admission_no}
                onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-purple px-4 py-2 text-sm text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Admission</th>
              <th className="px-4 py-3 font-medium">QR</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{s.full_name}</td>
                <td className="px-4 py-3">{s.admission_no ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.qr_code ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {!data?.items.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No students yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!orgId && null}
    </div>
  );
}
