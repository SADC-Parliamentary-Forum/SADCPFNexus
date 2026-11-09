"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeReportingCalendar } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

export default function MandeCalendarPage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "calendar", month],
    queryFn: () => mandeApi.getCalendar({ month }).then((r) => r.data.data as MeReportingCalendar),
    staleTime: 15_000,
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const overdueInMonth = useMemo(() => {
    if (!data) return 0;
    const now = Date.now();
    return data.items.filter(
      (i) =>
        new Date(i.report_due_at).getTime() < now &&
        (i.review_status === "not_submitted" || i.review_status === "returned")
    ).length;
  }, [data]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.calendar.title")}
        subtitle={t("mande.calendar.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.calendar.title") }]} />}
      />
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => shiftMonth(-1)}>{t("common.previous")}</button>
          <input
            type="month"
            className="input text-sm"
            aria-label={t("mande.calendar.month")}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button type="button" className="btn-secondary text-sm" onClick={() => shiftMonth(1)}>{t("common.next")}</button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.calendar.loadFailed")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card px-4 py-4">
          <p className="text-2xl font-bold">{data?.items.length ?? "—"}</p>
          <p className="text-[11px] text-neutral-500">{t("mande.calendar.dueThisMonth")}</p>
        </div>
        <div className="card px-4 py-4">
          <p className="text-2xl font-bold text-red-600">{data?.overdue_count ?? "—"}</p>
          <p className="text-[11px] text-neutral-500">
            {t("mande.calendar.overdueOverall")} {overdueInMonth > 0 ? t("mande.calendar.inView", { count: overdueInMonth }) : ""}
          </p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar_month" title={t("mande.calendar.empty")} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("mande.col.due")}</th>
                <th>{t("correspondence.col.reference")}</th>
                <th>{t("mande.col.title")}</th>
                <th>{t("correspondence.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const overdue =
                  new Date(item.report_due_at).getTime() < Date.now() &&
                  (item.review_status === "not_submitted" || item.review_status === "returned");
                return (
                  <tr key={item.id} className={overdue ? "bg-red-50/60" : undefined}>
                    <td className="text-xs whitespace-nowrap">{formatDateShort(item.report_due_at)}</td>
                    <td className="font-mono text-xs">
                      <Link href={`/mande/activity-reports/${item.id}`} className="btn-secondary text-xs py-1 px-2">
                        {item.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm">{item.activity_title}</td>
                    <td className="text-xs">{reviewStatusLabel(t, item.review_status)}{overdue ? ` · ${t("mande.calendar.overdue")}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
