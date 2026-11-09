"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Schedule = {
  id: number;
  name: string;
  code?: string;
  is_default: boolean;
  working_days: number[];
  start_time: string;
  end_time: string;
  lunch_start?: string;
  lunch_end?: string;
  ordinary_hours_per_day: number;
};

export default function WorkSchedulesPage() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [expected, setExpected] = useState<{ expected_hours: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Schedule[] }>("/hr/timesheets/schedules");
      setSchedules((res.data as any).data ?? []);
      const monday = mondayOf(new Date());
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const exp = await api.get<{ data: { expected_hours: number } }>(
        `/hr/timesheets/expected-hours?week_start=${fmt(monday)}&week_end=${fmt(sunday)}`
      );
      setExpected((exp.data as any).data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("hr.timesheets.schedules.loadFailed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="hr.timesheets.schedules.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "hr.timesheets.schedules.title" }]} />}
      />
        <Link href="/hr/timesheets" className="btn-secondary text-sm py-1 px-2">
          {t("nav.timesheets")}
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      {expected && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm text-[var(--text-secondary)]">{t("hr.timesheets.schedules.expectedThisWeek")}</div>
          <div className="text-3xl font-semibold">{expected.expected_hours}</div>
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState
          icon="calendar_clock"
          title={t("hr.timesheets.schedules.empty")}
          description={t("hr.timesheets.schedules.emptyHint")}
        />
      ) : (
      <ul className="space-y-3">
        {schedules.map((s) => (
          <li key={s.id} className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {s.name} {s.is_default ? <span className="text-xs text-[var(--text-secondary)]">{t("hr.timesheets.schedules.default")}</span> : null}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">{t("hr.timesheets.schedules.perDay", { hours: s.ordinary_hours_per_day })}</div>
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
              {s.lunch_start ? t("hr.timesheets.schedules.lunch", { start: s.lunch_start.slice(0, 5), end: s.lunch_end?.slice(0, 5) ?? "" }) : ""}
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
