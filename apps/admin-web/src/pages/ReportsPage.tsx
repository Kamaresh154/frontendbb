import { useEffect, useState } from "react";
import { getMonthlyRevenue, getLedgerEntries, getInvoices, getLeaves, getEmployees, type MonthlyRevenue } from "../lib/store";

type Tab = "overview" | "invoices" | "ledger" | "leave";

const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (a: number, b: number) => (b === 0 ? "—" : `${a > 0 ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);

function BarChart({ data, field, color = "#6d28d9" }: { data: MonthlyRevenue[]; field: "revenue" | "expenses" | "net"; color?: string }) {
  const max = Math.max(...data.map((d) => Math.abs(d[field])), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const val = d[field];
        const h = Math.round((Math.abs(val) / max) * 100);
        const isNeg = val < 0;
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1 group" title={`${d.label}: ${fmt(val)}`}>
            <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmt(val)}</span>
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${h}%`, backgroundColor: isNeg ? "#ef4444" : color }} />
            <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [filterFrom, setFilterFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 5); return d.toISOString().slice(0, 7); });
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().slice(0, 7));

  const reload = () => setMonthly(getMonthlyRevenue(12));
  useEffect(() => { reload(); window.addEventListener("kv-store-update", reload); return () => window.removeEventListener("kv-store-update", reload); }, []);

  const filteredMonthly = monthly.filter((m) => m.month >= filterFrom && m.month <= filterTo);
  const totalRevenue  = filteredMonthly.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = filteredMonthly.reduce((s, m) => s + m.expenses, 0);
  const netIncome     = totalRevenue - totalExpenses;
  const totalInvoices = filteredMonthly.reduce((s, m) => s + m.invoice_count, 0);

  const allInvoices = getInvoices();
  const allEntries  = getLedgerEntries();
  const allLeaves   = getLeaves();
  const allEmployees = getEmployees();

  const invoicesByType = {
    order:    allInvoices.filter((i) => i.invoice_type === "order"),
    tuition:  allInvoices.filter((i) => i.invoice_type === "tuition"),
    purchase: allInvoices.filter((i) => i.invoice_type === "purchase"),
  };
  const invoicesByStatus = {
    paid:      allInvoices.filter((i) => i.status === "paid"),
    draft:     allInvoices.filter((i) => i.status === "draft"),
    sent:      allInvoices.filter((i) => i.status === "sent"),
    cancelled: allInvoices.filter((i) => i.status === "cancelled"),
  };

  const leaveByStatus = {
    pending:  allLeaves.filter((l) => l.status === "pending"),
    approved: allLeaves.filter((l) => l.status === "approved"),
    rejected: allLeaves.filter((l) => l.status === "rejected"),
  };
  const leaveByType = {
    casual:  allLeaves.filter((l) => l.leave_type === "casual"),
    sick:    allLeaves.filter((l) => l.leave_type === "sick"),
    earned:  allLeaves.filter((l) => l.leave_type === "earned"),
    unpaid:  allLeaves.filter((l) => l.leave_type === "unpaid"),
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Revenue Overview", icon: "📈" },
    { key: "invoices", label: "Invoice Analysis", icon: "🧾" },
    { key: "ledger",   label: "Ledger Entries", icon: "📊" },
    { key: "leave",    label: "Leave Report", icon: "🗓" },
  ];

  return (
    <div className="p-8 max-w-screen-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">All data is based on invoices and ledger entries saved in this app</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${tab === t.key ? "border-brand-purple text-brand-purple" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── REVENUE OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Date filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input type="month" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm" />
            <label className="text-xs font-medium text-slate-500">To</label>
            <input type="month" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm" />
            <span className="text-xs text-slate-400">{filteredMonthly.length} month{filteredMonthly.length !== 1 ? "s" : ""} selected</span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Revenue", value: fmt(totalRevenue), icon: "📈", color: "ring-green-200 bg-green-50" },
              { label: "Total Expenses", value: fmt(totalExpenses), icon: "📉", color: "ring-red-200 bg-red-50" },
              { label: "Net Income", value: fmt(netIncome), icon: "💰", color: netIncome >= 0 ? "ring-emerald-200 bg-emerald-50" : "ring-red-200 bg-red-50" },
              { label: "Invoices Raised", value: String(totalInvoices), icon: "🧾", color: "ring-slate-200 bg-slate-50" },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl p-5 ring-1 ${c.color}`}>
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">Monthly Revenue</h3>
              {filteredMonthly.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No data for this period</p> : <BarChart data={filteredMonthly} field="revenue" color="#10b981" />}
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">Monthly Expenses</h3>
              {filteredMonthly.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No data for this period</p> : <BarChart data={filteredMonthly} field="expenses" color="#ef4444" />}
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm lg:col-span-2">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">Net Income (Revenue − Expenses)</h3>
              {filteredMonthly.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">No data for this period</p> : <BarChart data={filteredMonthly} field="net" color="#6d28d9" />}
            </div>
          </div>

          {/* Monthly table */}
          {filteredMonthly.length > 0 && (
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
              <div className="border-b px-5 py-3 bg-slate-50">
                <h3 className="font-semibold text-slate-700 text-sm">Month-by-Month Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400 bg-white">
                  <tr><th className="px-4 py-3 text-left">Month</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Expenses</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-right">Invoices</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMonthly.map((m, i) => {
                    const prev = filteredMonthly[i - 1];
                    return (
                      <tr key={m.month} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.label}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-semibold">{fmt(m.revenue)}{prev && <span className="ml-1 text-xs text-slate-400">{pct(m.revenue, prev.revenue)}</span>}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmt(m.expenses)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${m.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(m.net)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{m.invoice_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-slate-50 font-bold text-sm">
                  <tr><td className="px-4 py-3 text-slate-700">Total</td><td className="px-4 py-3 text-right text-green-700">{fmt(totalRevenue)}</td><td className="px-4 py-3 text-right text-red-600">{fmt(totalExpenses)}</td><td className={`px-4 py-3 text-right ${netIncome >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(netIncome)}</td><td className="px-4 py-3 text-right text-slate-700">{totalInvoices}</td></tr>
                </tfoot>
              </table>
            </div>
          )}

          {filteredMonthly.length === 0 && allInvoices.length === 0 && (
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-10 text-center shadow-sm">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-slate-600 font-medium">No revenue data yet</p>
              <p className="text-sm text-slate-400 mt-1">Create invoices and mark them as paid to see reports here</p>
            </div>
          )}
        </div>
      )}

      {/* ── INVOICE ANALYSIS ── */}
      {tab === "invoices" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Order Invoices", value: invoicesByType.order.length, sub: fmt(invoicesByType.order.reduce((s, i) => s + i.total, 0)), icon: "🛒", color: "ring-blue-200" },
              { label: "Tuition Invoices", value: invoicesByType.tuition.length, sub: fmt(invoicesByType.tuition.reduce((s, i) => s + i.total, 0)), icon: "🎓", color: "ring-purple-200" },
              { label: "Purchase Invoices", value: invoicesByType.purchase.length, sub: fmt(invoicesByType.purchase.reduce((s, i) => s + i.total, 0)), icon: "📦", color: "ring-amber-200" },
              { label: "Paid Invoices", value: invoicesByStatus.paid.length, sub: fmt(invoicesByStatus.paid.reduce((s, i) => s + i.total, 0)), icon: "✅", color: "ring-green-200" },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl bg-white ring-1 ${c.color} p-5 shadow-sm`}>
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs font-medium text-slate-700 mt-1">{c.label}</p>
                <p className="text-xs text-slate-400">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm">Invoice Status Breakdown</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              {(["draft","sent","paid","cancelled"] as const).map((s) => (
                <div key={s} className="space-y-1">
                  <p className="text-2xl font-bold text-slate-900">{invoicesByStatus[s].length}</p>
                  <p className="text-xs capitalize text-slate-500">{s}</p>
                  <p className="text-xs text-slate-400">{fmt(invoicesByStatus[s].reduce((t, i) => t + i.total, 0))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent invoices */}
          <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
            <div className="border-b px-5 py-3 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">All Invoices — {allInvoices.length} total</h3>
            </div>
            {allInvoices.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-sm">No invoices created yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400 bg-white">
                  <tr><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Party</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Status</th></tr>
                </thead>
                <tbody className="divide-y">
                  {allInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{inv.invoice_no}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inv.invoice_type === "purchase" ? "bg-amber-100 text-amber-700" : inv.invoice_type === "order" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{inv.invoice_type}</span></td>
                      <td className="px-4 py-2.5 text-slate-700">{inv.customer_name || inv.vendor_name || inv.student_name || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt(inv.total)}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── LEDGER ENTRIES ── */}
      {tab === "ledger" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Credits", value: fmt(allEntries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0)), icon: "📈", color: "ring-green-200 bg-green-50" },
              { label: "Total Debits", value: fmt(allEntries.filter((e) => e.type === "debit").reduce((s, e) => s + e.amount, 0)), icon: "📉", color: "ring-red-200 bg-red-50" },
              { label: "Total Entries", value: String(allEntries.length), icon: "📋", color: "ring-slate-200 bg-slate-50" },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl p-5 ring-1 ${c.color} shadow-sm`}>
                <div className="text-xl mb-2">{c.icon}</div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
            <div className="border-b px-5 py-3 bg-slate-50"><h3 className="font-semibold text-slate-700 text-sm">All Ledger Entries</h3></div>
            {allEntries.length === 0 ? <p className="p-8 text-center text-slate-400 text-sm">No ledger entries yet. Entries are auto-created when you create invoices.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400 bg-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Type</th></tr></thead>
                <tbody className="divide-y">
                  {allEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-slate-700">{e.description}</td>
                      <td className="px-4 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">{e.category}</span></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{e.reference ?? "—"}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${e.type === "credit" ? "text-green-700" : "text-red-600"}`}>{e.type === "credit" ? "+" : "−"}{fmt(e.amount)}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.type === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVE REPORT ── */}
      {tab === "leave" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Requests", value: allLeaves.length, icon: "📋", color: "ring-slate-200" },
              { label: "Pending", value: leaveByStatus.pending.length, icon: "⏳", color: "ring-yellow-200 bg-yellow-50" },
              { label: "Approved", value: leaveByStatus.approved.length, icon: "✅", color: "ring-green-200 bg-green-50" },
              { label: "Rejected", value: leaveByStatus.rejected.length, icon: "❌", color: "ring-red-200 bg-red-50" },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl bg-white p-5 ring-1 ${c.color} shadow-sm`}>
                <div className="text-xl mb-2">{c.icon}</div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Leave by type */}
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">Leave by Type</h3>
              <div className="space-y-3">
                {(["casual","sick","earned","unpaid"] as const).map((lt) => {
                  const count = leaveByType[lt]?.length ?? 0;
                  const days  = leaveByType[lt]?.reduce((s, l) => s + l.days, 0) ?? 0;
                  const max   = Math.max(...(["casual","sick","earned","unpaid"] as const).map((t) => leaveByType[t]?.length ?? 0), 1);
                  return (
                    <div key={lt}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize font-medium text-slate-700">{lt} Leave</span>
                        <span className="text-slate-400">{count} requests · {days} days</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-purple transition-all" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Employee leave summary */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">Leave per Employee</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allEmployees.length === 0 ? <p className="text-sm text-slate-400">No employees yet</p> : allEmployees.map((emp) => {
                  const empLeaves = allLeaves.filter((l) => l.employee_id === emp.id);
                  const approvedDays = empLeaves.filter((l) => l.status === "approved").reduce((s, l) => s + l.days, 0);
                  const pendingCount = empLeaves.filter((l) => l.status === "pending").length;
                  return (
                    <div key={emp.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold text-brand-purple">{emp.full_name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{emp.full_name}</p>
                        <p className="text-[10px] text-slate-400">{approvedDays} approved days · {pendingCount} pending</p>
                      </div>
                      <span className="text-xs text-slate-500">{empLeaves.length} req{empLeaves.length !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full leave log */}
          <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm overflow-hidden">
            <div className="border-b px-5 py-3 bg-slate-50"><h3 className="font-semibold text-slate-700 text-sm">All Leave Requests</h3></div>
            {allLeaves.length === 0 ? <p className="p-8 text-center text-slate-400 text-sm">No leave requests yet</p> : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400 bg-white"><tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-right">Days</th><th className="px-4 py-3 text-left">Reason</th><th className="px-4 py-3 text-left">Status</th></tr></thead>
                <tbody className="divide-y">
                  {allLeaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{l.employee_name}</td>
                      <td className="px-4 py-2.5 capitalize text-slate-500">{l.leave_type}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(l.from_date).toLocaleDateString("en-IN")} → {new Date(l.to_date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-semibold">{l.days}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs max-w-xs truncate">{l.reason}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.status === "approved" ? "bg-green-100 text-green-700" : l.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{l.status}</span></td>
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
