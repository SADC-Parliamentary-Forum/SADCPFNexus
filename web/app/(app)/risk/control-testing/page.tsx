"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { riskApi, type RiskControlOption, type RiskControlTestingCampaign, type RiskControlTestingItem } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

export default function RiskControlTestingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [controlIds, setControlIds] = useState<number[]>([]);
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ["risk", "control-testing"],
    queryFn: () => riskApi.listControlTestingCampaigns().then((r) => r.data.data ?? []),
  });

  const controlsQuery = useQuery({
    queryKey: ["risk", "controls"],
    queryFn: () => riskApi.listControls({ per_page: 100 }).then((r) => r.data.data ?? []),
  });

  const detailQuery = useQuery({
    queryKey: ["risk", "control-testing", selectedId],
    queryFn: () => riskApi.getControlTestingCampaign(selectedId!).then((r) => r.data.data),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: () =>
      riskApi.createControlTestingCampaign({
        title,
        scheduled_end: scheduledEnd || null,
        control_ids: controlIds,
      }),
    onSuccess: () => {
      setError(null);
      setTitle("");
      setControlIds([]);
      qc.invalidateQueries({ queryKey: ["risk", "control-testing"] });
      toast.success(t("risk.testing.campaignCreated"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.testing.campaignCreateFailed"));
      setError(message);
      toast.error(t("risk.testing.campaignNotCreated"), message);
    },
  });

  const complete = useMutation({
    mutationFn: ({ id, result }: { id: number; result: "pass" | "fail" | "waive" }) =>
      riskApi.completeControlTestItem(id, { result, checklist_notes: "Completed via UI" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk", "control-testing"] });
      toast.success(t("risk.testing.testCompleted"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.testing.testCompleteFailed"));
      setError(message);
      toast.error(t("risk.testing.testNotCompleted"), message);
    },
  });

  const markOverdue = useMutation({
    mutationFn: () => riskApi.markControlTestsOverdue(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk", "control-testing"] });
      toast.success(t("risk.testing.overdueMarked"));
    },
    onError: (err) => {
      toast.error(t("risk.testing.overdueNotMarked"), apiErrorMessage(err, t("risk.common.tryAgain")));
    },
  });

  const campaigns = (campaignsQuery.data ?? []) as RiskControlTestingCampaign[];
  const controls = (controlsQuery.data ?? []) as RiskControlOption[];
  const detail = detailQuery.data as (RiskControlTestingCampaign & { items?: RiskControlTestingItem[] }) | undefined;

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <RiskPageFrame>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="risk.testing.pageTitle"
        subtitle="risk.testing.pageSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.testing.title" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/risk/kri" className="btn-secondary">
            {t("risk.testing.kriAlerts")}
          </Link>
          <button type="button" className="btn-secondary" onClick={() => markOverdue.mutate()} disabled={markOverdue.isPending}>
            {t("risk.testing.refreshOverdue")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onCreate} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-4">
        <label htmlFor="risk-control-testing-campaign-title-settitle-e-target-value" className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">{t("risk.testing.campaignTitle")}</span>
          <input id="risk-control-testing-campaign-title-settitle-e-target-value" className="input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label htmlFor="risk-control-testing-due-end-date-setscheduledend-e-target-value" className="space-y-1">
          <span className="text-sm font-medium">{t("risk.testing.dueEndDate")}</span>
          <input id="risk-control-testing-due-end-date-setscheduledend-e-target-value" type="date" className="input w-full" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
        </label>
        <fieldset className="space-y-1 md:col-span-4" data-testid="testing-controls">
          <legend className="text-sm font-medium">{t("risk.testing.controls")}</legend>
          <div className="mt-2 max-h-48 overflow-auto space-y-1 rounded border border-neutral-200 p-2">
            {controls.map((control) => (
              <label
                key={control.id}
                className="flex items-center gap-2 text-sm"
                data-testid={`testing-control-${control.id}`}
              >
                <input
                  type="checkbox"
                  checked={controlIds.includes(control.id)}
                  onChange={(e) =>
                    setControlIds((cur) =>
                      e.target.checked ? [...cur, control.id] : cur.filter((id) => id !== control.id),
                    )
                  }
                />
                <span className="font-mono text-xs">{control.control_code}</span>
                <span>{control.title}</span>
              </label>
            ))}
            {controls.length === 0 && (
              <p className="text-sm text-neutral-500">{t("risk.testing.none")}</p>
            )}
          </div>
        </fieldset>
        <div className="md:col-span-4">
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? t("risk.testing.creating") : t("risk.testing.createCampaign")}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">{t("risk.testing.colCampaign")}</th>
              <th className="px-3 py-2 font-medium">{t("risk.common.status")}</th>
              <th className="px-3 py-2 font-medium">{t("risk.testing.colItems")}</th>
              <th className="px-3 py-2 font-medium">{t("risk.common.overdue")}</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">{c.campaign_code}</div>
                </td>
                <td className="px-3 py-3">{c.status}</td>
                <td className="px-3 py-3">{c.items_count ?? c.items?.length ?? "—"}</td>
                <td className="px-3 py-3">{c.overdue_items_count ?? 0}</td>
                <td className="px-3 py-3 text-right">
                  <button type="button" className="btn-secondary" onClick={() => setSelectedId(c.id)}>
                    {t("common.open")}
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <TableEmpty colSpan={5} title="risk.testing.noCampaigns" />
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">{t("risk.testing.colControl")}</th>
                  <th className="px-3 py-2">{t("risk.common.due")}</th>
                  <th className="px-3 py-2">{t("risk.common.status")}</th>
                  <th className="px-3 py-2">{t("risk.common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      {item.control?.control_code ?? item.control_id} — {item.control?.title}
                    </td>
                    <td className="px-3 py-2">{item.due_at ?? "—"}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      {["pending", "in_progress", "overdue"].includes(item.status) && (
                        <div className="flex gap-1">
                          <button type="button" className="btn-primary" onClick={() => complete.mutate({ id: item.id, result: "pass" })}>
                            {t("risk.testing.pass")}
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => complete.mutate({ id: item.id, result: "fail" })}>
                            {t("risk.testing.fail")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </RiskPageFrame>
  );
}
