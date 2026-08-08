"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";

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
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    workflowEngineApi
      .analytics()
      .then((res) => setData(res.data.data as unknown as AnalyticsSummary))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const maxBottleneckHours = Math.max(1, ...(data?.bottlenecks ?? []).map((b) => b.avg_hours ?? 0));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="Workflow Analytics"
        subtitle="Cycle time, bottlenecks, overdue work, return rates, delegation usage, and exceptions."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Workflows", href: "/admin/workflows" },
              { label: "Analytics" },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            Back to workflows
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
        <div className="card p-6 text-sm text-neutral-500">Could not load workflow analytics.</div>
      ) : (
        <>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Window since {new Date(data.window_since).toLocaleDateString()} · {data.note}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Completed requests" value={data.completed_count} />
            <MetricCard label="Avg cycle time" value={data.avg_cycle_hours} suffix="hrs" />
            <MetricCard label="Median cycle time" value={data.median_cycle_hours} suffix="hrs" />
            <MetricCard
              label="Overdue rate"
              value={data.overdue_rate}
              suffix="%"
              tone={rateTone(data.overdue_rate)}
              hint="Share of step-tasks completed or still open past their SLA."
            />
            <MetricCard
              label="Return rate"
              value={data.return_rate}
              suffix="%"
              tone={rateTone(data.return_rate)}
              hint="Share of decisions that returned the request for correction."
            />
            <MetricCard
              label="Reject rate"
              value={data.reject_rate}
              suffix="%"
              tone={rateTone(data.reject_rate)}
            />
            <MetricCard label="Delegation usage" value={data.delegation_usage} hint="Steps delegated to another user." />
            <MetricCard
              label="Exceptions held"
              value={data.exceptions_held}
              tone={data.exceptions_held > 0 ? "warn" : "good"}
              hint="Requests currently on hold (governance/SLA exception)."
            />
            <MetricCard
              label="Self-authorised"
              value={data.self_approved_count}
              tone={data.self_approved_count > 0 ? "warn" : "neutral"}
              hint="Decisions where the approver was also the applicant (PRD §10)."
            />
            <MetricCard
              label="Acting-authority approvals"
              value={data.acting_authority_approvals}
              hint="Decisions made under an acting appointment rather than the substantive holder."
            />
          </div>

          <FormSection title="Bottlenecks — slowest stages" icon="hourglass_top">
            {data.bottlenecks.length === 0 ? (
              <p className="text-sm text-neutral-500">No stage activity in this window.</p>
            ) : (
              <div className="space-y-2">
                {data.bottlenecks.map((stage, i) => (
                  <div key={`${stage.step_index}-${stage.stage_type}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        Step {stage.step_index + 1} · {stage.stage_type}
                      </span>
                      <span className="tabular-nums text-neutral-500">
                        {(stage.avg_hours ?? 0).toFixed(1)} hrs avg · {stage.task_count} task
                        {stage.task_count === 1 ? "" : "s"}
                        {stage.overdue_count > 0 ? (
                          <span className="ml-2 text-rose-600 dark:text-rose-400">{stage.overdue_count} overdue</span>
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

          <FormSection title="Stage cycle times — all stages" icon="timeline">
            {data.stage_cycle_times.length === 0 ? (
              <p className="text-sm text-neutral-500">No stage activity in this window.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left dark:bg-neutral-900/50">
                    <tr>
                      <th className="px-3 py-2 font-medium">Step</th>
                      <th className="px-3 py-2 font-medium">Stage type</th>
                      <th className="px-3 py-2 font-medium">Avg hours</th>
                      <th className="px-3 py-2 font-medium">Tasks</th>
                      <th className="px-3 py-2 font-medium">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stage_cycle_times.map((stage, i) => (
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
