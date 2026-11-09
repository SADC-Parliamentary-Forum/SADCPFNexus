"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decisionsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function DecisionsDashboardPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [promoteErr, setPromoteErr] = useState<string | null>(null);
  const [riskMsg, setRiskMsg] = useState<string | null>(null);
  const [riskErr, setRiskErr] = useState<string | null>(null);
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const [packErr, setPackErr] = useState<string | null>(null);
  const [minutesId, setMinutesId] = useState("");
  const [minutesMsg, setMinutesMsg] = useState<string | null>(null);
  const [minutesErr, setMinutesErr] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "dashboard"],
    queryFn: async () => (await decisionsApi.dashboard()).data.data,
  });

  const minutes = useQuery({
    queryKey: ["decisions", "minutes-options"],
    queryFn: async () => (await decisionsApi.listMinutesOptions()).data.data,
  });

  const promote = useMutation({
    mutationFn: () => decisionsApi.promoteWeeklyAssignments(),
    onSuccess: (res) => {
      const row = res.data.data;
      setPromoteErr(null);
      setPromoteMsg(
        t("decisions.dashboard.promotedAssignments", { promoted: row.promoted, skipped: row.skipped }),
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setPromoteMsg(null);
      setPromoteErr(t("decisions.dashboard.promoteAssignmentsFailed"));
    },
  });

  const promoteRisks = useMutation({
    mutationFn: () => decisionsApi.promoteRisks(),
    onSuccess: (res) => {
      const row = res.data.data;
      setRiskErr(null);
      setRiskMsg(
        t("decisions.dashboard.promotedRisks", { promoted: row.promoted, skipped: row.skipped }),
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: () => {
      setRiskMsg(null);
      setRiskErr(t("decisions.dashboard.promoteRisksFailed"));
    },
  });

  const promotePack = useMutation({
    mutationFn: () => decisionsApi.promoteMeetingPack(),
    onSuccess: (res) => {
      const row = res.data.data;
      setPackErr(null);
      setPackMsg(
        t("decisions.dashboard.promotedPack", { assignments: row.assignments.promoted, risks: row.risks.promoted }),
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setPackMsg(null);
      setPackErr(t("decisions.dashboard.promotePackFailed"));
    },
  });

  const promoteMinutes = useMutation({
    mutationFn: () => decisionsApi.promoteFromMinutes(Number(minutesId)),
    onSuccess: (res) => {
      const row = res.data.data;
      setMinutesErr(null);
      setMinutesMsg(
        t("decisions.dashboard.promotedMinutes", { id: row.meeting_minutes_id, assignments: row.assignments.promoted, risks: row.risks.promoted }),
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setMinutesMsg(null);
      setMinutesErr(t("decisions.dashboard.promoteMinutesFailed"));
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="decisions.dashboard.title"
        subtitle="decisions.dashboard.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "decisions.crumb.governance", href: "/governance" },
              { label: "decisions.register.title", href: "/decisions" },
              { label: "nav.dashboard" },
            ]}
          />
        }
        actions={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={promote.isPending}
              onClick={() => promote.mutate()}
            >
              {promote.isPending ? t("decisions.dashboard.promoting") : t("decisions.dashboard.promoteAssignments")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={promoteRisks.isPending}
              onClick={() => promoteRisks.mutate()}
            >
              {promoteRisks.isPending ? t("decisions.dashboard.promoting") : t("decisions.dashboard.promoteRisks")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              data-testid="promote-meeting-pack"
              disabled={promotePack.isPending}
              onClick={() => promotePack.mutate()}
            >
              {promotePack.isPending ? t("decisions.dashboard.promoting") : t("decisions.dashboard.promotePack")}
            </button>
            <Link href="/decisions/create" className="btn-primary text-sm">
              {t("decisions.new")}
            </Link>
          </>
        }
      />

      <FormSection title="decisions.dashboard.fromMinutes" icon="meeting_room">
        <form
          className="flex flex-wrap items-end gap-3"
          data-testid="promote-from-minutes"
          onSubmit={(e) => {
            e.preventDefault();
            if (minutesId) promoteMinutes.mutate();
          }}
        >
          <FormField label="decisions.dashboard.minutes" htmlFor="dashboard-minutes" className="min-w-[16rem]">
            <select
              id="dashboard-minutes"
              className="form-input"
              value={minutesId}
              onChange={(e) => setMinutesId(e.target.value)}
            >
              <option value="">{t("decisions.dashboard.selectMinutes")}</option>
              {(minutes.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.meeting_date ? ` · ${row.meeting_date}` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="btn-secondary" disabled={!minutesId || promoteMinutes.isPending}>
            {promoteMinutes.isPending ? t("decisions.dashboard.promoting") : t("decisions.dashboard.promoteMeeting")}
          </button>
        </form>
        <p className="mt-3 text-sm text-neutral-600">
          {t("decisions.dashboard.explainer")}
        </p>
        {promoteMsg && <p className="mt-2 text-sm text-green-700">{promoteMsg}</p>}
        {promoteErr && <p className="mt-2 text-sm text-red-600">{promoteErr}</p>}
        {riskMsg && <p className="mt-2 text-sm text-green-700">{riskMsg}</p>}
        {riskErr && <p className="mt-2 text-sm text-red-600">{riskErr}</p>}
        {packMsg && <p className="mt-2 text-sm text-green-700">{packMsg}</p>}
        {packErr && <p className="mt-2 text-sm text-red-600">{packErr}</p>}
        {minutesMsg && <p className="mt-2 text-sm text-green-700">{minutesMsg}</p>}
        {minutesErr && <p className="mt-2 text-sm text-red-600">{minutesErr}</p>}
      </FormSection>

      {isLoading && (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-red-600">{t("decisions.dashboard.loadFailed")}</p>}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("decisions.stat.total")} value={data.total} />
          <Stat label={t("decisions.stat.overdue")} value={data.overdue} />
          <Stat label={t("decisions.stat.openCritical")} value={data.open_critical_actions} />
          <Stat label={t("decisions.status.adopted")} value={data.by_status.adopted ?? 0} />
          <Stat label={t("decisions.status.inProgress")} value={data.by_status.in_progress ?? 0} />
          <Stat label={t("decisions.status.implemented")} value={data.by_status.implemented ?? 0} />
          <Stat label={t("decisions.status.draft")} value={data.by_status.draft ?? 0} />
          <Stat label={t("decisions.status.closed")} value={data.by_status.closed ?? 0} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
