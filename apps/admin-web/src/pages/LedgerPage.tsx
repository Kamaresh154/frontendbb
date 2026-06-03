import { useEffect, useState } from "react";
import { getLedgerEntries, addLedgerEntry, getLedgerSummary, type LedgerEntry } from "../lib/store";

type Tab = "summary" | "entries";
type EntryType = "all" | "revenue" | "purchase" | "expense" | "payroll" | "other";

const ENTRY_COLORS: Record<string, string> = {
  revenue: "bg-green-100 text-green-700", purchase: "bg-amber-100 text-amber-700",
  expense: "bg-red-100 text-red-700",     payroll: "bg-blue-100 text-blue-700", other: "bg-slate-100 text-slate-600",
};

const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function LedgerPage() {
  const [tab, setTab]           = useState<Tab>("summary");
  const [entries, setEntries]   = useState<LedgerEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<EntryType>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [form, setForm]         = useState({
    type: "credit" as "credit" | "debit", category: "revenue" as LedgerEntry["category"],
    amount: "", description: "", reference: "", date: new Date().toISOString().slice(0, 10),
  });

  const reload = () => setEntries(getLedgerEntries());
  useEffect(() => {
    reload();
    window.addEventListener("kv-store-update", reload);
    return () => window.removeEventListener("kv-store-update", reload);
  }, []);

  const summary = getLedgerSummary();
  const filtered = entries.filter((e) => typeFilter === "all" || e.category === typeFilter);

  // Group entries by month for summary view
  const byMonth: Record<string, { revenue: number; expenses: number; entries: LedgerEntry[] }> = {};
  entries.forEach((e) => {
    const m = e.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { revenue: 0, expenses: 0, entries: [] };
    if (e.type === "credit") byMonth[m].revenue  += e.amount;
    else                     byMonth[m].expenses += e.amount;
    byMonth[m].entries.push(e);
  });
  const months = Object.keys(byMonth).sort().reverse();

  const handleSubmit = () => {
    setError("");
    if (!form.amount || !form.description || !form.date) { setError("Amount, description and date are required."); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount greater than 0."); return; }
    setSaving(true);
    addLedgerEntry({ type: form.type, category: form.category, amount, description: form.description, reference: form.reference || undefined, date: form.date, source: "manual" });
    setForm({ type: "credit", category: "revenue", amount: "", description: "", reference: "", date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance Ledger</h1>
          <p className="text-sm text-slate-500">All financial entries — auto-posted from invoices and payroll</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90">
          + Manual Entry
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl ring-1 ring-green-200 bg-green-50 p-5 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-green-700">{fmt(summary.revenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{entries.filter((e) => e.type === "credit").length} credit entries</p>
        </div>
        <div className="rounded-2xl ring-1 ring-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700">{fmt(summary.expenses)}</p>
          <p className="text-xs text-slate-400 mt-1">{entries.filter((e) => e.type === "debit").length} debit entries</p>
        </div>
        <div className={`rounded-2xl ring-1 ${summary.net >= 0 ? "ring-emerald-200 bg-emerald-50" : "ring-red-200 bg-red-50"} p-5 shadow-sm`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Net Income</p>
          <p className={`text-2xl font-bold ${summary.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(summary.net)}</p>
          <p className="text-xs text-slate-400 mt-1">{entries.length} total entries</p>
        </div>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800">New Manual Entry</h2>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "credit" | "debit" })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                <option value="credit">Credit (Income)</option>
                <option value="debit">Debit (Expense)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LedgerEntry["category"] })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                {["revenue","purchase","expense","payroll","other"].map((c) => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Reference No</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="e.g. INV-0001" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Description *</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Brief description of this entry" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Post Entry"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["summary","entries"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition ${tab === t ? "border-brand-purple text-brand-purple" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Summary tab — month-by-month */}
      {tab === "summary" && (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-10 text-center shadow-sm">
              <p className="text-3xl mb-3">📊</p>
              <p className="font-medium text-slate-600">No ledger entries yet</p>
              <p className="text-sm text-slate-400 mt-1">Entries are created automatically when you create invoices or generate payroll. You can also add manual entries above.</p>
            </div>
          ) : months.map((m) => {
            const { revenue, expenses, entries: mEntries } = byMonth[m];
            const label = new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
            return (
              <div key={m} className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
                <div className="border-b bg-slate-50 px-5 py-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{label}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700 font-semibold">{fmt(revenue)} in</span>
                    <span className="text-red-600 font-semibold">{fmt(expenses)} out</span>
                    <span className={`font-bold ${revenue - expenses >= 0 ? "text-emerald-700" : "text-red-700"}`}>Net: {fmt(revenue - expenses)}</span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase text-slate-400 bg-white">
                    <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-left">Category</th><th className="px-4 py-2 text-left">Source</th><th className="px-4 py-2 text-left">Ref</th><th className="px-4 py-2 text-right">Credit</th><th className="px-4 py-2 text-right">Debit</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {mEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-400">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{e.description}</td>
                        <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ENTRY_COLORS[e.category]}`}>{e.category}</span></td>
                        <td className="px-4 py-2 text-xs text-slate-400 capitalize">{e.source}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-400">{e.reference ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-green-700 font-semibold">{e.type === "credit" ? fmt(e.amount) : ""}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-semibold">{e.type === "debit" ? fmt(e.amount) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Entries tab — filterable list */}
      {tab === "entries" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["all","revenue","purchase","expense","payroll","other"] as EntryType[]).map((t) => (
              <button key={t} type="button" onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${typeFilter === t ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>
                {t === "all" ? `All (${entries.length})` : `${t} (${entries.filter((e) => e.category === t).length})`}
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No entries{typeFilter !== "all" ? ` with category "${typeFilter}"` : " yet"}.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400 bg-slate-50">
                  <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Type</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ENTRY_COLORS[e.category]}`}>{e.category}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-400 capitalize">{e.source}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.reference ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-bold ${e.type === "credit" ? "text-green-700" : "text-red-600"}`}>{e.type === "credit" ? "+" : "−"}{fmt(e.amount)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${e.type === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
