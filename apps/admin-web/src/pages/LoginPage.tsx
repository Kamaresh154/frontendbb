import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, loading, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
  console.log("LOGIN ERROR:", err?.response?.data);

  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") {
    setError(detail);
  } else {
    setError(JSON.stringify(err?.response?.data));
  }
} finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#1e1b4b]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12">
        <div className="max-w-sm text-center">
          <div className="mb-8 flex h-20 w-20 mx-auto items-center justify-center rounded-3xl bg-brand-purple text-4xl font-black text-white shadow-2xl shadow-brand-purple/40">K</div>
          <h1 className="text-4xl font-black text-white tracking-tight">KidzVenture</h1>
          <p className="mt-3 text-white/40 text-lg">Enterprise Resource Platform</p>
          <div className="mt-12 space-y-3 text-left">
            {[
              { icon: "👥", text: "Employee Management & Attendance" },
              { icon: "📞", text: "Live Tele Calling with Mic Recording" },
              { icon: "📦", text: "Product Catalogue & Order Management" },
              { icon: "🏢", text: "Franchise Management & Invoicing" },
              { icon: "💰", text: "Payroll & Salary Payslips" },
              { icon: "🔐", text: "Role-based User Management" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/8 text-sm">{icon}</span>
                <span className="text-white/60 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 lg:hidden text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-purple text-2xl font-black text-white">K</div>
            <h1 className="text-2xl font-black text-slate-900">KidzVenture ERP</h1>
          </div>

          {/* Session expired banner */}
          {sessionExpired && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3.5">
              <span className="text-lg mt-0.5">⏱</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Session expired</p>
                <p className="text-xs text-amber-600 mt-0.5">Your session has expired or the server was restarted. Please sign in again.</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Sign In</h2>
            <p className="mt-1 text-sm text-slate-500">Admin & Franchise Manager access</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <span className="text-base">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@demo.kidzventure.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="mt-2 w-full rounded-xl bg-brand-purple py-3 font-semibold text-white shadow-lg shadow-brand-purple/25 transition hover:bg-violet-700 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </span>
                ) : "Sign in"}
              </button>
            </form>


          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Contact your administrator to get access
          </p>
        </div>
      </div>
    </div>
  );
}
