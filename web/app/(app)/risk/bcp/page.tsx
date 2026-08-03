"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  riskApi,
  type AssetInsurancePolicyLite,
  type RiskBcpExercise,
  type RiskBcpLink,
  type RiskDependency,
} from "@/lib/api";

export default function RiskBcpPage() {
  const qc = useQueryClient();
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
    },
    onError: () => setError("Could not create BCP/insurance link."),
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
    },
    onError: () => setError("Could not link related risk."),
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
    },
    onError: () => setError("Could not schedule BCP exercise."),
  });

  const completeExercise = useMutation({
    mutationFn: (id: number) =>
      riskApi.completeBcpExercise(id, { result: "pass", outcome_notes: "Completed via ops UI" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risk", "bcp-exercises"] }),
    onError: () => setError("Could not complete exercise."),
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
    },
    onError: () => setError("Could not renew insurance policy."),
  });

  const links = (linksQuery.data ?? []) as RiskBcpLink[];
  const deps = (depsQuery.data ?? []) as RiskDependency[];
  const exercises = (exercisesQuery.data ?? []) as RiskBcpExercise[];
  const renewals = (renewalsQuery.data ?? []) as AssetInsurancePolicyLite[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="BCP / Insurance Ops"
        subtitle="BCP linkage, exercises, and insurance renewal queue on existing risk/FA insurance data."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "BCP / Insurance Ops" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/assets/insurance" className="btn-secondary">
            FA insurance
          </Link>
          <Link href="/risk/control-testing" className="btn-secondary">
            Control testing
          </Link>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createLink.mutate();
        }}
        className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <label className="space-y-1">
          <span className="text-sm font-medium">Risk ID</span>
          <input className="input w-full" required value={riskId} onChange={(e) => setRiskId(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Link type</span>
          <select className="input w-full" value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)}>
            <option value="bcp_note">BCP note</option>
            <option value="insurance_policy">FA insurance policy</option>
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Title</span>
          <input className="input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Notes</span>
          <textarea className="input w-full min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {linkType === "insurance_policy" && (
          <label className="space-y-1">
            <span className="text-sm font-medium">Asset insurance policy ID</span>
            <input className="input w-full" required value={policyId} onChange={(e) => setPolicyId(e.target.value)} />
          </label>
        )}
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={createLink.isPending}>
            Add link
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Insurance</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{l.risk?.risk_code ?? l.risk_id}</td>
                <td className="px-3 py-2">{l.link_type}</td>
                <td className="px-3 py-2">{l.title}</td>
                <td className="px-3 py-2">{l.insurance_policy?.policy_number ?? "—"}</td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                  No BCP/insurance links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">BCP exercises</h2>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createExercise.mutate();
          }}
          className="grid gap-3 md:grid-cols-4"
        >
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Title</span>
            <input className="input w-full" required value={exerciseTitle} onChange={(e) => setExerciseTitle(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Type</span>
            <select className="input w-full" value={exerciseType} onChange={(e) => setExerciseType(e.target.value)}>
              <option value="tabletop">Tabletop</option>
              <option value="drill">Drill</option>
              <option value="full">Full</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Scheduled</span>
            <input className="input w-full" type="datetime-local" value={exerciseAt} onChange={(e) => setExerciseAt(e.target.value)} />
          </label>
          <div className="md:col-span-4">
            <button type="submit" className="btn-primary" disabled={createExercise.isPending}>
              Schedule exercise
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{ex.title}</td>
                  <td className="px-3 py-2">{ex.exercise_type}</td>
                  <td className="px-3 py-2">{ex.status}</td>
                  <td className="px-3 py-2">{ex.result ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {ex.status !== "completed" && (
                      <button type="button" className="text-primary underline" onClick={() => completeExercise.mutate(ex.id)}>
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {exercises.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                    No exercises scheduled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">Insurance renewals due</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Policy</th>
                <th className="px-3 py-2">Insurer</th>
                <th className="px-3 py-2">Effective to</th>
                <th className="px-3 py-2">Status</th>
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
                      <button type="button" className="text-primary underline" onClick={() => renewPolicy.mutate(p)}>
                        Renew +1y
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {renewals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                    No policies due within 120 days.
                  </td>
                </tr>
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
        <h2 className="md:col-span-3 text-lg font-semibold">Interdependency mapping</h2>
        <label className="space-y-1">
          <span className="text-sm font-medium">Risk A (depends)</span>
          <input className="input w-full" required value={riskId} onChange={(e) => setRiskId(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Risk B (dependency)</span>
          <input className="input w-full" required value={relatedRiskId} onChange={(e) => setRelatedRiskId(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary" disabled={createDep.isPending}>
            Link A depends on B
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">Relation</th>
              <th className="px-3 py-2">Related risk</th>
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
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                  No interdependencies mapped.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
