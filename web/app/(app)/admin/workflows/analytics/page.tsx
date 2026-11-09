"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type StageStat = {
  step_index: number;
  stage_type: string;
  avg_hours: number | null;
  task_count: number;
  overdue_count: number;
};

type AnalyticsSummary = {
  window_since: string;
  completed_count: number;
  avg_cycle_hours: number;
  median_cycle_hours: number;
  stage_cycle_times: StageStat[];
  bottlenecks: StageStat[];
  overdue_rate: number;
  return_rate: number;
  reject_rate: number;
  delegation_usage: number;
  exceptions_held: number;
  self_approved_count: number;
  acting_authority_approvals: number;
  note: string;
};

function asStageStats(value: unknown): StageStat[] {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      step_index: Number((row as StageStat).step_index ?? 0),
      stage_type: String((row as StageStat).stage_type ?? "unknown"),
      avg_hours:
        (row as StageStat).avg_hours === null || (row as StageStat).avg_hours === undefined
          ? null
          : Number((row as StageStat).avg_hours),
      task_count: Number((row as StageStat).task_count ?? 0),
      overdue_count: Number((row as StageStat).overdue_count ?? 0),
    }));
  }
  if (value && typeof value === "object") {
    return asStageStats(Object.values(value));
  }
  return [];
}

function normalizeAnalyticsSummary(raw: Record<string, unknown>): AnalyticsSummary {
  return {
    window_since: String(raw.window_since ?? new Date().toISOString()),
    completed_count: Number(raw.completed_count ?? 0),
    avg_cycle_hours: Number(raw.avg_cycle_hours ?? 0),
    median_cycle_hours: Number(raw.median_cycle_hours ?? 0),
    stage_cycle_times: asStageStats(raw.stage_cycle_times),
    bottlenecks: asStageStats(raw.bottlenecks ?? raw.stage_cycle_times),
    overdue_rate: Number(raw.overdue_rate ?? 0),
    return_rate: Number(raw.return_rate ?? 0),
    reject_rate: Number(raw.reject_rate ?? 0),
    delegation_usage: Number(raw.delegation_usage ?? 0),
    exceptions_held: Number(raw.exceptions_held ?? 0),
    self_approved_count: Number(raw.self_approved_count ?? 0),
    acting_authority_approvals: Number(raw.acting_authority_approvals ?? 0),
    note: String(raw.note ?? ""),
  };
}

function MetricCard({
  label,
  value,
  suffix,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneClass = {
    neutral: "text-neutral-900 dark:text-neutral-100",
    good: "text-green-600 dark:text-green-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
  }[tone];

  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-neutral-400">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</div> : null}
    </div>
  );
}

function rateTone(rate: number): "good" | "warn" | "bad" {
  if (rate <= 10) return "good";
  if (rate <= 25) return "warn";
  return "bad";
}

