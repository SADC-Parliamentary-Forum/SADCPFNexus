"use client";

import { useEffect, useState } from "react";
import { weeklySummaryApi, WeeklySummaryReport } from "@/lib/api";
import { formatDate, formatDateRelative } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  generated: "badge-muted",
  queued:    "badge-warning",
  sent:      "badge-success",
  failed:    "badge-danger",
  skipped:   "badge-muted",
};

const SCOPE_BADGE: Record<string, string> = {
  institution: "badge-primary",
  department:  "badge-warning",
  personal:    "badge-muted",
};

type SectionKey = "who_is_out" | "travel" | "leave" | "timesheets" | "assignments" | "approvals" | "personal";

export default function WeeklyReportsPage() {
  const [reports, setReports]     = useState<WeeklySummaryReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);
  const [selected, setSelected]   = useState<WeeklySummaryReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadReports = async (p = 1) => {
    setLoading(true);
    try {
      const res = await weeklySummaryApi.listReports({ page: p });
      const body = res.data as any;
      setReports(body.data ?? []);
      setLastPage(body.last_page ?? 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, []);

  const openReport = async (r: WeeklySummaryReport) => {
    if (r.payload) { setSelected(r); return; }
    setLoadingDetail(true);
    try {
      const res = await weeklySummaryApi.getReport(r.id);
      setSelected((res.data as any).data ?? res.data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const payload = selected?.payload as any;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Weekly Summary Reports</h1>
        <p className="page-subtitle">Your institutional summary emails — generated every Friday</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">
            No reports yet. Reports are generated every Friday at 16:00.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Sent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </td>
                  <td>
                    <span className={`badge ${SCOPE_BADGE[r.scope_type] ?? "badge-muted"}`}>
                      {r.scope_type}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-muted"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="text-neutral-500 text-xs">
                    {r.sent_at ? formatDateRelative(r.sent_at) : "—"}
                  </td>
                  <td>
                    <button
                      onClick={() => openReport(r)}
                      className="text-primary text-sm hover:underline flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {lastPage > 1 && (
          <div className="px-5 py-3 border-t border-neutral-100 flex gap-2 justify-end">
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); loadReports(Math.max(1, page - 1)); }} disabled={page <= 1} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">Prev</button>
            <span className="text-sm text-neutral-500 self-center">Page {page} / {lastPage}</span>
            <button onClick={() => { setPage(p => Math.min(lastPage, p + 1)); loadReports(Math.min(lastPage, page + 1)); }} disabled={page >= lastPage} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && payload && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="font-semibold text-neutral-900">
                  {formatDate(selected.period_start)} – {formatDate(selected.period_end)}
                </p>
                <p className="text-xs text-neutral-500 capitalize">{selected.scope_type} scope · {selected.status}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Highlights */}
              {payload.highlights?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Key Highlights</h3>
                  <ul className="list-disc pl-4 space-y-1">
                    {payload.highlights.map((h: string, i: number) => (
                      <li key={i} className="text-sm text-amber-900">{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Who is out */}
              {payload.who_is_out?.length > 0 && (
                <Section title="Who is Out / Away" icon="person_off" color="text-red-500">
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Department</th><th>Status</th><th>Location</th><th>Returns</th></tr></thead>
                    <tbody>
                      {payload.who_is_out.map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium">{p.name}</td>
                          <td>{p.department}</td>
                          <td>{p.status}</td>
                          <td>{p.location}</td>
                          <td>{p.return_date ? formatDate(p.return_date) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Travel */}
              <Section title="Travel & Missions" icon="flight" color="text-blue-500">
                <StatRow items={[
                  { label: "Active Missions",      value: payload.travel?.ongoing?.length ?? 0 },
                  { label: "Departing Next Week",  value: payload.travel?.next_week_departures?.length ?? 0 },
                  { label: "Approved This Week",   value: payload.travel?.approved_this_week ?? 0 },
                  { label: "Pending Approval",     value: payload.travel?.pending_count ?? 0 },
                ]} />
              </Section>

              {/* Leave */}
              <Section title="Leave" icon="event_busy" color="text-amber-500">
                <StatRow items={[
                  { label: "Approved",        value: payload.leave?.approved ?? 0 },
                  { label: "Pending",         value: payload.leave?.submitted ?? 0 },
                  { label: "Total This Week", value: payload.leave?.total ?? 0 },
                ]} />
              </Section>

              {/* Timesheets */}
              <Section title="Timesheets" icon="schedule" color="text-purple-500">
                <StatRow items={[
                  { label: "Submitted", value: payload.timesheets?.submitted ?? 0 },
                  { label: "Approved",  value: payload.timesheets?.approved ?? 0 },
                  { label: "Missing",   value: payload.timesheets?.missing ?? 0, warn: (payload.timesheets?.missing ?? 0) > 0 },
                ]} />
              </Section>

              {/* Assignments */}
              <Section title="Assignments & Tasks" icon="task_alt" color="text-emerald-500">
                <StatRow items={[
                  { label: "Completed",     value: payload.assignments?.completed_this_week ?? 0 },
                  { label: "Overdue",       value: payload.assignments?.overdue ?? 0, warn: (payload.assignments?.overdue ?? 0) > 0 },
                  { label: "Due Next Week", value: payload.assignments?.due_next_week ?? 0 },
                ]} />
              </Section>

              {/* Personal */}
              {payload.personal && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-green-800 uppercase tracking-wide mb-3">Your Personal Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-600 font-medium">Timesheet:</span>
                      {payload.personal.timesheet_submitted
                        ? <span className="badge badge-success">Submitted</span>
                        : <span className="badge badge-warning">Not submitted</span>}
                    </div>
                    {payload.personal.leave?.length > 0 && (
                      <div><span className="text-neutral-600 font-medium">Leave this week: </span>
                        {payload.personal.leave.map((l: any, i: number) => (
                          <span key={i}>{l.leave_type} ({l.status}){i < payload.personal.leave.length - 1 ? ", " : ""}</span>
                        ))}
                      </div>
                    )}
                    {payload.personal.travel?.length > 0 && (
                      <div><span className="text-neutral-600 font-medium">Travel: </span>
                        {payload.personal.travel.map((t: any, i: number) => (
                          <span key={i}>{t.purpose} → {t.destination_country} ({t.status}){i < payload.personal.travel.length - 1 ? ", " : ""}</span>
                        ))}
                      </div>
                    )}
                    {(payload.personal.pending_approvals ?? 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600 font-medium">Approvals pending from you:</span>
                        <span className="badge badge-warning">{payload.personal.pending_approvals}</span>
                      </div>
                    )}
                    {(payload.personal.overdue_tasks ?? 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-600 font-medium">Overdue tasks:</span>
                        <span className="badge badge-danger">{payload.personal.overdue_tasks}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-4xl animate-spin">progress_activity</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100">
        <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
        <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatRow({ items }: { items: { label: string; value: number; warn?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className={`flex-1 min-w-[80px] rounded-lg border p-3 text-center ${item.warn ? "bg-red-50 border-red-200" : "bg-neutral-50 border-neutral-200"}`}>
          <div className={`text-2xl font-bold ${item.warn ? "text-red-600" : "text-neutral-900"}`}>{item.value}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
