"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsApi, type AssetInsuranceClaim, type AssetInsurancePolicy } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetInsurancePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState<"policies" | "claims">("policies");
  const [policyForm, setPolicyForm] = useState({
    policy_number: "",
    insurer_name: "",
    coverage_type: "all_risk",
    effective_from: "",
    effective_to: "",
    sum_insured: "",
    premium_amount: "",
    notes: "",
  });
  const [claimForm, setClaimForm] = useState({
    policy_id: "",
    claim_number: "",
    incident_date: "",
    claim_amount: "",
    description: "",
    status: "draft",
  });
  const [error, setError] = useState<string | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["assets", "insurance", "policies"],
    queryFn: () => assetsApi.insurancePolicies().then((r) => r.data.data ?? []),
  });
  const claimsQuery = useQuery({
    queryKey: ["assets", "insurance", "claims"],
    queryFn: () => assetsApi.insuranceClaims().then((r) => r.data.data ?? []),
  });

  const createPolicy = useMutation({
    mutationFn: () =>
      assetsApi.createInsurancePolicy({
        ...policyForm,
        sum_insured: policyForm.sum_insured ? Number(policyForm.sum_insured) : null,
        premium_amount: policyForm.premium_amount ? Number(policyForm.premium_amount) : null,
      }),
    onSuccess: () => {
      setError(null);
      toast.success(t("assets.insurance.policySaved"));
      setPolicyForm({
        policy_number: "",
        insurer_name: "",
        coverage_type: "all_risk",
        effective_from: "",
        effective_to: "",
        sum_insured: "",
        premium_amount: "",
        notes: "",
      });
      qc.invalidateQueries({ queryKey: ["assets", "insurance"] });
    },
    onError: (err) => {
      setError(t("assets.insurance.policySaveFailed"));
      toast.error(t("assets.insurance.policyNotSaved"), apiErrorMessage(err, t("assets.insurance.policySaveFailed")));
    },
  });

  const createClaim = useMutation({
    mutationFn: () =>
      assetsApi.createInsuranceClaim({
        policy_id: Number(claimForm.policy_id),
        claim_number: claimForm.claim_number,
        incident_date: claimForm.incident_date,
        claim_amount: claimForm.claim_amount ? Number(claimForm.claim_amount) : null,
        description: claimForm.description || null,
        status: claimForm.status,
      }),
    onSuccess: () => {
      setError(null);
      toast.success(t("assets.insurance.claimSaved"));
      setClaimForm({
        policy_id: "",
        claim_number: "",
        incident_date: "",
        claim_amount: "",
        description: "",
        status: "draft",
      });
      qc.invalidateQueries({ queryKey: ["assets", "insurance"] });
    },
    onError: (err) => {
      setError(t("assets.insurance.claimSaveFailed"));
      toast.error(t("assets.insurance.claimNotSaved"), apiErrorMessage(err, t("assets.insurance.claimSaveFailed")));
    },
  });

  const policies = (policiesQuery.data ?? []) as AssetInsurancePolicy[];
  const claims = (claimsQuery.data ?? []) as AssetInsuranceClaim[];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="page-header">
        <ModulePageHeader
        title={t("assets.insurance.title")}
        subtitle={t("assets.insurance.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.insurance.title" }]} />}
      />
        <div className="flex gap-2">
          <button type="button" className={tab === "policies" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setTab("policies")}>
            {t("assets.insurance.policies")}
          </button>
          <button type="button" className={tab === "claims" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setTab("claims")}>
            {t("assets.insurance.claims")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {tab === "policies" && (
        <>
          <div className="card grid gap-3 p-4 md:grid-cols-3">
            <label htmlFor="policy-number" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.policyNumber")}
              <input id="policy-number" className="form-input" value={policyForm.policy_number} onChange={(e) => setPolicyForm((f) => ({ ...f, policy_number: e.target.value }))} />
            </label>
            <label htmlFor="policy-insurer" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.insurer")}
              <input id="policy-insurer" className="form-input" value={policyForm.insurer_name} onChange={(e) => setPolicyForm((f) => ({ ...f, insurer_name: e.target.value }))} />
            </label>
            <label htmlFor="policy-coverage-type" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.coverageType")}
              <input id="policy-coverage-type" className="form-input" value={policyForm.coverage_type} onChange={(e) => setPolicyForm((f) => ({ ...f, coverage_type: e.target.value }))} />
            </label>
            <label htmlFor="policy-effective-from" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.effectiveFrom")}
              <input id="policy-effective-from" className="form-input" type="date" value={policyForm.effective_from} onChange={(e) => setPolicyForm((f) => ({ ...f, effective_from: e.target.value }))} />
            </label>
            <label htmlFor="policy-effective-to" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.effectiveTo")}
              <input id="policy-effective-to" className="form-input" type="date" value={policyForm.effective_to} onChange={(e) => setPolicyForm((f) => ({ ...f, effective_to: e.target.value }))} />
            </label>
            <label htmlFor="policy-sum-insured" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.sumInsured")}
              <input id="policy-sum-insured" className="form-input" type="number" min={0} value={policyForm.sum_insured} onChange={(e) => setPolicyForm((f) => ({ ...f, sum_insured: e.target.value }))} />
            </label>
            <button
              type="button"
              className="btn-primary text-sm md:col-span-3"
              disabled={!policyForm.policy_number || !policyForm.insurer_name || !policyForm.effective_from || !policyForm.effective_to || createPolicy.isPending}
              onClick={() => createPolicy.mutate()}
            >
              {createPolicy.isPending ? t("assets.insurance.saving") : t("assets.insurance.addPolicy")}
            </button>
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">{t("assets.insurance.policy")}</th>
                  <th className="py-2">{t("assets.insurance.insurer")}</th>
                  <th className="py-2">{t("assets.insurance.period")}</th>
                  <th className="py-2">{t("assets.insurance.sumInsured")}</th>
                  <th className="py-2">{t("assets.insurance.status")}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="py-2 font-medium">{p.policy_number}</td>
                    <td className="py-2">{p.insurer_name}</td>
                    <td className="py-2">{p.effective_from?.slice(0, 10)} → {p.effective_to?.slice(0, 10)}</td>
                    <td className="py-2">{p.sum_insured ?? "—"}</td>
                    <td className="py-2">{p.status}</td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <TableEmpty colSpan={5} title={t("assets.insurance.noPolicies")} />
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "claims" && (
        <>
          <div className="card grid gap-3 p-4 md:grid-cols-3">
            <label htmlFor="claim-policy" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.policy")}
            <select id="claim-policy" className="form-input" value={claimForm.policy_id} onChange={(e) => setClaimForm((f) => ({ ...f, policy_id: e.target.value }))}>
              <option value="">{t("assets.insurance.selectPolicy")}</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>{p.policy_number} — {p.insurer_name}</option>
              ))}
            </select>
            </label>
            <label htmlFor="claim-number" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.claimNumber")}
              <input id="claim-number" className="form-input" value={claimForm.claim_number} onChange={(e) => setClaimForm((f) => ({ ...f, claim_number: e.target.value }))} />
            </label>
            <label htmlFor="claim-incident-date" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.incidentDate")}
              <input id="claim-incident-date" className="form-input" type="date" value={claimForm.incident_date} onChange={(e) => setClaimForm((f) => ({ ...f, incident_date: e.target.value }))} />
            </label>
            <label htmlFor="claim-amount" className="space-y-1 text-xs font-semibold text-neutral-700">
              {t("assets.insurance.claimAmount")}
              <input id="claim-amount" className="form-input" type="number" min={0} value={claimForm.claim_amount} onChange={(e) => setClaimForm((f) => ({ ...f, claim_amount: e.target.value }))} />
            </label>
            <label htmlFor="claim-description" className="space-y-1 text-xs font-semibold text-neutral-700 md:col-span-2">
              {t("assets.insurance.description")}
              <input id="claim-description" className="form-input" value={claimForm.description} onChange={(e) => setClaimForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <button
              type="button"
              className="btn-primary text-sm md:col-span-3"
              disabled={!claimForm.policy_id || !claimForm.claim_number || !claimForm.incident_date || createClaim.isPending}
              onClick={() => createClaim.mutate()}
            >
              {createClaim.isPending ? t("assets.insurance.saving") : t("assets.insurance.addClaim")}
            </button>
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">{t("assets.insurance.claim")}</th>
                  <th className="py-2">{t("assets.insurance.policy")}</th>
                  <th className="py-2">{t("assets.insurance.incident")}</th>
                  <th className="py-2">{t("assets.insurance.amount")}</th>
                  <th className="py-2">{t("assets.insurance.status")}</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="py-2 font-medium">{c.claim_number}</td>
                    <td className="py-2">{c.policy?.policy_number ?? c.policy_id}</td>
                    <td className="py-2">{c.incident_date?.slice(0, 10)}</td>
                    <td className="py-2">{c.claim_amount ?? "—"}</td>
                    <td className="py-2">{c.status}</td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <TableEmpty colSpan={5} title={t("assets.insurance.noClaims")} />
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
