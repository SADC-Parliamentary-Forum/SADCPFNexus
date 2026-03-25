"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hrSettingsApi } from "@/lib/api";

function truncateJson(val: unknown, maxLen = 80): string {
  if (val === null || val === undefined) return "—";
  const str = typeof val === "string" ? val : JSON.stringify(val);
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

function EventBadge({ event }: { event: string }) {
  const colorMap: Record<string, string> = {
    created: "bg-green-50 text-green-700",
    updated: "bg-blue-50 text-blue-700",
    deleted: "bg-red-50 text-red-700",
    archived: "bg-neutral-100 text-neutral-600",
  };
  const key = Object.keys(colorMap).find((k) => event.toLowerCase().includes(k)) ?? "";
  const cls = colorMap[key] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {event}
    </span>
  );
}

export default function HrSettingsAuditPage() {
  const [page, setPage] = useState(1);
  const perPage = 25;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hr-settings", "audit", page],
    queryFn: () =>
      hrSettingsApi.listHrSettingsAudit({ page, per_page: perPage }).then((r) => r.data),
    retry: 1,
  });

  const logs: any[] = data?.data ?? [];
  const meta = data?.meta ?? data?.pagination ?? null;
  const totalPages = meta?.last_page ?? (logs.length === perPage ? page + 1 : page);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <a href="/settings/hr" className="hover:text-primary">HR Administration</a>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">Settings Audit Log</span>
        </div>
        <h1 className="page-title">Settings Audit Log</h1>
        <p className="page-subtitle">Immutable history of every change made to HR master data, with before/after values.</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {isLoading ? "Loading…" : isError ? "Failed to load" : `${logs.length} events`}
          </p>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            Read-only — no changes allowed
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">error_outline</span>
            <p className="mt-2 text-sm text-neutral-500">Unable to load audit log. The endpoint may not be available yet.</p>
            <p className="text-xs text-neutral-400 mt-1">Check that /admin/audit-logs is accessible.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">receipt_long</span>
            <p className="mt-2 text-sm text-neutral-500">No HR settings changes recorded yet.</p>
            <p className="text-xs text-neutral-400 mt-1">Changes to contract types, leave profiles, and other settings will appear here.</p>
          </div>
        ) : (
          <>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Event</th>
                  <th>Changed By</th>
                  <th>Record</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => (
                  <tr key={log.id ?? i}>
                    <td>
                      <span className="text-sm text-neutral-700 whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString("en-NA", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <EventBadge event={log.event ?? "unknown"} />
                    </td>
                    <td>
                      <div>
                        <p className="text-sm text-neutral-900">
                          {log.user?.name ?? log.causer?.name ?? "System"}
                        </p>
                        {(log.user?.email ?? log.causer?.email) && (
                          <p className="text-xs text-neutral-400">
                            {log.user?.email ?? log.causer?.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="text-sm text-neutral-700 font-medium">
                          {log.auditable_type?.split("\\").pop() ?? log.subject_type?.split("\\").pop() ?? "—"}
                        </p>
                        {log.auditable_id && (
                          <p className="text-xs text-neutral-400">#{log.auditable_id}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="max-w-xs">
                        {log.new_values && Object.keys(log.new_values).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(log.new_values)
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <p key={k} className="text-xs text-neutral-600">
                                  <span className="font-medium text-neutral-500">{k}:</span>{" "}
                                  <span className="font-mono">{truncateJson(v, 40)}</span>
                                </p>
                              ))}
                            {Object.keys(log.new_values).length > 3 && (
                              <p className="text-xs text-neutral-400">
                                +{Object.keys(log.new_values).length - 3} more fields
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {(page > 1 || logs.length === perPage) && (
              <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  Page {page}
                  {meta?.total && ` · ${meta.total} total events`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={logs.length < perPage}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
