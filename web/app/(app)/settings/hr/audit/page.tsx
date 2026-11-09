"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hrSettingsApi } from "@/lib/api";
import { LabelledChangeRows } from "@/components/ui/LabelledRecord";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t, localeTag } = useI18n();
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
      <HrSettingsHeader
        title={t("settings.hr.home.audit.title")}
        subtitle={t("settings.hr.home.audit.description")}
      />

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {isLoading ? t("common.loading") : isError ? t("settings.hr.audit.failedToLoad") : t("settings.hr.audit.events", { count: logs.length })}
          </p>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            {t("settings.hr.audit.readOnly")}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">error_outline</span>
            <p className="mt-2 text-sm text-neutral-500">{t("settings.hr.audit.loadFailed")}</p>
            <p className="text-xs text-neutral-400 mt-1">{t("settings.hr.audit.loadFailedHint")}</p>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title={t("settings.hr.audit.emptyTitle")}
            description={t("settings.hr.audit.emptyDescription")}
          />
        ) : (
          <>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t("settings.hr.audit.dateTime")}</th>
                  <th>{t("settings.hr.audit.event")}</th>
                  <th>{t("settings.hr.audit.changedBy")}</th>
                  <th>{t("settings.hr.audit.record")}</th>
                  <th>{t("settings.hr.audit.changes")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => (
                  <tr key={log.id ?? i}>
                    <td>
                      <span className="text-sm text-neutral-700 whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString(localeTag, {
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
                          {log.user?.name ?? log.causer?.name ?? t("assignments.detail.system")}
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
                      <div className="max-w-md">
                        <LabelledChangeRows oldValues={log.old_values} newValues={log.new_values} />
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
                  {t("settings.hr.audit.page", { page })}
                  {meta?.total && ` · ${t("settings.hr.audit.totalEvents", { count: meta.total })}`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={logs.length < perPage}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    {t("common.next")}
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
