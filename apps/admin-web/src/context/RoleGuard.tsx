import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

// Roles in the system — only super_admin, employee, franchise_manager
export type AppRole = "super_admin" | "employee" | "franchise_manager";

interface RoleGuardProps {
  roles: AppRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({ roles, fallback = null, children }: RoleGuardProps) {
  const { user } = useAuth();
  const userRoles = (user?.roles ?? []) as AppRole[];
  const allowed = userRoles.some((r) => roles.includes(r));
  return <>{allowed ? children : fallback}</>;
}

export function useRole() {
  const { user } = useAuth();
  const roles = (user?.roles ?? []) as AppRole[];

  return {
    isSuperAdmin:       roles.includes("super_admin"),
    isEmployee:         roles.includes("employee"),
    isFranchiseManager: roles.includes("franchise_manager"),
    // Legacy aliases used in other pages — super_admin is the only "admin"
    isAdmin:            roles.includes("super_admin"),
    isAdminOrEmployee:  roles.includes("super_admin") || roles.includes("employee"),
    hasRole: (role: AppRole) => roles.includes(role),
    roles,
  };
}
