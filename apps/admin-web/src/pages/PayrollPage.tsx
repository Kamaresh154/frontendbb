import { useEffect, useState } from "react";
import { getEmployees, getPayslips, addPayslip, updatePayslipStatus, syncEmployeesFromAPI, type LocalEmployee, type LocalPayslip } from "../lib/store";
import { api } from "../api/client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", approved: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700",
};

export default function PayrollPage() {
  const [tab, setTab] = useState<"staff" | "payslips">("staff");
  const [employees, setEmployees] = useState<LocalEmployee[]>([]);
  const [payslips, setPayslips]   = useState<LocalPayslip[]>([]);
  const [loading, setLoading]     = useState(false);
  const [printSlip, setPrintSlip] = useState<LocalPayslip | null>(null);
  const [showAddPayslip, setShowAddPayslip] = useState(false);
  const [psForm, setPsForm] = useState({ staff_id: "", pay_period: new Date().toISOString().slice(0, 7), allowances: "0", deductions: "0", bonus: "0" });
  const [search, setSearch] = useState("");

  const reload = () => {
    setEmployees(getEmployees().filter((e) => e.status === "active"));
    setPayslips(getPayslips());
  };

  useEffect(() => {
    reload();
    window.addEventListener("kv-store-update", reload);
    return () => window.removeEventListener("kv-store-update", reload);
  }, []);

  // Also try to pull from API and sync
  useEffect(() => {
    setLoading(true);
    api.get<{ items: { id: string; full_name: string; designation?: string | null; department?: string | null; basic_salary?: number; status?: string; employee_code?: string | null; date_of_joining?: string | null }[] }>("/payroll/staff")
      .then((r) => { syncEmployeesFromAPI(r.data.items); reload(); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  const generatePayslip = () => {
    if (!psForm.staff_id || !psForm.pay_period) { alert("Select employee and pay period."); return; }
    const emp = employees.find((e) => e.id === psForm.staff_id);
    if (!emp) return;
    const basic    = emp.basic_salary;
    const allow    = parseFloat(psForm.allowances) || 0;
    const ded      = parseFloat(psForm.deductions) || 0;
    const bonus    = parseFloat(psForm.bonus) || 0;
    const gross    = basic + allow + bonus;
    const net      = gross - ded;
    // Prevent duplicate
    const exists = getPayslips().find((p) => p.staff_id === emp.id && p.pay_period === psForm.pay_period);
    if (exists) { alert(`A payslip for ${emp.full_name} for ${psForm.pay_period} already exists.`); return; }
    addPayslip({ staff_id: emp.id, staff_name: emp.full_name, pay_period: psForm.pay_period, basic_salary: basic, allowances: allow, deductions: ded, bonus, gross_pay: gross, net_pay: net, status: "draft" });
    setPsForm({ staff_id: "", pay_period: new Date().toISOString().slice(0, 7), allowances: "0", deductions: "0", bonus: "0" });
    setShowAddPayslip(false);
  };

  const selectedEmpForForm = employees.find((e) => e.id === psForm.staff_id);
  const gross = (selectedEmpForForm?.basic_salary ?? 0) + (parseFloat(psForm.allowances) || 0) + (parseFloat(psForm.bonus) || 0);
  const net   = gross - (parseFloat(psForm.deductions) || 0);

  const filteredEmp      = employees.filter((e) => e.full_name.toLowerCase().includes(search.toLowerCase()) || (e.designation ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredPayslips = payslips.filter((p) => p.staff_name.toLowerCase().includes(search.toLowerCase()) || p.pay_period.includes(search));

  const totalPayroll   = payslips.filter((p) => p.status === "paid").reduce((s, p) => s + p.net_pay, 0);
  const pendingApprove = payslips.filter((p) => p.status === "draft").length;

  if (printSlip) {
    const emp = employees.find((e) => e.id === printSlip.staff_id);
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-[#1e1b4b] text-white px-8 py-6">
            <div className="flex justify-between items-start">
              <div><p className="text-xl font-bold">KidzVenture</p><p className="text-white/60 text-sm mt-1">Salary Payslip</p></div>
              <div className="text-right">
                <p className="font-semibold">{printSlip.pay_period}</p>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${STATUS_COLORS[printSlip.status]}`}>{printSlip.status}</span>
              </div>
            </div>
          </div>
          <div className="px-8 py-5 border-b grid grid-cols-2 gap-4">
            {[
              { l: "Employee Name",  v: printSlip.staff_name },
              { l: "Employee Code",  v: emp?.employee_code || "—" },
              { l: "Designation",    v: emp?.designation || "—" },
              { l: "Department",     v: emp?.department || "—" },
              { l: "Date of Joining",v: emp?.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString("en-IN") : "—" },
              { l: "Pay Period",     v: printSlip.pay_period },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{l}</p>
                <p className="font-semibold text-slate-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          <div className="px-8 py-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Earnings</p>
                <div className="space-y-2">
                  <ERow label="Basic Salary"  amount={printSlip.basic_salary} />
                  <ERow label="Allowances"    amount={printSlip.allowances} />
                  <ERow label="Bonus"         amount={printSlip.bonus} />
                  <div className="border-t pt-2"><ERow label="Gross Pay" amount={printSlip.gross_pay} bold /></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Deductions</p>
                <div className="space-y-2">
                  <ERow label="Deductions" amount={printSlip.deductions} negative />
                  <div className="border-t pt-2"><ERow label="Total Deductions" amount={printSlip.deductions} negative bold /></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-8 mb-5 rounded-2xl bg-[#1e1b4b] px-6 py-4 text-white flex justify-between items-center">
            <p className="font-semibold text-white/80">Net Pay</p>
            <p className="text-3xl font-bold">{fmt(printSlip.net_pay)}</p>
          </div>
          <div className="px-8 pb-6 flex gap-3">
            <button type="button" onClick={() => window.print()} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white">🖨 Print</button>
            <button type="button" onClick={() => setPrintSlip(null)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">← Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary & Payroll</h1>
          <p className="text-sm text-slate-500">Manage staff records and payslips</p>
        </div>
        {tab === "payslips" && (
          <button type="button" onClick={() => setShowAddPayslip(true)}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90">
            + Generate Payslip
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-5 shadow-sm">
          <p className="text-2xl font-bold">{employees.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active Employees</p>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-green-200 p-5 shadow-sm">
          <p className="text-2xl font-bold text-green-700">{fmt(totalPayroll)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Salary Paid</p>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-yellow-200 p-5 shadow-sm">
          <p className="text-2xl font-bold text-yellow-700">{pendingApprove}</p>
          <p className="text-xs text-slate-500 mt-1">Payslips Pending Approval</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(["staff","payslips"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-6 py-2 text-sm font-semibold capitalize transition ${tab === t ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "staff" ? "👥 Staff" : "💰 Payslips"}
          </button>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "staff" ? "Search employees…" : "Search payslips…"}
        className="w-full max-w-sm rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />

      {/* Generate Payslip Form */}
      {showAddPayslip && tab === "payslips" && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800">Generate Payslip</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Employee *</label>
              <select value={psForm.staff_id} onChange={(e) => setPsForm({ ...psForm, staff_id: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                <option value="">— Select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} {e.designation ? `(${e.designation})` : ""} · {fmt(e.basic_salary)}/mo</option>)}
              </select>
              {employees.length === 0 && <p className="text-xs text-slate-400 mt-1">No employees found. Add them in the Employees page first.</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Pay Period (YYYY-MM) *</label>
              <input type="month" value={psForm.pay_period} onChange={(e) => setPsForm({ ...psForm, pay_period: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
            </div>
            {selectedEmpForForm && (
              <div className="sm:col-span-2 rounded-xl bg-slate-50 border px-4 py-3 text-sm text-slate-600">
                Basic Salary: <strong>{fmt(selectedEmpForForm.basic_salary)}</strong> / month (from employee record)
              </div>
            )}
            {(["allowances","deductions","bonus"] as const).map((f) => (
              <div key={f}>
                <label className="mb-1 block text-xs font-medium text-slate-600 capitalize">{f} (₹)</label>
                <input type="number" min="0" value={psForm[f]} onChange={(e) => setPsForm({ ...psForm, [f]: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
              </div>
            ))}
          </div>
          {selectedEmpForForm && (
            <div className="rounded-xl bg-brand-purple/5 border border-brand-purple/20 px-5 py-4 flex gap-8 text-sm">
              <div><p className="text-xs text-slate-400">Gross Pay</p><p className="font-bold text-slate-800">{fmt(gross)}</p></div>
              <div><p className="text-xs text-slate-400">Deductions</p><p className="font-bold text-red-600">−{fmt(parseFloat(psForm.deductions) || 0)}</p></div>
              <div><p className="text-xs text-slate-400">Net Pay</p><p className="text-xl font-black text-brand-purple">{fmt(net)}</p></div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={generatePayslip} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white">Generate Draft</button>
            <button type="button" onClick={() => setShowAddPayslip(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Staff Table */}
      {tab === "staff" && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {loading && employees.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">Loading…</p>
          ) : filteredEmp.length === 0 ? (
            <div className="p-10 text-center"><p className="text-3xl mb-2">👥</p><p className="text-slate-400 text-sm">No employees yet. Go to Employees page to add them.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400 border-b">
                <tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Designation</th><th className="px-4 py-3 text-left">Department</th><th className="px-4 py-3 text-left">Joined</th><th className="px-4 py-3 text-right">Basic Salary</th><th className="px-4 py-3 text-left">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmp.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">{e.full_name[0]}</div>
                        <div><p className="font-medium text-slate-800">{e.full_name}</p>{e.email && <p className="text-xs text-slate-400">{e.email}</p>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.employee_code || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.designation || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.department || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{e.date_of_joining ? new Date(e.date_of_joining).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(e.basic_salary)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payslips Table */}
      {tab === "payslips" && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {filteredPayslips.length === 0 ? (
            <div className="p-10 text-center"><p className="text-3xl mb-2">💰</p><p className="text-slate-400 text-sm">No payslips yet. Click "+ Generate Payslip" above.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400 border-b">
                <tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-right">Basic</th><th className="px-4 py-3 text-right">Allowances</th><th className="px-4 py-3 text-right">Deductions</th><th className="px-4 py-3 text-right">Bonus</th><th className="px-4 py-3 text-right">Net Pay</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayslips.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.staff_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.pay_period}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono">{fmt(p.basic_salary)}</td>
                    <td className="px-4 py-3 text-right text-xs text-green-600">+{fmt(p.allowances)}</td>
                    <td className="px-4 py-3 text-right text-xs text-red-500">−{fmt(p.deductions)}</td>
                    <td className="px-4 py-3 text-right text-xs text-blue-600">+{fmt(p.bonus)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(p.net_pay)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.status === "draft"    && <button type="button" onClick={() => updatePayslipStatus(p.id, "approved")} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Approve</button>}
                        {p.status === "approved" && <button type="button" onClick={() => updatePayslipStatus(p.id, "paid")} className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">Mark Paid</button>}
                        <button type="button" onClick={() => setPrintSlip(p)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">🖨 Slip</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ERow({ label, amount, negative = false, bold = false }: { label: string; amount: number; negative?: boolean; bold?: boolean }) {
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-bold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={negative ? "text-red-600" : "text-slate-900"}>{negative ? "−" : ""}{fmt(amount)}</span>
    </div>
  );
}
