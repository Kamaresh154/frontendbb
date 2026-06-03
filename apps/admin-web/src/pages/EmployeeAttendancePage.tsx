import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import { getEmployees, getAttendanceForDate, getMyTodayAttendance, upsertAttendance, type AttendanceLogEntry, type LocalEmployee } from "../lib/store";
import { api } from "../api/client";

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, isEmployee } = useRole();
  const canManage = isAdmin || isSuperAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState<LocalEmployee[]>([]);
  const [records, setRecords] = useState<AttendanceLogEntry[]>([]);
  const [myRecord, setMyRecord] = useState<AttendanceLogEntry | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = () => {
    setStaff(getEmployees().filter((e) => e.status === "active"));
    setRecords(getAttendanceForDate(date));
    if (user?.id) setMyRecord(getMyTodayAttendance(user.id));
  };

  useEffect(() => {
    reload();
    window.addEventListener("kv-store-update", reload);
    return () => window.removeEventListener("kv-store-update", reload);
  }, [date, user?.id]);

  // Try to pull from API too
  useEffect(() => {
    setLoading(true);
    api.get<{ items: { id: string; full_name: string; status?: string; designation?: string | null; department?: string | null; basic_salary?: number; employee_code?: string | null; date_of_joining?: string | null }[] }>("/payroll/staff")
      .then((r) => {
        // Merge API staff that aren't already in local store
        const local = getEmployees();
        const localIds = new Set(local.map((e) => e.id));
        r.data.items.filter((a) => !localIds.has(a.id)).forEach(() => {}); // already handled by syncEmployeesFromAPI in EmployeesPage
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selfLogin = () => {
    if (!user) return;
    const rec = upsertAttendance({
      employee_id: user.id, employee_name: user.full_name ?? "Employee",
      date: today, check_in: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "present", recorded_by: user.full_name,
    });
    setMyRecord(rec);
  };

  const selfLogout = () => {
    if (!user || !myRecord) return;
    const rec = upsertAttendance({ ...myRecord, check_out: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) });
    setMyRecord(rec);
  };

  const checkIn = (emp: LocalEmployee) => {
    upsertAttendance({
      employee_id: emp.id, employee_name: emp.full_name, date,
      check_in: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "present", recorded_by: user?.full_name,
    });
  };

  const checkOut = (rec: AttendanceLogEntry) => {
    upsertAttendance({ ...rec, check_out: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) });
  };

  const markAbsent = (emp: LocalEmployee) => {
    upsertAttendance({ employee_id: emp.id, employee_name: emp.full_name, date, check_in: "—", status: "absent", recorded_by: user?.full_name });
  };

  const notMarked = staff.filter((s) => !records.find((r) => r.employee_id === s.id));
  const present   = records.filter((r) => r.status === "present").length;
  const absent    = records.filter((r) => r.status === "absent").length;
  const checkedOut= records.filter((r) => r.check_out && r.status === "present").length;

  return (
    <div className="p-8 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Attendance</h1>
          <p className="text-sm text-slate-500">{canManage ? "Track daily check-in / check-out for all staff" : "Your daily attendance"}</p>
        </div>
        {canManage && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
        )}
      </div>

      {/* Employee self login */}
      {isEmployee && !canManage && (
        <div className="rounded-2xl border-2 border-brand-purple/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-1">My Attendance</h2>
          <p className="text-sm text-slate-500 mb-5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          {!myRecord ? (
            <div className="flex items-center gap-4">
              <button type="button" onClick={selfLogin}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-green-700 transition">
                🟢 Login / Check In
              </button>
              <p className="text-sm text-slate-400">You have not checked in today</p>
            </div>
          ) : !myRecord.check_out ? (
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm">
                <span className="font-bold text-green-700">✅ Checked In</span>
                <span className="ml-2 font-mono text-green-600">{myRecord.check_in}</span>
              </div>
              <button type="button" onClick={selfLogout}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-red-700 transition">
                🔴 Logout / Check Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-slate-50 border px-5 py-3 text-sm space-x-5">
                <span>Check In: <span className="font-mono font-bold text-slate-700">{myRecord.check_in}</span></span>
                <span>Check Out: <span className="font-mono font-bold text-slate-700">{myRecord.check_out}</span></span>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">✔ Done for today</span>
            </div>
          )}
          {myRecord && (
            <div className="mt-5 rounded-xl bg-white ring-1 ring-slate-100 overflow-hidden">
              <div className="border-b bg-slate-50 px-4 py-2"><p className="text-xs font-bold text-slate-500 uppercase">Today's Log</p></div>
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Check In</th><th className="px-4 py-2 text-left">Check Out</th><th className="px-4 py-2 text-left">Status</th></tr></thead>
                <tbody><tr>
                  <td className="px-4 py-3 font-medium">{myRecord.employee_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{myRecord.check_in}</td>
                  <td className="px-4 py-3 font-mono text-xs">{myRecord.check_out ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${myRecord.check_out ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{myRecord.check_out ? "Completed" : "Present"}</span></td>
                </tr></tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Admin / Super Admin full management */}
      {canManage && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Staff", value: staff.length, color: "ring-slate-200 bg-slate-50" },
              { label: "Present",     value: present,      color: "ring-green-200 bg-green-50" },
              { label: "Absent",      value: absent,       color: "ring-red-200 bg-red-50" },
              { label: "Checked Out", value: checkedOut,   color: "ring-blue-200 bg-blue-50" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-2xl p-5 ring-1 ${color} shadow-sm`}>
                <p className="text-3xl font-bold text-slate-900">{value}</p>
                <p className="text-sm text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Not marked */}
            {notMarked.length > 0 && (
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-slate-50 px-5 py-3">
                  <p className="font-semibold text-slate-700">Not Marked ({notMarked.length})</p>
                </div>
                <div className="divide-y">
                  {notMarked.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{s.full_name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.full_name}</p>
                        <p className="text-xs text-slate-400">{s.designation || "—"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => checkIn(s)} className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200">✓ Check In</button>
                        <button type="button" onClick={() => markAbsent(s)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">✗ Absent</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance log */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-3">
                <p className="font-semibold text-slate-700">
                  Attendance — {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                </p>
              </div>
              {loading && records.length === 0 ? (
                <p className="p-6 text-slate-400 text-sm text-center">Loading…</p>
              ) : records.length === 0 ? (
                <p className="p-8 text-center text-slate-400 text-sm">No attendance records for this date</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-white text-xs uppercase text-slate-400 border-b">
                    <tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">In</th><th className="px-4 py-3 text-left">Out</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{r.employee_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.check_in}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.check_out ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "present" ? "bg-green-100 text-green-700" : r.status === "absent" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === "present" && !r.check_out && (
                            <button type="button" onClick={() => checkOut(r)} className="text-xs text-brand-purple hover:underline font-medium">Check Out</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
