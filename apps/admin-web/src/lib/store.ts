/**
 * KidzVenture Central Store
 * - All reads are synchronous (from localStorage mirror)
 * - All writes are async (persist to IndexedDB via db.set, mirror to localStorage)
 * - Broadcasts "kv-store-update" CustomEvent on every write
 */
import { kvdb } from "./db";

// ─── Keys ────────────────────────────────────────────────────────────────────
export const KEYS = {
  CENTERS:    "kv_centers",
  EMPLOYEES:  "kv_local_employees",
  ORDERS:     "kv_orders",
  INVOICES:   "kv_local_invoices",
  LEDGER:     "kv_ledger_entries",
  PAYSLIPS:   "kv_payslips",
  LEAVES:     "kv_leave_requests",
  PRODUCTS:   "kv_product_catalogue",
  ATTENDANCE_LOG: "kv_attendance_log",
  ATTENDANCE: (date: string) => `kv_emp_attendance_${date}`,
  MY_ATTENDANCE: (uid: string, date: string) => `kv_my_attendance_${uid}_${date}`,
};

// Synchronous read from localStorage (always available as mirror)
export function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

// Async write — persists to IndexedDB AND mirrors to localStorage
export async function write<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value)); // instant mirror
  await kvdb.set(key, value);                        // durable persist
}

// Sync write helper for contexts that can't be async (use sparingly)
export function writeSync<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  kvdb.set(key, value).catch(() => {}); // fire-and-forget persist
  window.dispatchEvent(new CustomEvent("kv-store-update", { detail: key }));
}

// ─── Centres ──────────────────────────────────────────────────────────────────
export interface Centre { id: string; name: string; address?: string; phone?: string; }
export function getCentres(): Centre[] { return read<Centre[]>(KEYS.CENTERS, []); }
export function addCentre(name: string, address = "", phone = ""): Centre {
  const c: Centre = { id: "ctr_" + Date.now(), name: name.trim(), address, phone };
  writeSync(KEYS.CENTERS, [...getCentres(), c]);
  return c;
}
export function updateCentre(id: string, patch: Partial<Centre>) {
  writeSync(KEYS.CENTERS, getCentres().map((c) => c.id === id ? { ...c, ...patch } : c));
}
export function deleteCentre(id: string) {
  writeSync(KEYS.CENTERS, getCentres().filter((c) => c.id !== id));
}

// ─── Employees ────────────────────────────────────────────────────────────────
export interface LocalEmployee {
  id: string; full_name: string; designation: string; department: string;
  basic_salary: number; employee_code: string; date_of_joining: string;
  phone: string; email: string; center_id: string; status: "active" | "inactive";
  created_at: string;
}
export function getEmployees(): LocalEmployee[] { return read<LocalEmployee[]>(KEYS.EMPLOYEES, []); }
export function addEmployee(emp: Omit<LocalEmployee, "id" | "created_at">): LocalEmployee {
  const e: LocalEmployee = { ...emp, id: "emp_" + Date.now(), created_at: new Date().toISOString() };
  writeSync(KEYS.EMPLOYEES, [...getEmployees(), e]);
  return e;
}
export function updateEmployee(id: string, patch: Partial<LocalEmployee>) {
  writeSync(KEYS.EMPLOYEES, getEmployees().map((e) => e.id === id ? { ...e, ...patch } : e));
}
export function syncEmployeesFromAPI(apiEmps: { id: string; full_name: string; designation?: string | null; department?: string | null; basic_salary?: number; status?: string; employee_code?: string | null; date_of_joining?: string | null }[]) {
  const existing = getEmployees();
  const existingIds = new Set(existing.map((e) => e.id));
  const newOnes: LocalEmployee[] = apiEmps
    .filter((a) => !existingIds.has(a.id))
    .map((a) => ({
      id: a.id, full_name: a.full_name, designation: a.designation ?? "", department: a.department ?? "",
      basic_salary: a.basic_salary ?? 0, employee_code: a.employee_code ?? "",
      date_of_joining: a.date_of_joining ?? "", phone: "", email: "", center_id: "",
      status: a.status === "active" ? "active" : "inactive", created_at: new Date().toISOString(),
    }));
  if (newOnes.length > 0) writeSync(KEYS.EMPLOYEES, [...existing, ...newOnes]);
}

