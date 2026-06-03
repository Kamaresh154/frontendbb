import { Navigate } from "react-router-dom";
// Public registration is disabled — all accounts are created by Admin via User Management
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
