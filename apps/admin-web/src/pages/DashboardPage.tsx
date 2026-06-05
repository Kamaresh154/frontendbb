import { useEffect, useState } from "react";
import type { InvoiceListResponse, LedgerSummaryResponse, Organization } from "@kidzventure/shared-types";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";

export default function DashboardPage() {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, isEmployee, isFranchiseManager } = useRole();

  const [org, setOrg] = useState<Organization | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListResponse | null>(null);
  const [ledger, setLedger] = useState<LedgerSummaryResponse | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [openOrders, setOpenOrders] = useState<number>(0);
  const [openLeads, setOpenLeads] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<number>(0);

  useEffect(() => {
    if (isSuperAdmin) {
      // Super admin: load global stats
      api.get<{ total: number; items: unknown[] }>("/users").then((r) => setTotalUsers(r.data.total ?? 0)).catch(() => null);
      api.get<{ total_franchises: number; total_students: number; total_revenue: number }>("/franchise/summary")
        .then((r) => {
          setStaffCount(r.data.total_franchises ?? 0);
          setLedger({ organization_id: "", from_date: null, to_date: null, accounts: [], total_revenue: r.data.total_revenue ?? 0, total_expense: 0, net_income: r.data.total_revenue ?? 0 } as any);
        }).catch(() => null);
    } else if (isAdmin || isEmployee) {
      // Admin + Employee: load org-specific data
      api.get<Organization>("/organizations/me").then((r) => setOrg(r.data)).catch(() => null);
      api.get<InvoiceListResponse>("/invoices", { params: { page: 1, page_size: 1 } }).then((r) => setInvoices(r.data)).catch(() => null);
      api.get<LedgerSummaryResponse>("/ledger/summary").then((r) => setLedger(r.data)).catch(() => null);
      api.get<{ items: unknown[]; total: number }>("/payroll/staff").then((r) => setStaffCount(r.data.total ?? r.data.items?.length ?? 0)).catch(() => null);
      if (isAdmin) {
        api.get<{ items: unknown[]; total: number }>("/crm/leads").then((r) => setOpenLeads(r.data.total ?? r.data.items?.length ?? 0)).catch(() => null);
      }
    } else if (isFranchiseManager) {
      // Franchise: limited view — only orders and products accessible
      api.get<Organization>("/organizations/me").then((r) => setOrg(r.data)).catch(() => null);
    }

    // Orders from localStorage (available to all)
    const orders = localStorage.getItem("kv_orders");
    if (orders) {
      try {
        setOpenOrders((JSON.parse(orders) as { status: string }[]).filter((o) => o.status === "pending" || o.status === "confirmed").length);
      } catch {}
    }

    // Today's attendance (from localStorage)
    const stored = localStorage.getItem("kv_emp_attendance_" + new Date().toISOString().slice(0, 10));
    if (stored) {
      try { setTodayAttendance((JSON.parse(stored) as unknown[]).length); } catch {}
    }
  }, [isSuperAdmin, isAdmin, isEmployee, isFranchiseManager]);

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ── Super Admin Dashboard ──
  if (isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{today}</p>
          <div className="mt-3 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">⚡ Super Admin — full platform access</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Franchises" value={String(staffCount)} icon="🏢" color="purple" sub="registered orgs" />
          <KpiCard label="Total Users" value={String(totalUsers)} icon="👥" color="cyan" sub="all accounts" />
          <KpiCard label="Open Orders" value={String(openOrders)} icon="🛒" color="yellow" sub="pending / confirmed" />
          {ledger && <KpiCard label="Platform Revenue" value={fmt(ledger.total_revenue)} icon="💰" color="green" sub="all franchises" />}
        </div>
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Super Admin Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction href="/users" icon="👤" label="Manage Users" desc="Create franchise & employee accounts" />
            <QuickAction href="/franchise" icon="🏢" label="Franchise Overview" desc="View all franchises" />
            <QuickAction href="/products" icon="📦" label="Product Catalogue" desc="Manage products & prices" />
            <QuickAction href="/reports" icon="📈" label="Reports" desc="Platform-wide analytics" />
          </div>
        </div>
      </div>
    );
  }

  // ── Franchise Manager Dashboard ──
  if (isFranchiseManager && !isAdmin) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.full_name?.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-slate-500">{today} · {org?.name ?? "KidzVenture"}</p>
          <div className="mt-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">🏢 Franchise Portal</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Open Orders" value={String(openOrders)} icon="🛒" color="cyan" sub="pending / confirmed" />
          <QuickActionCard href="/orders" icon="🛒" label="Place / View Orders" desc="Manage your orders" color="cyan" />
          <QuickActionCard href="/products" icon="📦" label="Product Catalogue" desc="Browse available products" color="purple" />
        </div>
        <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-700">
          <strong>Franchise access:</strong> You can place orders and browse the product catalogue. Contact your admin for other features.
        </div>
      </div>
    );
  }

  // ── Admin / Employee Dashboard ──
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEmployee ? `Hi, ${user?.full_name?.split(" ")[0]} 👋` : `Good morning, ${user?.full_name?.split(" ")[0]} 👋`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{today} · {org?.name ?? "KidzVenture"}</p>
        {isEmployee && (
          <div className="mt-3 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
            Employee Access
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isAdmin || isSuperAdmin) && (
          <KpiCard label="Total Staff" value={String(staffCount)} icon="👥" color="purple" sub="registered employees" />
        )}
        <KpiCard label="Attendance Today" value={String(todayAttendance)} icon="✅" color="green" sub="checked in" />
        <KpiCard label="Open Orders" value={String(openOrders)} icon="🛒" color="cyan" sub="pending / confirmed" />
        {isAdmin && <KpiCard label="Active Leads" value={String(openLeads)} icon="🎯" color="yellow" sub="in pipeline" />}
        {isAdmin && <KpiCard label="Total Invoices" value={String(invoices?.total ?? 0)} icon="🧾" color="purple" sub="all time" />}
        {ledger && isAdmin && (
          <>
            <KpiCard label="Total Revenue" value={fmt(ledger.total_revenue)} icon="📈" color="green" sub="all time" />
            <KpiCard label="Total Expenses" value={fmt(ledger.total_expense)} icon="📉" color="yellow" sub="all time" />
            <KpiCard label="Net Income" value={fmt(ledger.net_income)} icon="💰" color={ledger.net_income >= 0 ? "cyan" : "red"} sub="profit/loss" />
          </>
        )}
      </div>
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(isAdmin || isSuperAdmin) && <QuickAction href="/employees" icon="👤" label="Add Employee" desc="Register a new staff member" />}
          <QuickAction href="/attendance" icon="📋" label="Attendance" desc={isEmployee ? "Record your check-in" : "Mark today's attendance"} />
          <QuickAction href="/orders" icon="🛒" label="New Order" desc="Take customer order" />
          <QuickAction href="/appointments" icon="📅" label="Schedule Appt" desc="Book an appointment" />
          <QuickAction href="/tele-calling" icon="📞" label="Tele Calling" desc="Call a customer" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: "purple" | "green" | "cyan" | "yellow" | "red"; sub: string }) {
  const ring = { purple: "ring-brand-purple/20", green: "ring-emerald-200", cyan: "ring-cyan-200", yellow: "ring-yellow-200", red: "ring-red-200" }[color];
  const iconBg = { purple: "bg-brand-purple/10 text-brand-purple", green: "bg-emerald-50 text-emerald-600", cyan: "bg-cyan-50 text-cyan-600", yellow: "bg-yellow-50 text-yellow-600", red: "bg-red-50 text-red-600" }[color];
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${ring}`}>
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${iconBg}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function QuickAction({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <a href={href} className="group flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:border-brand-purple/30 hover:shadow-md">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-purple">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </a>
  );
}

function QuickActionCard({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <a href={href} className="group flex flex-col gap-2 rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-slate-100 transition hover:border-brand-purple/30 hover:shadow-md">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-sm font-bold text-slate-800 group-hover:text-brand-purple">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </a>
  );
}