// ─── Payslips ─────────────────────────────────────────────────────────────────
export interface LocalPayslip {
  id: string; staff_id: string; staff_name: string;
  pay_period: string; basic_salary: number; allowances: number;
  deductions: number; bonus: number; gross_pay: number; net_pay: number;
  status: "draft" | "approved" | "paid"; created_at: string;
}
export function getPayslips(): LocalPayslip[] { return read<LocalPayslip[]>(KEYS.PAYSLIPS, []); }
export function addPayslip(ps: Omit<LocalPayslip, "id" | "created_at">): LocalPayslip {
  const p: LocalPayslip = { ...ps, id: "pay_" + Date.now(), created_at: new Date().toISOString() };
  writeSync(KEYS.PAYSLIPS, [p, ...getPayslips()]);
  return p;
}
export function updatePayslipStatus(id: string, status: "approved" | "paid") {
  const updated = getPayslips().map((p) => p.id === id ? { ...p, status } : p);
  writeSync(KEYS.PAYSLIPS, updated);
  // If marked paid, post ledger debit
  if (status === "paid") {
    const ps = updated.find((p) => p.id === id);
    if (ps) addLedgerEntry({ type: "debit", category: "payroll", amount: ps.net_pay,
      description: `Salary paid — ${ps.staff_name} (${ps.pay_period})`,
      reference: ps.id, date: new Date().toISOString().slice(0, 10), source: "payroll" });
  }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export type InvoiceType = "tuition" | "purchase" | "order";
export interface InvoiceLine { description: string; qty: number; unit: string; unit_price: number; tax_rate: number; line_total: number; tax_amount: number; }
export interface LocalInvoice {
  id: string; invoice_no: string; invoice_type: InvoiceType;
  center_id: string; center_name: string;
  student_name?: string; student_id?: string;
  vendor_name?: string; vendor_contact?: string; purchase_date?: string;
  order_id?: string; order_no?: string;
  customer_name?: string; customer_phone?: string;
  placed_by?: string; attended_by?: string;
  lines: InvoiceLine[];
  subtotal: number; tax_total: number; total: number; tax_rate: number;
  payment_method?: "gpay" | "cash" | "other";
  payment_ref?: string;  // UPI transaction ID or note
  notes?: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  date: string; created_by: string; created_at: string;
}
export function getInvoices(): LocalInvoice[] { return read<LocalInvoice[]>(KEYS.INVOICES, []); }
export function addInvoice(inv: Omit<LocalInvoice, "id" | "invoice_no" | "created_at">): LocalInvoice {
  const all = getInvoices();
  const no = "INV-" + String(all.length + 1).padStart(4, "0");
  const full: LocalInvoice = { ...inv, id: "inv_" + Date.now(), invoice_no: no, created_at: new Date().toISOString() };
  writeSync(KEYS.INVOICES, [full, ...all]);
  // Auto-post ledger
  if (full.invoice_type !== "purchase") {
    addLedgerEntry({ type: "credit", category: "revenue", amount: full.total,
      description: `Invoice ${no} — ${full.customer_name ?? full.student_name ?? "Revenue"}`,
      reference: no, date: full.date, source: "invoice" });
  } else {
    addLedgerEntry({ type: "debit", category: "purchase", amount: full.total,
      description: `Purchase ${no} — ${full.vendor_name ?? "Vendor"}`,
      reference: no, date: full.date, source: "invoice" });
  }
  return full;
}
export function updateInvoiceStatus(id: string, status: LocalInvoice["status"], paymentMethod?: string, paymentRef?: string) {
  writeSync(KEYS.INVOICES, getInvoices().map((inv) =>
    inv.id === id ? { ...inv, status, ...(paymentMethod ? { payment_method: paymentMethod, payment_ref: paymentRef } : {}) } : inv
  ));
}
export function sendInvoice(id: string) { updateInvoiceStatus(id, "sent"); }

// ─── Ledger ───────────────────────────────────────────────────────────────────
export interface LedgerEntry {
  id: string; type: "credit" | "debit";
  category: "revenue" | "purchase" | "expense" | "payroll" | "other";
  amount: number; description: string; reference?: string;
  date: string; source: "invoice" | "manual" | "order" | "payroll"; created_at: string;
}
export function getLedgerEntries(): LedgerEntry[] { return read<LedgerEntry[]>(KEYS.LEDGER, []); }
export function addLedgerEntry(entry: Omit<LedgerEntry, "id" | "created_at">): LedgerEntry {
  const full: LedgerEntry = { ...entry, id: "ldg_" + Date.now(), created_at: new Date().toISOString() };
  writeSync(KEYS.LEDGER, [full, ...getLedgerEntries()]);
  return full;
}
export function getLedgerSummary(from?: string, to?: string) {
  let entries = getLedgerEntries();
  if (from) entries = entries.filter((e) => e.date >= from);
  if (to)   entries = entries.filter((e) => e.date <= to);
  const revenue  = entries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter((e) => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  return { revenue, expenses, net: revenue - expenses, entries };
}

// ─── Leave ────────────────────────────────────────────────────────────────────
export type LeaveType   = "casual" | "sick" | "earned" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";
export interface LeaveRequest {
  id: string; employee_id: string; employee_name: string;
  leave_type: LeaveType; from_date: string; to_date: string; days: number;
  reason: string; status: LeaveStatus; applied_on: string;
  reviewed_by?: string; reviewed_on?: string; review_note?: string;
}
export function getLeaves(): LeaveRequest[] { return read<LeaveRequest[]>(KEYS.LEAVES, []); }
export function addLeave(req: Omit<LeaveRequest, "id" | "applied_on" | "status">): LeaveRequest {
  const full: LeaveRequest = { ...req, id: "lv_" + Date.now(), status: "pending", applied_on: new Date().toISOString().slice(0, 10) };
  writeSync(KEYS.LEAVES, [full, ...getLeaves()]);
  return full;
}
export function reviewLeave(id: string, status: "approved" | "rejected", reviewedBy: string, note = "") {
  writeSync(KEYS.LEAVES, getLeaves().map((l) =>
    l.id === id ? { ...l, status, reviewed_by: reviewedBy, reviewed_on: new Date().toISOString().slice(0, 10), review_note: note } : l
  ));
}
export function getLeaveBalance(employeeId: string, year = new Date().getFullYear()) {
  const approved = getLeaves().filter((l) => l.employee_id === employeeId && l.status === "approved" && l.from_date.startsWith(String(year)));
  const used: Record<LeaveType, number> = { casual: 0, sick: 0, earned: 0, unpaid: 0, other: 0 };
  approved.forEach((l) => { used[l.leave_type] = (used[l.leave_type] || 0) + l.days; });
  const quota: Record<LeaveType, number> = { casual: 12, sick: 12, earned: 15, unpaid: 999, other: 5 };
  return { used, quota, remaining: Object.fromEntries(Object.entries(quota).map(([k, q]) => [k, Math.max(0, q - (used[k as LeaveType] || 0))])) as Record<LeaveType, number> };
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  staffId: string; name: string; checkIn: string; checkOut?: string;
  date: string; status: "present" | "absent" | "half-day";
}
export interface AttendanceLogEntry {
  id: string; employee_id: string; employee_name: string;
  date: string; check_in: string; check_out?: string;
  status: "present" | "absent" | "half-day"; recorded_by?: string;
}
export function getAttendanceLog(): AttendanceLogEntry[] { return read<AttendanceLogEntry[]>(KEYS.ATTENDANCE_LOG, []); }
export function upsertAttendance(entry: Omit<AttendanceLogEntry, "id"> & { id?: string }): AttendanceLogEntry {
  const all = getAttendanceLog();
  const existing = all.find((a) => a.employee_id === entry.employee_id && a.date === entry.date);
  if (existing) {
    const updated = all.map((a) => a.id === existing.id ? { ...a, ...entry, id: existing.id } : a);
    writeSync(KEYS.ATTENDANCE_LOG, updated);
    return { ...existing, ...entry };
  }
  const full: AttendanceLogEntry = { ...entry, id: "att_" + Date.now() };
  writeSync(KEYS.ATTENDANCE_LOG, [full, ...all]);
  return full;
}
export function getAttendanceForDate(date: string): AttendanceLogEntry[] {
  return getAttendanceLog().filter((a) => a.date === date);
}
export function getMyTodayAttendance(employeeId: string): AttendanceLogEntry | null {
  const today = new Date().toISOString().slice(0, 10);
  return getAttendanceLog().find((a) => a.employee_id === employeeId && a.date === today) ?? null;
}

// ─── Monthly Revenue for Reports ──────────────────────────────────────────────
export interface MonthlyRevenue { month: string; label: string; revenue: number; expenses: number; net: number; invoice_count: number; }
export function getMonthlyRevenue(months = 12): MonthlyRevenue[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const entries = getLedgerEntries().filter((e) => e.date.startsWith(monthStr));
    const revenue  = entries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0);
    const expenses = entries.filter((e) => e.type === "debit").reduce((s, e) => s + e.amount, 0);
    const invoice_count = getInvoices().filter((inv) => inv.date.startsWith(monthStr)).length;
    return { month: monthStr, label, revenue, expenses, net: revenue - expenses, invoice_count };
  });
}

// ─── Employee Messages (persistent chat) ─────────────────────────────────────
export interface ChatMessage {
  id: string;
  employee_id: string;   // the employee this thread belongs to
  from_name: string;     // sender display name
  from_role: string;     // "admin" | "super_admin" | "employee"
  content: string;
  sent_at: string;       // ISO timestamp
  direction: "in" | "out"; // from current viewer's perspective (set at render time)
}
const MESSAGES_KEY = "kv_employee_messages";

export function getAllMessages(): ChatMessage[] {
  return read<ChatMessage[]>(MESSAGES_KEY, []);
}
export function getMessagesForEmployee(employeeId: string): ChatMessage[] {
  return getAllMessages().filter((m) => m.employee_id === employeeId);
}
export function sendMessage(msg: Omit<ChatMessage, "id" | "sent_at">): ChatMessage {
  const full: ChatMessage = {
    ...msg,
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    sent_at: new Date().toISOString(),
  };
  writeSync(MESSAGES_KEY, [full, ...getAllMessages()]);
  return full;
}
