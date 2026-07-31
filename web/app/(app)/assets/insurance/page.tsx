"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsApi, type AssetInsuranceClaim, type AssetInsurancePolicy } from "@/lib/api";

export default function AssetInsurancePage() {
  const qc = useQueryClient();
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
    onError: () => setError("Could not save policy."),
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
    onError: () => setError("Could not save claim."),
  });

  const policies = (policiesQuery.data ?? []) as AssetInsurancePolicy[];
  const claims = (claimsQuery.data ?? []) as AssetInsuranceClaim[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="page-header">
        <ModulePageHeader
        title="Insurance"
        subtitle="Policies and claims for capital assets (Phase 2). Warranty fields remain on the asset register."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Insurance" }]} />}
      />
        <div className="flex gap-2">
          <button type="button" className={tab === "policies" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setTab("policies")}>
            Policies
          </button>
          <button type="button" className={tab === "claims" ? "btn-primary text-sm" : "btn-secondary text-sm"} onClick={() => setTab("claims")}>
            Claims
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {tab === "policies" && (
        <>
          <div className="card grid gap-3 p-4 md:grid-cols-3">
            <input className="form-input" placeholder="Policy number" value={policyForm.policy_number} onChange={(e) => setPolicyForm((f) => ({ ...f, policy_number: e.target.value }))} />
            <input className="form-input" placeholder="Insurer" value={policyForm.insurer_name} onChange={(e) => setPolicyForm((f) => ({ ...f, insurer_name: e.target.value }))} />
            <input className="form-input" placeholder="Coverage type" value={policyForm.coverage_type} onChange={(e) => setPolicyForm((f) => ({ ...f, coverage_type: e.target.value }))} />
            <input className="form-input" type="date" value={policyForm.effective_from} onChange={(e) => setPolicyForm((f) => ({ ...f, effective_from: e.target.value }))} />
            <input className="form-input" type="date" value={policyForm.effective_to} onChange={(e) => setPolicyForm((f) => ({ ...f, effective_to: e.target.value }))} />
            <input className="form-input" type="number" placeholder="Sum insured" value={policyForm.sum_insured} onChange={(e) => setPolicyForm((f) => ({ ...f, sum_insured: e.target.value }))} />
            <button
              type="button"
              className="btn-primary text-sm md:col-span-3"
              disabled={!policyForm.policy_number || !policyForm.insurer_name || !policyForm.effective_from || !policyForm.effective_to || createPolicy.isPending}
              onClick={() => createPolicy.mutate()}
            >
              {createPolicy.isPending ? "Saving…" : "Add policy"}
            </button>
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">Policy</th>
                  <th className="py-2">Insurer</th>
                  <th className="py-2">Period</th>
                  <th className="py-2">Sum insured</th>
                  <th className="py-2">Status</th>
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
                  <tr><td colSpan={5} className="py-6 text-neutral-400">No policies yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "claims" && (
        <>
          <div className="card grid gap-3 p-4 md:grid-cols-3">
            <select className="form-input" value={claimForm.policy_id} onChange={(e) => setClaimForm((f) => ({ ...f, policy_id: e.target.value }))}>
              <option value="">Select policy</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>{p.policy_number} — {p.insurer_name}</option>
              ))}
            </select>
            <input className="form-input" placeholder="Claim number" value={claimForm.claim_number} onChange={(e) => setClaimForm((f) => ({ ...f, claim_number: e.target.value }))} />
            <input className="form-input" type="date" value={claimForm.incident_date} onChange={(e) => setClaimForm((f) => ({ ...f, incident_date: e.target.value }))} />
            <input className="form-input" type="number" placeholder="Claim amount" value={claimForm.claim_amount} onChange={(e) => setClaimForm((f) => ({ ...f, claim_amount: e.target.value }))} />
            <input className="form-input md:col-span-2" placeholder="Description" value={claimForm.description} onChange={(e) => setClaimForm((f) => ({ ...f, description: e.target.value }))} />
            <button
              type="button"
              className="btn-primary text-sm md:col-span-3"
              disabled={!claimForm.policy_id || !claimForm.claim_number || !claimForm.incident_date || createClaim.isPending}
              onClick={() => createClaim.mutate()}
            >
              {createClaim.isPending ? "Saving…" : "Add claim"}
            </button>
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">Claim</th>
                  <th className="py-2">Policy</th>
                  <th className="py-2">Incident</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
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
                  <tr><td colSpan={5} className="py-6 text-neutral-400">No claims yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