export default function WorkflowAnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    workflowEngineApi
      .analytics()
      .then((res) => {
        const payload = res.data?.data;
        if (!payload || typeof payload !== "object") {
          throw new Error(t("admin.workflows.analytics.emptyResponse"));
        }
        setData(normalizeAnalyticsSummary(payload as Record<string, unknown>));
      })
      .catch((err: unknown) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("admin.workflows.analytics.loadFailed");
        setData(null);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const bottlenecks = data?.bottlenecks ?? [];
  const stageCycleTimes = data?.stage_cycle_times ?? [];
  const maxBottleneckHours = Math.max(1, ...bottlenecks.map((b) => b.avg_hours ?? 0));

  return (
    <div className="w-full min-w-0 space-y-5" data-testid="workflow-analytics-page">
      <ModulePageHeader
        title={t("admin.workflows.analytics.title")}
        subtitle={t("admin.workflows.analytics.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.workflows"), href: "/admin/workflows" },
              { label: t("admin.workflows.analytics.crumb") },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            {t("workflows.simulate.back")}
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      ) : error || !data ? (
        <div className="card space-y-3 p-6 text-sm text-neutral-600">
          <p>{error ?? t("admin.workflows.analytics.loadFailed")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={load}>
              {t("admin.workflows.analytics.reload")}
            </button>
            <Link href="/admin/workflows" className="btn-secondary text-sm">
              {t("workflows.simulate.back")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("admin.workflows.analytics.windowSince", { date: new Date(data.window_since).toLocaleDateString() })} · {data.note || t("admin.workflows.analytics.defaultNote")}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label={t("admin.workflows.analytics.completed")} value={data.completed_count} />
            <MetricCard label={t("admin.workflows.analytics.avgCycle")} value={data.avg_cycle_hours} suffix={t("admin.workflows.analytics.hrs")} />
            <MetricCard label={t("admin.workflows.analytics.medianCycle")} value={data.median_cycle_hours} suffix={t("admin.workflows.analytics.hrs")} />
            <MetricCard
              label={t("admin.workflows.analytics.overdueRate")}
              value={data.overdue_rate}
              suffix="%"
              tone={rateTone(data.overdue_rate)}
              hint={t("admin.workflows.analytics.overdueHint")}
            />
            <MetricCard
              label={t("admin.workflows.analytics.returnRate")}
              value={data.return_rate}
              suffix="%"
              tone={rateTone(data.return_rate)}
              hint={t("admin.workflows.analytics.returnHint")}
            />
            <MetricCard
              label={t("admin.workflows.analytics.rejectRate")}
              value={data.reject_rate}
              suffix="%"
              tone={rateTone(data.reject_rate)}
            />
            <MetricCard label={t("admin.workflows.analytics.delegation")} value={data.delegation_usage} hint={t("admin.workflows.analytics.delegationHint")} />
            <MetricCard
              label={t("admin.workflows.analytics.exceptions")}
              value={data.exceptions_held}
              tone={data.exceptions_held > 0 ? "warn" : "good"}
              hint={t("admin.workflows.analytics.exceptionsHint")}
            />
            <MetricCard
              label={t("admin.workflows.analytics.selfAuthorised")}
              value={data.self_approved_count}
              tone={data.self_approved_count > 0 ? "warn" : "neutral"}
              hint={t("admin.workflows.analytics.selfAuthorisedHint")}
            />
            <MetricCard
              label={t("admin.workflows.analytics.acting")}
              value={data.acting_authority_approvals}
              hint={t("admin.workflows.analytics.actingHint")}
            />
          </div>

          <FormSection title={t("admin.workflows.analytics.bottlenecks")} icon="hourglass_top">
            {bottlenecks.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("admin.workflows.analytics.noActivity")}</p>
            ) : (
              <div className="space-y-2">
                {bottlenecks.map((stage, i) => (
                  <div key={`${stage.step_index}-${stage.stage_type}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {t("admin.workflows.analytics.stepN", { n: stage.step_index + 1 })} · {stage.stage_type}
                      </span>
                      <span className="tabular-nums text-neutral-500">
                        {t("admin.workflows.analytics.hrsAvg", { hours: (stage.avg_hours ?? 0).toFixed(1) })} ·{" "}
                        {t(stage.task_count === 1 ? "admin.workflows.analytics.taskOne" : "admin.workflows.analytics.taskMany", { count: stage.task_count })}
                        {stage.overdue_count > 0 ? (
                          <span className="ml-2 text-rose-600 dark:text-rose-400">{t("admin.workflows.analytics.overdueN", { count: stage.overdue_count })}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, ((stage.avg_hours ?? 0) / maxBottleneckHours) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title={t("admin.workflows.analytics.stageCycle")} icon="timeline">
            {stageCycleTimes.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("admin.workflows.analytics.noActivity")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left dark:bg-neutral-900/50">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("admin.workflows.analytics.colStep")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.workflows.analytics.colStageType")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.workflows.analytics.colAvgHours")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.workflows.analytics.colTasks")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.workflows.analytics.colOverdue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageCycleTimes.map((stage, i) => (
                      <tr key={`${stage.step_index}-${stage.stage_type}-${i}`} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="px-3 py-2 tabular-nums">{stage.step_index + 1}</td>
                        <td className="px-3 py-2 capitalize">{stage.stage_type}</td>
                        <td className="px-3 py-2 tabular-nums">{(stage.avg_hours ?? 0).toFixed(1)}</td>
                        <td className="px-3 py-2 tabular-nums">{stage.task_count}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {stage.overdue_count > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">{stage.overdue_count}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>
        </>
      )}
    </div>
  );
}
