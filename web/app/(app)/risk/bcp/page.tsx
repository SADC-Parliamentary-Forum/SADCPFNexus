"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  assetsApi,
  riskApi,
  type AssetInsurancePolicy,
  type AssetInsurancePolicyLite,
  type Risk,
  type RiskBcpExercise,
  type RiskBcpLink,
  type RiskDependency,
} from "@/lib/api";
import { TableEmpty, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

/** Translated label for an enum value, falling back to the raw value when no key exists. */
function enumLabel(t: (key: string) => string, prefix: string, value: string | null | undefined): string {
  if (!value) return "—";
  const key = `${prefix}.${value}`;
  const label = t(key);
  return label === key ? value : label;
}

function riskOptionLabel(risk: Pick<Risk, "id" | "risk_code" | "title">): string {
  const code = risk.risk_code?.trim();
  const title = risk.title?.trim();
  if (code && title) return `${code} — ${title}`;
  return code || title || String(risk.id);
}

function policyOptionLabel(policy: Pick<AssetInsurancePolicy, "id" | "policy_number" | "insurer_name">): string {
  const number = policy.policy_number?.trim();
  const insurer = policy.insurer_name?.trim();
  if (number && insurer) return `${number} — ${insurer}`;
  return number || insurer || String(policy.id);
}

export default function RiskBcpPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [riskId, setRiskId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [linkType, setLinkType] = useState<"bcp_note" | "insurance_policy">("bcp_note");
  const [policyId, setPolicyId] = useState("");
  const [relatedRiskId, setRelatedRiskId] = useState("");
  const [exerciseTitle, setExerciseTitle] = useState("");
  const [exerciseAt, setExerciseAt] = useState("");
  const [exerciseType, setExerciseType] = useState("tabletop");

  const linksQuery = useQuery({
    queryKey: ["risk", "bcp-links"],
    queryFn: () => riskApi.listBcpLinks().then((r) => r.data.data ?? []),
  });
  const depsQuery = useQuery({
    queryKey: ["risk", "dependencies"],
    queryFn: () => riskApi.listRiskDependencies().then((r) => r.data.data ?? []),
  });
  const exercisesQuery = useQuery({
    queryKey: ["risk", "bcp-exercises"],
    queryFn: () => riskApi.listBcpExercises().then((r) => r.data.data ?? []),
  });
  const renewalsQuery = useQuery({
    queryKey: ["risk", "insurance-renewals"],
    queryFn: () => riskApi.listInsuranceRenewals({ within_days: 120 }).then((r) => r.data.data ?? []),
  });
  const risksQuery = useQuery({
    queryKey: ["risk", "register", "picker"],
    queryFn: () => riskApi.list({ per_page: 100 }).then((r) => r.data.data ?? []),
  });
  const policiesQuery = useQuery({
    queryKey: ["assets", "insurance-policies"],
    queryFn: () => assetsApi.insurancePolicies({ per_page: 100 }).then((r) => r.data.data ?? []),
  });

  const createLink = useMutation({
    mutationFn: () =>
      riskApi.createBcpLink({
        risk_id: Number(riskId),
        link_type: linkType,
        title,
        notes: notes || null,
        asset_insurance_policy_id: policyId ? Number(policyId) : null,
      }),
    onSuccess: () => {
      setError(null);
      setTitle("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["risk", "bcp-links"] });
      toast.success(t("risk.bcp.linkCreated"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.bcp.linkCreateFailed"));
      setError(message);
      toast.error(t("risk.bcp.linkNotCreated"), message);
    },
  });

  const createDep = useMutation({
    mutationFn: () =>
      riskApi.createRiskDependency({
        risk_id: Number(riskId),
        related_risk_id: Number(relatedRiskId),
        relation_type: "depends_on",
      }),
    onSuccess: () => {
      setError(null);
      setRelatedRiskId("");
      qc.invalidateQueries({ queryKey: ["risk", "dependencies"] });
      toast.success(t("risk.bcp.depLinked"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.bcp.depLinkFailed"));
      setError(message);
      toast.error(t("risk.bcp.depNotLinked"), message);
    },
  });

  const createExercise = useMutation({
    mutationFn: () =>
      riskApi.createBcpExercise({
        risk_id: riskId ? Number(riskId) : null,
        title: exerciseTitle,
        scheduled_at: exerciseAt || null,
        exercise_type: exerciseType,
      }),
    onSuccess: () => {
      setError(null);
      setExerciseTitle("");
      qc.invalidateQueries({ queryKey: ["risk", "bcp-exercises"] });
      toast.success(t("risk.bcp.exerciseScheduled"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.bcp.exerciseScheduleFailed"));
      setError(message);
      toast.error(t("risk.bcp.exerciseNotScheduled"), message);
    },
  });

  const completeExercise = useMutation({
    mutationFn: (id: number) =>
      riskApi.completeBcpExercise(id, { result: "pass", outcome_notes: "Completed via ops UI" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk", "bcp-exercises"] });
      toast.success(t("risk.bcp.exerciseCompleted"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.bcp.exerciseCompleteFailed"));
      setError(message);
      toast.error(t("risk.bcp.exerciseNotCompleted"), message);
    },
  });

  const renewPolicy = useMutation({
    mutationFn: (policy: AssetInsurancePolicyLite) => {
      const nextFrom = new Date(policy.effective_to);
      nextFrom.setDate(nextFrom.getDate() + 1);
      const nextTo = new Date(nextFrom);
      nextTo.setFullYear(nextTo.getFullYear() + 1);
      return riskApi.renewInsurancePolicy(policy.id, {
        effective_from: nextFrom.toISOString().slice(0, 10),
        effective_to: nextTo.toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["risk", "insurance-renewals"] });
      toast.success(t("risk.bcp.policyRenewed"));
    },
    onError: (err) => {
      const message = apiErrorMessage(err, t("risk.bcp.policyRenewFailed"));
      setError(message);
      toast.error(t("risk.bcp.policyNotRenewed"), message);
    },
  });

  const links = (linksQuery.data ?? []) as RiskBcpLink[];
  const deps = (depsQuery.data ?? []) as RiskDependency[];
  const exercises = (exercisesQuery.data ?? []) as RiskBcpExercise[];
  const renewals = (renewalsQuery.data ?? []) as AssetInsurancePolicyLite[];
  const risks = (risksQuery.data ?? []) as Risk[];
  const policies = (policiesQuery.data ?? []) as AssetInsurancePolicy[];

  return (
    <RiskPageFrame>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="risk.bcp.pageTitle"
        subtitle="risk.bcp.pageSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.bcp.title" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/assets/insurance" className="btn-secondary">
            {t("risk.bcp.faInsurance")}
          </Link>
          <Link href="/risk/control-testing" className="btn-secondary">
            {t("risk.testing.title")}
          </Link>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createLink.mutate();
        }}
        className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <label htmlFor="risk-bcp-risk-id-setriskid-e-target-value" className="space-y-1">
          <span className="text-sm font-medium">{t("risk.bcp.risk")}</span>
          <select
            id="risk-bcp-risk-id-setriskid-e-target-value"
            className="input w-full"
            required
            value={riskId}
            data-testid="bcp-risk-select"
            onChange={(e) => setRiskId(e.target.value)}
          >
            <option value="">{t("risk.kri.none")}</option>
            {risks.map((risk) => (
              <option key={risk.id} value={String(risk.id)}>
                {riskOptionLabel(risk)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="risk-bcp-link-type-setlinktype-e-target-value-as-typeof-l" className="space-y-1">
          <span className="text-sm font-medium">{t("risk.bcp.linkType")}</span>
          <select id="risk-bcp-link-type-setlinktype-e-target-value-as-typeof-l" className="input w-full" value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)}>
            <option value="bcp_note">{t("risk.bcp.linkType.bcp_note")}</option>
            <option value="insurance_policy">{t("risk.bcp.linkType.insurance_policy")}</option>
          </select>
        </label>
        <label htmlFor="risk-bcp-title-settitle-e-target-value" className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">{t("risk.common.title")}</span>
          <input id="risk-bcp-title-settitle-e-target-value" className="input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label htmlFor="risk-bcp-notes-setnotes-e-target-value" className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">{t("risk.common.notes")}</span>
          <textarea id="risk-bcp-notes-setnotes-e-target-value" className="input w-full min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {linkType === "insurance_policy" && (
          <label htmlFor="risk-bcp-asset-insurance-policy-id-setpolicyid-e-target-v" className="space-y-1">
            <span className="text-sm font-medium">{t("risk.bcp.policy")}</span>
            <select
              id="risk-bcp-asset-insurance-policy-id-setpolicyid-e-target-v"
              className="input w-full"
              required
              value={policyId}
              data-testid="bcp-policy-select"
              onChange={(e) => setPolicyId(e.target.value)}
            >
              <option value="">{t("risk.kri.none")}</option>
              {policies.map((policy) => (
                <option key={policy.id} value={String(policy.id)}>
                  {policyOptionLabel(policy)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={createLink.isPending}>
            {t("risk.bcp.addLink")}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">{t("risk.bcp.risk")}</th>
              <th className="px-3 py-2">{t("risk.common.type")}</th>
              <th className="px-3 py-2">{t("risk.common.title")}</th>
              <th className="px-3 py-2">{t("risk.bcp.colInsurance")}</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{l.risk?.risk_code ?? l.risk_id}</td>
                <td className="px-3 py-2">{enumLabel(t, "risk.bcp.linkType", l.link_type)}</td>
                <td className="px-3 py-2">{l.title}</td>
                <td className="px-3 py-2">{l.insurance_policy?.policy_number ?? "—"}</td>
              </tr>
            ))}
            {links.length === 0 && (
              <TableEmpty colSpan={4} title="risk.bcp.noLinks" />
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">{t("risk.bcp.exercises")}</h2>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createExercise.mutate();
          }}
          className="grid gap-3 md:grid-cols-4"
        >
          <label htmlFor="risk-bcp-title-setexercisetitle-e-target-value" className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">{t("risk.common.title")}</span>
            <input id="risk-bcp-title-setexercisetitle-e-target-value" className="input w-full" required value={exerciseTitle} onChange={(e) => setExerciseTitle(e.target.value)} />
          </label>
          <label htmlFor="risk-bcp-type-setexercisetype-e-target-value-tabletop-dri" className="space-y-1">
            <span className="text-sm font-medium">{t("risk.common.type")}</span>
            <select id="risk-bcp-type-setexercisetype-e-target-value-tabletop-dri" className="input w-full" value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}>
              <option value="tabletop">{t("risk.bcp.exerciseType.tabletop")}</option>
              <option value="drill">{t("risk.bcp.exerciseType.drill")}</option>
              <option value="full">{t("risk.bcp.exerciseType.full")}</option>
            </select>
          </label>
          <label htmlFor="risk-bcp-scheduled-setexerciseat-e-target-value" className="space-y-1">
            <span className="text-sm font-medium">{t("risk.bcp.scheduled")}</span>
            <input id="risk-bcp-scheduled-setexerciseat-e-target-value" className="input w-full" type="datetime-local" value={exerciseAt} onChange={(e) => setExerciseAt(e.target.value)} />
          </label>
          <div className="md:col-span-4">
            <button type="submit" className="btn-primary" disabled={createExercise.isPending}>
              {t("risk.bcp.scheduleExercise")}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">{t("risk.common.title")}</th>
                <th className="px-3 py-2">{t("risk.common.type")}</th>
                <th className="px-3 py-2">{t("risk.common.status")}</th>
                <th className="px-3 py-2">{t("risk.common.result")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{ex.title}</td>
                  <td className="px-3 py-2">{enumLabel(t, "risk.bcp.exerciseType", ex.exercise_type)}</td>
                  <td className="px-3 py-2">{ex.status}</td>
                  <td className="px-3 py-2">{ex.result ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {ex.status !== "completed" && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => completeExercise.mutate(ex.id)}>
                        {t("risk.common.complete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {exercises.length === 0 && (
                <TableEmpty colSpan={5} title="risk.bcp.noExercises" />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">{t("risk.bcp.renewalsDue")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">{t("risk.bcp.colPolicy")}</th>
                <th className="px-3 py-2">{t("assets.insurance.insurer")}</th>
                <th className="px-3 py-2">{t("assets.insurance.effectiveTo")}</th>
                <th className="px-3 py-2">{t("risk.common.status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {renewals.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{p.policy_number}</td>
                  <td className="px-3 py-2">{p.insurer_name}</td>
                  <td className="px-3 py-2">{String(p.effective_to).slice(0, 10)}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 text-right">
                    {p.status === "active" && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => renewPolicy.mutate(p)}>
                        {t("risk.bcp.renew")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {renewals.length === 0 && (
                <TableEmpty colSpan={5} title="risk.bcp.noRenewals" />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createDep.mutate();
        }}
        className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-3 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h2 className="md:col-span-3 text-lg font-semibold">{t("risk.bcp.interdependency")}</h2>
        <label htmlFor="risk-bcp-risk-a-depends-setriskid-e-target-value" className="space-y-1">
          <span className="text-sm font-medium">{t("risk.bcp.riskA")}</span>
          <select
            id="risk-bcp-risk-a-depends-setriskid-e-target-value"
            className="input w-full"
            required
            value={riskId}
            data-testid="bcp-risk-a-select"
            onChange={(e) => setRiskId(e.target.value)}
          >
            <option value="">{t("risk.kri.none")}</option>
            {risks.map((risk) => (
              <option key={risk.id} value={String(risk.id)}>
                {riskOptionLabel(risk)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="risk-bcp-risk-b-dependency-setrelatedriskid-e-target-valu" className="space-y-1">
          <span className="text-sm font-medium">{t("risk.bcp.riskB")}</span>
          <select
            id="risk-bcp-risk-b-dependency-setrelatedriskid-e-target-valu"
            className="input w-full"
            required
            value={relatedRiskId}
            data-testid="bcp-risk-b-select"
            onChange={(e) => setRelatedRiskId(e.target.value)}
          >
            <option value="">{t("risk.kri.none")}</option>
            {risks.map((risk) => (
              <option key={risk.id} value={String(risk.id)}>
                {riskOptionLabel(risk)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary" disabled={createDep.isPending}>
            {t("risk.bcp.linkDependency")}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">{t("risk.bcp.risk")}</th>
              <th className="px-3 py-2">{t("risk.bcp.relation")}</th>
              <th className="px-3 py-2">{t("risk.common.relatedRisk")}</th>
            </tr>
          </thead>
          <tbody>
            {deps.map((d) => (
              <tr key={d.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{d.risk?.risk_code ?? d.risk_id}</td>
                <td className="px-3 py-2">{d.relation_type}</td>
                <td className="px-3 py-2">{d.related_risk?.risk_code ?? d.related_risk_id}</td>
              </tr>
            ))}
            {deps.length === 0 && (
              <TableEmpty colSpan={3} title="risk.bcp.noDeps" />
            )}
          </tbody>
        </table>
      </div>
    </RiskPageFrame>
  );
}
