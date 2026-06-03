import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useRole } from "./context/RoleGuard";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeAttendancePage from "./pages/EmployeeAttendancePage";
import TeleCallingPage from "./pages/TeleCallingPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ProductCataloguePage from "./pages/ProductCataloguePage";
import OrdersPage from "./pages/OrdersPage";
import InvoicesPage from "./pages/InvoicesPage";
import LedgerPage from "./pages/LedgerPage";
import PayrollPage from "./pages/PayrollPage";
import CrmPage from "./pages/CrmPage";
import ReportsPage from "./pages/ReportsPage";
import FranchisePage from "./pages/FranchisePage";
import UserManagementPage from "./pages/UserManagementPage";
import StudentsPage from "./pages/StudentsPage";
import ParentsPage from "./pages/ParentsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-purple border-t-transparent" />
          <p className="text-sm text-slate-400">Loading KidzVenture…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ children, allowed }: { children: React.ReactNode; allowed: boolean }) {
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isSuperAdmin, isEmployee } = useRole();

  // Access groups
  const notFranchise = isSuperAdmin || isEmployee;      // internal staff only

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />

        {/* Super Admin + Employee (internal staff only) */}
        <Route path="employees"  element={<RoleRoute allowed={notFranchise}><EmployeesPage /></RoleRoute>} />
        <Route path="attendance" element={<RoleRoute allowed={notFranchise}><EmployeeAttendancePage /></RoleRoute>} />
        <Route path="crm"        element={<RoleRoute allowed={notFranchise}><CrmPage /></RoleRoute>} />
        <Route path="students"   element={<RoleRoute allowed={notFranchise}><StudentsPage /></RoleRoute>} />
        <Route path="parents"    element={<RoleRoute allowed={notFranchise}><ParentsPage /></RoleRoute>} />
        <Route path="invoices"   element={<RoleRoute allowed={notFranchise}><InvoicesPage /></RoleRoute>} />

        {/* Super Admin ONLY */}
        <Route path="payroll"  element={<RoleRoute allowed={isSuperAdmin}><PayrollPage /></RoleRoute>} />
        <Route path="ledger"   element={<RoleRoute allowed={isSuperAdmin}><LedgerPage /></RoleRoute>} />
        <Route path="reports"  element={<RoleRoute allowed={isSuperAdmin}><ReportsPage /></RoleRoute>} />
        <Route path="franchise" element={<RoleRoute allowed={isSuperAdmin}><FranchisePage /></RoleRoute>} />
        <Route path="users"    element={<RoleRoute allowed={isSuperAdmin}><UserManagementPage /></RoleRoute>} />

        {/* Everyone (internal + franchise) */}
        <Route path="tele-calling"  element={<TeleCallingPage />} />
        <Route path="appointments"  element={<AppointmentsPage />} />
        <Route path="products"      element={<ProductCataloguePage />} />
        <Route path="orders"        element={<OrdersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
