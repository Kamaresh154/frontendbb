import { useState } from "react";

interface Appointment {
  id: string;
  title: string;
  customer: string;
  phone: string;
  employee: string;
  date: string;
  time: string;
  type: "demo" | "follow-up" | "delivery" | "support" | "other";
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  notes: string;
}

const STORAGE_KEY = "kv_appointments";

function getAppts(): Appointment[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

const TYPE_COLORS: Record<Appointment["type"], string> = {
  demo: "bg-purple-100 text-purple-700",
  "follow-up": "bg-blue-100 text-blue-700",
  delivery: "bg-green-100 text-green-700",
  support: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<Appointment["status"], string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-blue-100 text-blue-700",
};

const BLANK: Omit<Appointment, "id"> = {
  title: "", customer: "", phone: "", employee: "", date: "", time: "",
  type: "demo", status: "scheduled", notes: "",
};

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appointment[]>(getAppts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Appointment, "id">>(BLANK);
  const [filter, setFilter] = useState<"all" | Appointment["status"]>("all");
  const [editId, setEditId] = useState<string | null>(null);

  const save = () => {
    if (!form.customer || !form.date) return;
    let updated: Appointment[];
    if (editId) {
      updated = appts.map((a) => a.id === editId ? { ...form, id: editId } : a);
    } else {
      updated = [{ ...form, id: Date.now().toString() }, ...appts];
    }
    setAppts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setForm(BLANK);
    setShowForm(false);
    setEditId(null);
  };

  const updateStatus = (id: string, status: Appointment["status"]) => {
    const updated = appts.map((a) => a.id === id ? { ...a, status } : a);
    setAppts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const editAppt = (a: Appointment) => {
    const { id, ...rest } = a;
    setForm(rest);
    setEditId(id);
    setShowForm(true);
  };

  const filtered = appts.filter((a) => filter === "all" || a.status === filter);
  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a) => a.date === today);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule and manage employee appointments</p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(BLANK); setEditId(null); setShowForm(true); }}
          className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 shadow-sm"
        >
          + Schedule Appointment
        </button>
      </div>

      {/* Today's appointments */}
      {todayAppts.length > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-purple to-violet-600 p-5 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3">Today's Schedule</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayAppts.map((a) => (
              <div key={a.id} className="rounded-xl bg-white/15 p-3">
                <p className="font-semibold text-sm">{a.time} — {a.title || a.customer}</p>
                <p className="text-xs text-white/70 mt-0.5">{a.customer} · {a.employee || "Unassigned"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">{editId ? "Edit" : "New"} Appointment</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "title", label: "Title / Purpose", type: "text" },
              { key: "customer", label: "Customer Name", type: "text" },
              { key: "phone", label: "Phone", type: "tel" },
              { key: "employee", label: "Assigned Employee", type: "text" },
              { key: "date", label: "Date", type: "date" },
              { key: "time", label: "Time", type: "time" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Appointment["type"] })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
              >
                {(["demo", "follow-up", "delivery", "support", "other"] as const).map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(["all", "scheduled", "completed", "cancelled", "rescheduled"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === s ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Appointments list */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No appointments. Click "+ Schedule" to add one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    <p>{new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className="text-slate-400">{a.time}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.title || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{a.customer}</p>
                    <p className="text-xs text-slate-400">{a.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.employee || "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[a.type]}`}>{a.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => editAppt(a)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">Edit</button>
                      {a.status === "scheduled" && (
                        <>
                          <button type="button" onClick={() => updateStatus(a.id, "completed")} className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">Done</button>
                          <button type="button" onClick={() => updateStatus(a.id, "cancelled")} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
