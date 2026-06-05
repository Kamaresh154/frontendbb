import { useEffect, useState } from "react";
import { api } from "../api/client";

type LeadStatus = "new" | "contacted" | "trial_scheduled" | "trial_done" | "enrolled" | "lost";

interface Lead {
  id: string;
  child_name: string;
  parent_name: string;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  follow_up_date: string | null;
  created_at: string;
}

interface PipelineStats {
  [key: string]: number;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  trial_scheduled: "bg-yellow-100 text-yellow-700",
  trial_done: "bg-orange-100 text-orange-700",
  enrolled: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const STATUSES: LeadStatus[] = ["new", "contacted", "trial_scheduled", "trial_done", "enrolled", "lost"];

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<PipelineStats>({});
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ child_name: "", parent_name: "", phone: "", source: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api.get<{ items: Lead[] }>(`/crm/leads${filterStatus ? `?status=${filterStatus}` : ""}`),
        api.get<PipelineStats>("/crm/pipeline/stats"),
      ]);
      setLeads(leadsRes.data.items);
      setStats(statsRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus]);

  const createLead = async () => {
    if (!form.child_name || !form.parent_name) {
      setSaveError("Child name and parent name are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await api.post("/crm/leads", form);
      setForm({ child_name: "", parent_name: "", phone: "", source: "", notes: "" });
      setShowAdd(false);
      load();
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? "Failed to save lead. Please check your connection and try again.");
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/crm/leads/${id}`, { status });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to update status.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">CRM — Leads Pipeline</h1>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New Lead
        </button>
      </div>

      {/* Pipeline stat cards */}
      <div className="mb-6 grid grid-cols-6 gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`rounded-lg border p-3 text-center transition ${filterStatus === s ? "ring-2 ring-brand-purple" : ""}`}
          >
            <p className="text-lg font-bold text-gray-800">{stats[s] ?? 0}</p>
            <p className="mt-0.5 text-xs capitalize text-gray-500">{s.replace(/_/g, " ")}</p>
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">New Lead</h2>
          <div className="grid grid-cols-2 gap-4">
            {(["child_name", "parent_name", "phone", "source"] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium capitalize text-gray-600">{field.replace("_", " ")}</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <button type="button" onClick={createLead} disabled={saving} className="rounded-lg bg-brand-purple px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setSaveError(""); }} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button>
            {saveError && <p className="text-sm text-red-600 ml-2">{saveError}</p>}
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="rounded-xl border bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-400">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Child</th>
                <th className="px-4 py-3 text-left">Parent</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Follow-up</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{lead.child_name}</td>
                  <td className="px-4 py-3">{lead.parent_name}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status]}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lead.follow_up_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No leads found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
