import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import {
  addEmployee, getEmployees, syncEmployeesFromAPI, updateEmployee,
  addLeave, getLeaves, reviewLeave, getLeaveBalance,
  type LocalEmployee, type LeaveRequest, type LeaveType,
} from "../lib/store";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface ApiStaff {
  id: string; full_name: string; designation: string | null; department: string | null;
  basic_salary: number; status: string; employee_code: string | null; date_of_joining: string | null; center_id: string | null;
}
interface Payslip { id: string; pay_period: string; net_pay: number; status: string; }
interface WsMessage { id: string; employee_id: string; from_name: string; from_role: string; content: string; sent_at: string; }

type Panel = "details" | "payslips" | "leave" | "calls" | "messages";

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: "Casual Leave", sick: "Sick Leave", earned: "Earned Leave", unpaid: "Unpaid Leave", other: "Other",
};
const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  casual: "bg-blue-100 text-blue-700", sick: "bg-red-100 text-red-700",
  earned: "bg-green-100 text-green-700", unpaid: "bg-slate-100 text-slate-700", other: "bg-yellow-100 text-yellow-700",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
};

function diffDays(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

/* ─── Component ──────────────────────────────────────────────────────────────── */
export default function EmployeesPage() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isEmployee } = useRole();
  const canManage = isSuperAdmin; // Only super admin can manage employees
  const myName = user?.full_name ?? "Employee";

  /* ── State ── */
  const [apiStaff, setApiStaff]   = useState<ApiStaff[]>([]);
  const [localStaff, setLocalStaff] = useState<LocalEmployee[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<ApiStaff | LocalEmployee | null>(null);
  const [panel, setPanel]         = useState<Panel>("details");
  const [payslips, setPayslips]   = useState<Payslip[]>([]);
  const [chatMessages, setChatMessages] = useState<WsMessage[]>([]);
  const [newMsg, setNewMsg]       = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError]     = useState("");
  const chatEndRef                = useRef<HTMLDivElement>(null);
  const wsRef                     = useRef<WebSocket | null>(null);
  const reconnectTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [search, setSearch]       = useState("");
  const [addError, setAddError]   = useState("");
  const [addSaving, setAddSaving] = useState(false);

  /* Edit state */
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState<Partial<LocalEmployee>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  /* Add form */
  const BLANK_FORM = { full_name: "", designation: "", department: "", basic_salary: "", employee_code: "", date_of_joining: "", phone: "", email: "", center_id: "" };
  const [form, setForm] = useState(BLANK_FORM);

  /* Leave state */
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: "casual" as LeaveType, from_date: "", to_date: "", reason: "" });
  const [leaveFilter, setLeaveFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [activeReview, setActiveReview] = useState<string | null>(null);

  /* ── Helpers ── */
  function reloadLocal() {
    setLocalStaff(getEmployees());
    setAllLeaves(getLeaves());
  }

  /* ── All employees: API + local merged ── */
  const allStaff: (ApiStaff | LocalEmployee)[] = [
    ...apiStaff,
    ...localStaff.filter((l) => !apiStaff.find((a) => a.id === l.id)),
  ];

  /* ── WebSocket Chat ── */
  function connectWs(empId: string) {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    // Try to connect to WS server; fall back to polling on error
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8001/ws/chat/${empId}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setWsError("WebSocket not available — using local store.");
      loadMessagesFromStore(empId);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setWsError("");
      // Send auth
      ws.send(JSON.stringify({ type: "auth", user: user?.full_name ?? "Admin", role: isSuperAdmin ? "super_admin" : isAdmin ? "admin" : "employee" }));
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "history") {
          setChatMessages(data.messages ?? []);
        } else if (data.type === "message") {
          setChatMessages((prev) => [...prev, data.message]);
        }
      } catch {}
    };

    ws.onerror = () => {
      setWsConnected(false);
      setWsError("Live chat offline — showing stored messages.");
      loadMessagesFromStore(empId);
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Auto-reconnect after 4s
      reconnectTimer.current = setTimeout(() => {
        if (selected?.id === empId) connectWs(empId);
      }, 4000);
    };
  }

  function loadMessagesFromStore(empId: string) {
    const stored = JSON.parse(localStorage.getItem(`kv_ws_msgs_${empId}`) ?? "[]") as WsMessage[];
    setChatMessages(stored.slice().sort((a, b) => a.sent_at.localeCompare(b.sent_at)));
  }

  function sendChatMessage() {
    if (!newMsg.trim() || !selected) return;
    const msg: WsMessage = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      employee_id: selected.id,
      from_name: user?.full_name ?? "Admin",
      from_role: isSuperAdmin ? "super_admin" : isAdmin ? "admin" : "employee",
      content: newMsg.trim(),
      sent_at: new Date().toISOString(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", message: msg }));
    } else {
      // Fallback: local store
      const stored = JSON.parse(localStorage.getItem(`kv_ws_msgs_${selected.id}`) ?? "[]") as WsMessage[];
      stored.push(msg);
      localStorage.setItem(`kv_ws_msgs_${selected.id}`, JSON.stringify(stored));
      setChatMessages((prev) => [...prev, msg]);
    }
    setNewMsg("");
  }

  /* ── Load ── */
  useEffect(() => {
    reloadLocal();
    const handler = () => reloadLocal();
    window.addEventListener("kv-store-update", handler);
    return () => window.removeEventListener("kv-store-update", handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<{ items: ApiStaff[] }>("/payroll/staff")
      .then((r) => { setApiStaff(r.data.items); syncEmployeesFromAPI(r.data.items); })
      .catch(() => setApiStaff([]))
      .finally(() => setLoading(false));
  }, []);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  const loadPayslips = (staffId: string) => {
    api.get<{ items: Payslip[] }>(`/payroll/payslips?staff_id=${staffId}`)
      .then((r) => setPayslips(r.data.items))
      .catch(() => setPayslips([]));
  };

  const selectEmployee = (s: ApiStaff | LocalEmployee) => {
    setSelected(s);
    setPanel("details");
    setShowLeaveForm(false);
    setLeaveFilter("all");
    setEditMode(false);
    setEditError("");
    loadPayslips(s.id);
    // init edit form from selected employee
    const localEmp = localStaff.find((e) => e.id === s.id);
    if (localEmp) {
      setEditForm({ ...localEmp });
    } else {
      setEditForm({
        full_name: s.full_name,
        designation: s.designation ?? "",
        department: s.department ?? "",
        basic_salary: s.basic_salary,
        employee_code: "employee_code" in s ? (s.employee_code ?? "") : "",
        date_of_joining: s.date_of_joining ?? "",
        status: s.status as "active" | "inactive",
      });
    }
    connectWs(s.id);
  };

  /* ── Edit employee ── */
  const saveEdit = async () => {
    setEditError("");
    if (!editForm.full_name?.trim()) { setEditError("Full name is required."); return; }
    setEditSaving(true);
    try {
      // Try API patch
      await api.patch(`/payroll/staff/${selected!.id}`, {
        full_name: editForm.full_name,
        designation: editForm.designation,
        department: editForm.department,
        basic_salary: Number(editForm.basic_salary) || 0,
        employee_code: editForm.employee_code,
        date_of_joining: editForm.date_of_joining,
        status: editForm.status,
      });
      const r = await api.get<{ items: ApiStaff[] }>("/payroll/staff");
      setApiStaff(r.data.items);
      syncEmployeesFromAPI(r.data.items);
    } catch {
      // Update local store
      updateEmployee(selected!.id, {
        full_name: editForm.full_name!,
        designation: editForm.designation ?? "",
        department: editForm.department ?? "",
        basic_salary: Number(editForm.basic_salary) || 0,
        employee_code: editForm.employee_code ?? "",
        date_of_joining: editForm.date_of_joining ?? "",
        phone: editForm.phone ?? "",
        email: editForm.email ?? "",
        status: (editForm.status ?? "active") as "active" | "inactive",
      });
    }
    reloadLocal();
    setEditMode(false);
    setEditSaving(false);
  };

  /* ── Add employee ── */
  const createEmployee = async () => {
    setAddError("");
    if (!form.full_name.trim()) { setAddError("Full name is required."); return; }
    setAddSaving(true);
    try {
      await api.post("/payroll/staff", { ...form, basic_salary: parseFloat(form.basic_salary) || 0 });
      const r = await api.get<{ items: ApiStaff[] }>("/payroll/staff");
      setApiStaff(r.data.items);
      syncEmployeesFromAPI(r.data.items);
    } catch {
      addEmployee({
        full_name: form.full_name.trim(),
        designation: form.designation,
        department: form.department,
        basic_salary: parseFloat(form.basic_salary) || 0,
        employee_code: form.employee_code,
        date_of_joining: form.date_of_joining,
        phone: form.phone,
        email: form.email,
        center_id: form.center_id,
        status: "active",
      });
    }
    setForm(BLANK_FORM);
    setShowAdd(false);
    setAddSaving(false);
  };

  /* ── Leave actions ── */
  const submitLeave = () => {
    if (!leaveForm.from_date || !leaveForm.to_date || !leaveForm.reason.trim()) {
      alert("Please fill in all leave fields.");
      return;
    }
    if (!selected) return;
    addLeave({
      employee_id: selected.id,
      employee_name: selected.full_name,
      leave_type: leaveForm.leave_type,
      from_date: leaveForm.from_date,
      to_date: leaveForm.to_date,
      days: diffDays(leaveForm.from_date, leaveForm.to_date),
      reason: leaveForm.reason,
    });
    setLeaveForm({ leave_type: "casual", from_date: "", to_date: "", reason: "" });
    setShowLeaveForm(false);
  };

  const handleReview = (id: string, status: "approved" | "rejected") => {
    reviewLeave(id, status, myName, reviewNote[id] ?? "");
    setActiveReview(null);
    setReviewNote((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  /* ── Filtered lists ── */
  const filtered = allStaff.filter((s) => {
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) ||
      (s.designation ?? "").toLowerCase().includes(q) ||
      (s.department ?? "").toLowerCase().includes(q);
  });

  const selectedLeaves = selected
    ? allLeaves.filter((l) => l.employee_id === selected.id && (leaveFilter === "all" || l.status === leaveFilter))
    : [];
  const pendingLeaves = allLeaves.filter((l) => l.status === "pending");
  const balance = selected ? getLeaveBalance(selected.id) : null;

  const PANELS: { key: Panel; label: string; icon: string }[] = [
    { key: "details", label: "Details", icon: "👤" },
    { key: "payslips", label: "Payslips", icon: "💰" },
    { key: "leave", label: `Leave${selected && allLeaves.filter((l) => l.employee_id === selected?.id && l.status === "pending").length > 0 ? " 🔴" : ""}`, icon: "🗓" },
    { key: "calls", label: "Call Logs", icon: "📞" },
    { key: "messages", label: "Messages", icon: "💬" },
  ];

  /* ─────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── LEFT: Employee List ───────────────────────────────────────────────── */}
      <div className="flex w-80 flex-col border-r bg-white shadow-sm flex-shrink-0">
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Employees</h1>
              <p className="text-xs text-slate-400">{allStaff.length} total{pendingLeaves.length > 0 && ` · ${pendingLeaves.length} leave pending`}</p>
            </div>
            {canManage && (
              <button type="button" onClick={() => { setShowAdd(!showAdd); setAddError(""); }}
                className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                + Add
              </button>
            )}
          </div>
          <input type="text" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
        </div>

        {/* Add form - only super admin */}
        {showAdd && canManage && (
          <div className="border-b bg-slate-50 p-4 space-y-2 overflow-y-auto max-h-96">
            <p className="font-semibold text-slate-700 text-sm mb-2">New Employee</p>
            {addError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {addError}</p>}
            {([
              { key: "full_name", label: "Full Name *", type: "text" },
              { key: "employee_code", label: "Employee Code", type: "text" },
              { key: "designation", label: "Designation", type: "text" },
              { key: "department", label: "Department", type: "text" },
              { key: "basic_salary", label: "Basic Salary (₹)", type: "number" },
              { key: "date_of_joining", label: "Date of Joining", type: "date" },
              { key: "phone", label: "Phone", type: "text" },
              { key: "email", label: "Email", type: "email" },
            ] as { key: keyof typeof form; label: string; type: string }[]).map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
                <input type={type} value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-purple" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={createEmployee} disabled={addSaving}
                className="flex-1 rounded-lg bg-brand-purple py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {addSaving ? "Saving…" : "Save Employee"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }}
                className="flex-1 rounded-lg border py-1.5 text-xs text-slate-600">Cancel</button>
            </div>
          </div>
        )}

        {/* Pending leave alert */}
        {canManage && pendingLeaves.length > 0 && (
          <div className="border-b bg-yellow-50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-yellow-600 text-sm">⏳</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-yellow-800">{pendingLeaves.length} leave request{pendingLeaves.length > 1 ? "s" : ""} pending</p>
              <p className="text-[10px] text-yellow-600 truncate">{pendingLeaves.map((l) => l.employee_name).join(", ")}</p>
            </div>
          </div>
        )}

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {loading && <p className="p-4 text-sm text-slate-400 text-center">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm text-slate-400">No employees found</p>
              {canManage && <p className="text-xs text-slate-400 mt-1">Click "+ Add" to create one</p>}
            </div>
          )}
          {filtered.map((s) => {
            const empPendingLeaves = allLeaves.filter((l) => l.employee_id === s.id && l.status === "pending").length;
            return (
              <button key={s.id} type="button" onClick={() => selectEmployee(s)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${selected?.id === s.id ? "bg-purple-50 border-r-2 border-brand-purple" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple/10 text-sm font-bold text-brand-purple">
                      {s.full_name[0]?.toUpperCase()}
                    </div>
                    {empPendingLeaves > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-white">{empPendingLeaves}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.designation ?? "—"} · {s.department ?? "—"}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ───────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          {/* Header */}
          <div className="border-b bg-white px-6 py-4 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple text-xl font-bold text-white shadow">
                {selected.full_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-900">{selected.full_name}</h2>
                <p className="text-sm text-slate-500 truncate">
                  {selected.designation ?? "No designation"} · {selected.department ?? "No department"}
                  {"employee_code" in selected && selected.employee_code
                    ? <> · <span className="font-mono">{selected.employee_code}</span></> : null}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-slate-900">₹{Number(selected.basic_salary).toLocaleString("en-IN")}</p>
                <p className="text-xs text-slate-400">Basic / month</p>
              </div>
            </div>
            {/* Tab bar */}
            <div className="mt-4 flex gap-1 flex-wrap">
              {PANELS.map((p) => (
                <button key={p.key} type="button" onClick={() => setPanel(p.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${panel === p.key ? "bg-brand-purple text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── DETAILS ── */}
            {panel === "details" && (
              <div className="space-y-4">
                {/* Edit mode toggle — super admin only */}
                {canManage && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Employee Information</h3>
                    {!editMode ? (
                      <button type="button" onClick={() => setEditMode(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 shadow-sm">
                        ✏️ Edit Details
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} disabled={editSaving}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                          {editSaving ? "Saving…" : "✓ Save Changes"}
                        </button>
                        <button type="button" onClick={() => { setEditMode(false); setEditError(""); }}
                          className="rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {editError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {editError}</p>
                )}

                {editMode ? (
                  /* Edit form */
                  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 p-5 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {([
                        { key: "full_name", label: "Full Name *", type: "text" },
                        { key: "employee_code", label: "Employee Code", type: "text" },
                        { key: "designation", label: "Designation", type: "text" },
                        { key: "department", label: "Department", type: "text" },
                        { key: "basic_salary", label: "Basic Salary (₹)", type: "number" },
                        { key: "date_of_joining", label: "Date of Joining", type: "date" },
                        { key: "phone", label: "Phone", type: "text" },
                        { key: "email", label: "Email", type: "email" },
                      ] as { key: keyof LocalEmployee; label: string; type: string }[]).map(({ key, label, type }) => (
                        <div key={key}>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
                          <input type={type} value={String(editForm[key] ?? "")}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                        <select value={editForm.status ?? "active"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "active" | "inactive" })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: "Full Name", value: selected.full_name },
                      { label: "Employee Code", value: ("employee_code" in selected ? selected.employee_code : null) ?? "—" },
                      { label: "Designation", value: selected.designation ?? "—" },
                      { label: "Department", value: selected.department ?? "—" },
                      { label: "Date of Joining", value: selected.date_of_joining ? fmtDate(selected.date_of_joining) : "—" },
                      { label: "Basic Salary", value: `₹${Number(selected.basic_salary).toLocaleString("en-IN")}` },
                      { label: "Status", value: selected.status },
                      ...("phone" in selected && selected.phone ? [{ label: "Phone", value: selected.phone }] : []),
                      ...("email" in selected && selected.email ? [{ label: "Email", value: selected.email }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAYSLIPS ── */}
            {panel === "payslips" && (
              <div className="space-y-3">
                {payslips.length === 0 && (
                  <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-100">
                    <p className="text-3xl mb-2">💰</p>
                    <p className="text-sm text-slate-400">No payslips yet for this employee</p>
                  </div>
                )}
                {payslips.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div>
                      <p className="font-semibold text-slate-800">{p.pay_period}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${p.status === "paid" ? "bg-green-100 text-green-700" : p.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">₹{Number(p.net_pay).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-slate-400">Net Pay</p>
                    </div>
                    <button type="button" className="ml-4 rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">🖨 Print</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── LEAVE ── */}
            {panel === "leave" && (
              <div className="space-y-5">
                {balance && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Leave Balance — {new Date().getFullYear()}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["casual", "sick", "earned", "unpaid"] as LeaveType[]).map((lt) => (
                        <div key={lt} className="rounded-xl bg-white ring-1 ring-slate-100 p-4 text-center shadow-sm">
                          <p className="text-2xl font-bold text-slate-900">{balance.remaining[lt] === 999 ? "∞" : balance.remaining[lt]}</p>
                          <p className="text-xs text-slate-500 mt-1">{LEAVE_TYPE_LABELS[lt]}</p>
                          <p className="text-[10px] text-slate-400">{balance.used[lt]} used / {lt === "unpaid" ? "∞" : balance.quota[lt]} quota</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Leave History — {selectedLeaves.length} record{selectedLeaves.length !== 1 ? "s" : ""}
                  </h3>
                  <div className="flex items-center gap-2">
                    {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setLeaveFilter(s)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${leaveFilter === s ? "bg-brand-purple text-white" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>{s}</button>
                    ))}
                    <button type="button" onClick={() => setShowLeaveForm(!showLeaveForm)}
                      className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 ml-2">
                      + Approve Leave
                    </button>
                  </div>
                </div>
                {showLeaveForm && (
                  <div className="rounded-2xl border border-brand-purple/20 bg-white p-5 shadow-sm">
                    <h4 className="font-semibold text-slate-800 text-sm mb-4">New Leave Request — {selected.full_name}</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Leave Type</label>
                        <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as LeaveType })}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                          {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">From Date</label>
                          <input type="date" value={leaveForm.from_date} onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                            className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">To Date</label>
                          <input type="date" min={leaveForm.from_date} value={leaveForm.to_date} onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                            className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
                        </div>
                      </div>
                      {leaveForm.from_date && leaveForm.to_date && (
                        <div className="sm:col-span-2">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            📅 {diffDays(leaveForm.from_date, leaveForm.to_date)} day{diffDays(leaveForm.from_date, leaveForm.to_date) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Reason *</label>
                        <textarea rows={3} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                          className="w-full rounded-xl border px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-brand-purple focus:outline-none"
                          placeholder="Reason for leave…" />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={submitLeave} className="rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Submit Request</button>
                      <button type="button" onClick={() => setShowLeaveForm(false)} className="rounded-xl border px-4 py-2 text-sm text-slate-600">Cancel</button>
                    </div>
                  </div>
                )}
                {selectedLeaves.length === 0 ? (
                  <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-100">
                    <p className="text-3xl mb-2">🗓</p>
                    <p className="text-sm text-slate-400">No leave records{leaveFilter !== "all" ? ` with status "${leaveFilter}"` : ""}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedLeaves.map((lv) => (
                      <div key={lv.id} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                        <div className="flex items-start gap-4 p-4">
                          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${LEAVE_TYPE_COLORS[lv.leave_type]}`}>
                            {LEAVE_TYPE_LABELS[lv.leave_type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800">
                                {fmtDate(lv.from_date)}
                                {lv.from_date !== lv.to_date ? ` → ${fmtDate(lv.to_date)}` : ""}
                              </p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{lv.days} day{lv.days !== 1 ? "s" : ""}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[lv.status]}`}>{lv.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">"{lv.reason}"</p>
                            <p className="text-[10px] text-slate-400 mt-1">Applied: {fmtDate(lv.applied_on)}</p>
                            {lv.reviewed_by && (
                              <p className="text-[10px] mt-0.5">
                                <span className={lv.status === "approved" ? "text-green-600" : "text-red-600"}>
                                  {lv.status === "approved" ? "✓ Approved" : "✕ Rejected"} by {lv.reviewed_by}
                                </span>
                                {lv.review_note && <span className="text-slate-400"> — "{lv.review_note}"</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        {canManage && lv.status === "pending" && (
                          <div className="border-t bg-slate-50 px-4 py-3">
                            {activeReview === lv.id ? (
                              <div className="space-y-2">
                                <input value={reviewNote[lv.id] ?? ""} onChange={(e) => setReviewNote({ ...reviewNote, [lv.id]: e.target.value })}
                                  placeholder="Add a note (optional)…"
                                  className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-purple" />
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleReview(lv.id, "approved")}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">✓ Approve</button>
                                  <button type="button" onClick={() => handleReview(lv.id, "rejected")}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">✕ Reject</button>
                                  <button type="button" onClick={() => setActiveReview(null)}
                                    className="rounded-lg border px-3 py-1.5 text-xs text-slate-600">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setActiveReview(lv.id)}
                                className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                                Review Leave Request
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CALLS ── */}
            {panel === "calls" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 mb-2">Recent call logs for {selected.full_name}</p>
                {[
                  { id: "c1", customer: "Ramesh Kumar", phone: "9876543210", duration: "4:23", date: "2026-05-19", notes: "Enquiry about product range" },
                  { id: "c2", customer: "Priya Sharma", phone: "9845001122", duration: "7:11", date: "2026-05-18", notes: "Order confirmation follow-up" },
                ].map((c) => (
                  <div key={c.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600 text-lg">📞</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{c.customer}</p>
                      <p className="text-xs text-slate-500">{c.phone} · {c.date} · {c.duration} min</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>
                    </div>
                    {(isSuperAdmin || isEmployee) && (
                      <button type="button" className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-brand-purple hover:bg-purple-100">▶ Play</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── MESSAGES (WebSocket chat) ── */}
            {panel === "messages" && (
              <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
                <div className={`mb-3 rounded-xl border px-3 py-2 text-xs flex items-center gap-2 flex-shrink-0 ${wsConnected ? "bg-green-50 border-green-100 text-green-700" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${wsConnected ? "bg-green-500" : "bg-yellow-400"}`} />
                  <span>
                    {wsConnected ? "🟢 Live chat connected" : wsError || "Connecting to live chat…"}
                    {" "}<strong>{selected?.full_name}</strong>
                  </span>
                </div>
                {/* Message list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4" style={{ maxHeight: "calc(100vh - 380px)" }}>
                  {chatMessages.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                      No messages yet. Send the first message below.
                    </div>
                  )}
                  {chatMessages.map((m) => {
                    const isMe = m.from_name === (user?.full_name ?? "Admin");
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isMe ? "bg-brand-purple text-white" : "bg-white text-slate-800 ring-1 ring-slate-100"}`}>
                          <p className={`text-[10px] mb-1 font-semibold ${isMe ? "text-white/60" : "text-slate-400"}`}>
                            {m.from_name} · {new Date(m.sent_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                {/* Input */}
                <div className="flex gap-2 flex-shrink-0 border-t pt-4">
                  <input
                    type="text"
                    placeholder={`Message ${selected?.full_name}…`}
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    className="flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                  <button
                    type="button"
                    onClick={sendChatMessage}
                    disabled={!newMsg.trim()}
                    className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-slate-600 font-medium">Select an employee</p>
            <p className="text-sm text-slate-400 mt-1">Choose from the list to view details, leave & payslips</p>
          </div>
        </div>
      )}
    </div>
  );
}
