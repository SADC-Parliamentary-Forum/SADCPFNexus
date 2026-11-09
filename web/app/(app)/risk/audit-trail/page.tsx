"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { riskApi, type RiskHistory } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { LabelledChangeRows } from "@/components/ui/LabelledRecord";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  { value: "",                 label: "risk.auditTrail.allEventTypes" },
  { value: "created",          label: "risk.auditTrail.event.created" },
  { value: "updated",          label: "risk.auditTrail.event.updated" },
  { value: "submitted",        label: "risk.analytics.status.submitted" },
  { value: "reviewed",         label: "risk.analytics.status.reviewed" },
  { value: "approved",         label: "risk.analytics.status.approved" },
  { value: "escalated",        label: "risk.analytics.status.escalated" },
  { value: "closed",           label: "risk.analytics.status.closed" },
  { value: "archived",         label: "risk.analytics.status.archived" },
  { value: "reopened",         label: "risk.auditTrail.event.reopened" },
  { value: "action_added",     label: "risk.auditTrail.event.actionAdded" },
  { value: "action_completed", label: "risk.auditTrail.event.actionCompleted" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface Filters {
  date_from: string;
  date_to: string;
  change_type: string;
  page: number;
}

export default function RiskAuditTrailPage() {
  const { t } = useI18n();
  const eventLabel = (type: string): string => {
    const key = CHANGE_TYPE_OPTIONS.find((o) => o.value === type)?.label;
    return key ? t(key) : type.replace(/_/g, " ");
  };
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
      { key: "time",        header: t("risk.auditTrail.time") },
      { key: "risk_code",   header: t("risk.auditTrail.riskCode") },
      { key: "change_type", header: t("risk.auditTrail.event") },
      { key: "actor",       header: t("risk.auditTrail.actor") },
      { key: "from_status", header: t("risk.auditTrail.fromStatus") },
      { key: "to_status",   header: t("risk.auditTrail.toStatus") },
      { key: "hash",        header: t("risk.auditTrail.hash") },
    ]);
  }

  function fmt(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const hasActiveFilters = filters.date_from || filters.date_to || filters.change_type;

  return (
    <RiskPageFrame>
      {/* Header */}
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("risk.auditTrail.pageTitle")}
        subtitle={t("risk.auditTrail.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.auditTrail.title" }]} />}
      />
        <button onClick={handleExport} disabled={!events.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <span className="material-symbols-outlined text-[16px]">download</span>
          {t("risk.analytics.exportCsv")}
        </button>
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="risk-audit-trail-date-from" className="block text-xs text-neutral-500 mb-1">{t("risk.auditTrail.dateFrom")}</label>
          <input id="risk-audit-trail-date-from"
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilter("date_from", e.target.value)}
            className="form-input text-sm h-9 w-40"
          />
        </div>
        <div>
          <label htmlFor="risk-audit-trail-date-to" className="block text-xs text-neutral-500 mb-1">{t("risk.auditTrail.dateTo")}</label>
          <input id="risk-audit-trail-date-to"
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilter("date_to", e.target.value)}
            className="form-input text-sm h-9 w-40"
          />
        </div>
        <div>
          <label htmlFor="risk-audit-trail-event-type" className="block text-xs text-neutral-500 mb-1">{t("risk.auditTrail.eventType")}</label>
          <select id="risk-audit-trail-event-type"
            value={filters.change_type}
            onChange={(e) => setFilter("change_type", e.target.value)}
            className="form-input text-sm h-9 w-44"
          >
            {CHANGE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.label)}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-secondary text-sm h-9 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">close</span>
            {t("risk.auditTrail.clear")}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-neutral-500">
          {t("risk.auditTrail.totalRecords")} <span className="font-semibold text-neutral-800">{total.toLocaleString()}</span>
        </p>
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          {t("risk.auditTrail.hashEnabled")}
        </div>
      </div>

      {/* Event log table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            {t("risk.auditTrail.loading")}
          </div>
        ) : events.length === 0 ? (
          <EmptyState icon="history" title={t("risk.auditTrail.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("risk.auditTrail.time")}</th>
                <th>{t("risk.auditTrail.risk")}</th>
                <th>{t("risk.auditTrail.event")}</th>
                <th>{t("risk.auditTrail.actor")}</th>
                <th>{t("risk.auditTrail.statusChange")}</th>
                <th className="font-mono">{t("risk.auditTrail.hash")}</th>
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
                          className="font-mono text-xs text-primary"
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
                        <span className="text-xs text-neutral-700 capitalize">{eventLabel(event.change_type)}</span>
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
            {t("common.previous")}
          </button>
          <span className="text-sm text-neutral-500">
            {t("common.pageOf", { page: filters.page, total: lastPage })}
          </span>
          <button
            disabled={filters.page >= lastPage}
            onClick={() => setFilter("page", filters.page + 1)}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
          >
            {t("common.next")}
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="card p-5 space-y-4 border-primary/30 border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800">{t("risk.auditTrail.detail")}</h2>
            <button onClick={() => setSelected(null)} aria-label={t("risk.auditTrail.closeDetail")} className="text-neutral-400 hover:text-neutral-600">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">{t("risk.auditTrail.actor")}</p>
              <p className="font-medium text-neutral-800">{selected.actor?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">{t("risk.auditTrail.timestamp")}</p>
              <p className="font-medium text-neutral-800">{fmt(selected.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">{t("risk.auditTrail.event")}</p>
              <p className="font-medium text-neutral-800 capitalize">{eventLabel(selected.change_type)}</p>
            </div>
          </div>

          {selected.hash && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">{t("risk.auditTrail.sha256")}</p>
              <p className="font-mono text-xs text-neutral-700 break-all bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                {selected.hash}
              </p>
            </div>
          )}

          {(selected.old_values || selected.new_values) && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">{t("risk.auditTrail.changeRows")}</p>
              <LabelledChangeRows oldValues={selected.old_values} newValues={selected.new_values} />
            </div>
          )}
        </div>
      )}
    </RiskPageFrame>
  );
}
