"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { riskApi, type RiskHistory } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";

// ── Config ────────────────────────────────────────────────────────────────────

const CHANGE_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  created:          { icon: "add_circle",     color: "text-primary"    },
  updated:          { icon: "edit",           color: "text-neutral-500" },
  submitted:        { icon: "send",           color: "text-amber-600"  },
  reviewed:         { icon: "rate_review",    color: "text-blue-600"   },
  approved:         { icon: "check_circle",   color: "text-green-600"  },
  escalated:        { icon: "warning",        color: "text-red-600"    },
  closed:           { icon: "lock",           color: "text-neutral-600" },
  archived:         { icon: "archive",        color: "text-neutral-400" },
  reopened:         { icon: "refresh",        color: "text-teal-600"   },
  action_added:     { icon: "add_task",       color: "text-primary"    },
  action_completed: { icon: "task_alt",       color: "text-green-600"  },
};

const CHANGE_TYPE_OPTIONS = [
  { value: "",               label: "All event types"  },
  { value: "created",        label: "Created"          },
  { value: "updated",        label: "Updated"          },
  { value: "submitted",      label: "Submitted"        },
  { value: "reviewed",       label: "Reviewed"         },
  { value: "approved",       label: "Approved"         },
  { value: "escalated",      label: "Escalated"        },
  { value: "closed",         label: "Closed"           },
  { value: "archived",       label: "Archived"         },
  { value: "reopened",       label: "Reopened"         },
  { value: "action_added",   label: "Action Added"     },
  { value: "action_completed",label: "Action Completed"},
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface Filters {
  date_from: string;
  date_to: string;
  change_type: string;
  page: number;
}

export default function RiskAuditTrailPage() {
  const [filters, setFilters] = useState<Filters>({
    date_from: "", date_to: "", change_type: "", page: 1,
  });
  const [selected, setSelected] = useState<RiskHistory | null>(null);

  const params: Record<string, string | number> = { per_page: 25, page: filters.page };
  if (filters.date_from)   params.date_from   = filters.date_from;
  if (filters.date_to)     params.date_to     = filters.date_to;
  if (filters.change_type) params.change_type = filters.change_type;

  const { data, isLoading } = useQuery({
    queryKey: ["risk", "audit-trail", params],
    queryFn:  () => riskApi.getAuditTrail(params).then((r) => r.data),
    staleTime: 30_000,
  });

  const events: RiskHistory[] = (data as any)?.data ?? [];
  const total     = (data as any)?.total ?? 0;
  const lastPage  = (data as any)?.last_page ?? 1;

  function setFilter(key: keyof Filters, value: string | number) {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? (value as number) : 1 }));
    setSelected(null);
  }

  function clearFilters() {
    setFilters({ date_from: "", date_to: "", change_type: "", page: 1 });
    setSelected(null);
  }

  function handleExport() {
    if (!events.length) return;
    exportToCsv("risk-audit-trail", events.map((e) => ({
      time:        e.created_at,
      risk_code:   e.risk?.risk_code ?? "",
      change_type: e.change_type,
      actor:       e.actor?.name ?? "",
      from_status: e.old_values?.status ?? "",
      to_status:   e.new_values?.status ?? "",
      hash:        e.hash ?? "",
    })), [
      { key: "time",        header: "Time"        },
      { key: "risk_code",   header: "Risk Code"   },
      { key: "change_type", header: "Event"       },
      { key: "actor",       header: "Actor"       },
      { key: "from_status", header: "From Status" },
      { key: "to_status",   header: "To Status"   },
      { key: "hash",        header: "Hash"        },
    ]);
  }

  function fmt(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const hasActiveFilters = filters.date_from || filters.date_to || filters.change_type;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Risk Audit Trail</h1>
          <p className="page-subtitle">Tamper-evident ledger of all risk register events.</p>
        </div>
        <button onClick={handleExport} disabled={!events.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Date From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilter("date_from", e.target.value)}
            className="form-input text-sm h-9 w-40"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Date To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilter("date_to", e.target.value)}
            className="form-input text-sm h-9 w-40"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Event Type</label>
          <select
            value={filters.change_type}
            onChange={(e) => setFilter("change_type", e.target.value)}
            className="form-input text-sm h-9 w-44"
          >
            {CHANGE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-secondary text-sm h-9 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-neutral-500">
          Total Records: <span className="font-semibold text-neutral-800">{total.toLocaleString()}</span>
        </p>
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          Hash verification enabled
        </div>
      </div>

      {/* Event log table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-10 text-center text-neutral-400 text-sm">No events found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Risk</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Status Change</th>
                <th className="font-mono">Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const ct    = CHANGE_TYPE_ICONS[event.change_type] ?? { icon: "history", color: "text-neutral-400" };
                const isSelected = selected?.id === event.id;
                return (
                  <tr
                    key={event.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-neutral-50"}`}
                    onClick={() => setSelected(isSelected ? null : event)}
                  >
                    <td className="text-xs text-neutral-500 whitespace-nowrap">{fmt(event.created_at)}</td>
                    <td>
                      {event.risk ? (
                        <Link
                          href={`/risk/${event.risk_id}`}
                          className="text-xs font-mono text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {event.risk.risk_code}
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-[14px] ${ct.color}`}>{ct.icon}</span>
                        <span className="text-xs text-neutral-700 capitalize">{event.change_type.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="text-xs text-neutral-700">{event.actor?.name ?? "—"}</td>
                    <td className="text-xs text-neutral-500">
                      {event.old_values?.status && event.new_values?.status
                        ? <span><span className="capitalize">{String(event.old_values.status)}</span>{" → "}<span className="capitalize font-medium text-neutral-800">{String(event.new_values.status)}</span></span>
                        : event.new_values?.status
                        ? <span className="capitalize font-medium text-neutral-800">{String(event.new_values.status)}</span>
                        : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="font-mono text-[11px] text-neutral-400">
                      {event.hash ? event.hash.substring(0, 12) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between px-1">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilter("page", filters.page - 1)}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page <span className="font-semibold text-neutral-800">{filters.page}</span> of{" "}
            <span className="font-semibold text-neutral-800">{lastPage}</span>
          </span>
          <button
            disabled={filters.page >= lastPage}
            onClick={() => setFilter("page", filters.page + 1)}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
          >
            Next
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="card p-5 space-y-4 border-primary/30 border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800">Event Detail</h2>
            <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Actor</p>
              <p className="font-medium text-neutral-800">{selected.actor?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Timestamp</p>
              <p className="font-medium text-neutral-800">{fmt(selected.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Event</p>
              <p className="font-medium text-neutral-800 capitalize">{selected.change_type.replace(/_/g, " ")}</p>
            </div>
          </div>

          {selected.hash && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">SHA-256 Hash</p>
              <p className="font-mono text-xs text-neutral-700 break-all bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                {selected.hash}
              </p>
            </div>
          )}

          {(selected.old_values || selected.new_values) && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">Change Payload</p>
              <pre className="text-xs text-neutral-700 bg-neutral-50 rounded-lg p-3 border border-neutral-200 overflow-x-auto">
                {JSON.stringify({ old: selected.old_values, new: selected.new_values }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
