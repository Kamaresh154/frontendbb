import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AttendanceListResponse,
  AttendanceSummary,
  Center,
  StudentListResponse,
} from "@kidzventure/shared-types";
import { api } from "../api/client";

export default function AttendancePage() {
  const [orgId, setOrgId] = useState("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState("");
  const [students, setStudents] = useState<StudentListResponse["items"]>([]);
  const [records, setRecords] = useState<AttendanceListResponse | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [studentId, setStudentId] = useState("");

  const load = useCallback(async () => {
    if (!centerId) return;
    const today = new Date().toISOString().slice(0, 10);
    const [list, sum] = await Promise.all([
      api.get<AttendanceListResponse>("/attendance", {
        params: { center_id: centerId, on_date: today, page_size: 50 },
      }),
      api.get<AttendanceSummary>("/attendance/summary", {
        params: { center_id: centerId, on_date: today },
      }),
    ]);
    setRecords(list.data);
    setSummary(sum.data);
  }, [centerId]);

  useEffect(() => {
    api.get<{ id: string }>("/organizations/me").then(async (r) => {
      setOrgId(r.data.id);
      const c = await api.get<Center[]>(`/organizations/${r.data.id}/centers`);
      setCenters(c.data);
      if (c.data[0]) setCenterId(c.data[0].id);
    });
    api.get<StudentListResponse>("/students", { params: { page_size: 100 } }).then((r) =>
      setStudents(r.data.items)
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(e: FormEvent) {
    e.preventDefault();
    await api.post("/attendance/check-in", {
      center_id: centerId,
      student_id: studentId,
      method: "manual",
    });
    setStudentId("");
    load();
  }

  async function checkOut(recordId: string) {
    await api.post(`/attendance/${recordId}/check-out`, {});
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-slate-500">Check-in / check-out for today</p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Present today" value={summary.present} />
          <Stat label="Checked out" value={summary.checked_out} />
          <Stat label="Still in" value={summary.still_in} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select
          value={centerId}
          onChange={(e) => setCenterId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <form onSubmit={checkIn} className="flex flex-1 flex-wrap gap-2">
          <select
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select student to check in</option>
            {students
              .filter((s) => s.center_id === centerId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
          </select>
          <button type="submit" className="rounded-lg bg-brand-purple px-4 py-2 text-sm text-white">
            Check in
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Check in</th>
              <th className="px-4 py-3 text-left">Check out</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {records?.items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.student_name ?? r.student_id}</td>
                <td className="px-4 py-3">{new Date(r.check_in_at).toLocaleTimeString()}</td>
                <td className="px-4 py-3">
                  {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.check_out_at && (
                    <button
                      type="button"
                      onClick={() => checkOut(r.id)}
                      className="text-brand-cyan hover:underline"
                    >
                      Check out
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orgId && null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
