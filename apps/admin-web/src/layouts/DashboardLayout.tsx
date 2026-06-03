import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  superAdminOnly?: boolean;   // super_admin only
  internalOnly?: boolean;     // super_admin + employee (not franchise)
}
interface NavSection { label: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "📊", end: true }],
  },
  {
    label: "Students & Parents",
    items: [
      { to: "/students", label: "Students", icon: "🎓", internalOnly: true },
      { to: "/parents",  label: "Parents",  icon: "👨‍👩‍👧", internalOnly: true },
    ],
  },
  {
    label: "Employees",
    items: [
      { to: "/employees",  label: "Employee List", icon: "👥", internalOnly: true },
      { to: "/attendance", label: "Attendance",    icon: "📋", internalOnly: true },
    ],
  },
  {
    label: "Communications",
    items: [
      { to: "/tele-calling",  label: "Tele Calling",  icon: "📞" },
      { to: "/appointments",  label: "Appointments",  icon: "📅" },
      { to: "/crm",           label: "CRM / Leads",   icon: "🎯", internalOnly: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/products", label: "Product Catalogue", icon: "📦" },
      { to: "/orders",   label: "Orders",            icon: "🛒" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/invoices", label: "Invoices",          icon: "🧾", internalOnly: true },
      { to: "/ledger",   label: "Accounts / Ledger", icon: "📊", superAdminOnly: true },
      { to: "/reports",  label: "Reports",           icon: "📈", superAdminOnly: true },
      { to: "/payroll",  label: "Salary & Payroll",  icon: "💰", superAdminOnly: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/franchise", label: "Franchise",        icon: "🏢", superAdminOnly: true },
      { to: "/users",     label: "User Management",  icon: "🔐", superAdminOnly: true },
    ],
  },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { isSuperAdmin, isEmployee, isFranchiseManager } = useRole();

  const roleBadge = isSuperAdmin
    ? { label: "Super Admin", cls: "bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/30" }
    : isEmployee
    ? { label: "Employee",    cls: "bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/30" }
    : isFranchiseManager
    ? { label: "Franchise Mgr", cls: "bg-orange-400/20 text-orange-300 ring-1 ring-orange-400/30" }
    : { label: "User", cls: "bg-white/10 text-white/60" };

  function isItemVisible(item: NavItem): boolean {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.internalOnly && isFranchiseManager && !isSuperAdmin) return false;
    return true;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-[#1e1b4b] text-white shadow-2xl">
        {/* Brand */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-purple text-base font-black shadow-lg">K</div>
            <div>
              <p className="text-sm font-bold tracking-tight leading-none">KidzVenture</p>
              <p className="text-[10px] text-white/40 mt-0.5">ERP Platform</p>
            </div>
          </div>
        </div>

        {/* Role banner */}
        {isSuperAdmin && (
          <div className="mx-3 mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">⚡ Super Admin</p>
            <p className="text-[10px] text-yellow-300/60 mt-0.5">Full platform access</p>
          </div>
        )}
        {isEmployee && !isSuperAdmin && (
          <div className="mx-3 mt-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-3 py-2">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">👤 Employee</p>
            <p className="text-[10px] text-cyan-300/60 mt-0.5">Internal staff access</p>
          </div>
        )}
        {isFranchiseManager && !isSuperAdmin && (
          <div className="mx-3 mt-3 rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-2">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">🏢 Franchise</p>
            <p className="text-[10px] text-orange-300/60 mt-0.5">Franchise portal access</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-brand-purple text-white shadow-lg shadow-brand-purple/30"
                            : "text-white/60 hover:bg-white/8 hover:text-white/90"
                        }`
                      }
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-purple/40 text-sm font-bold">
              {user?.full_name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{user?.full_name}</p>
              <p className="truncate text-xs text-white/40 mt-0.5">{user?.email}</p>
              <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadge.cls}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
