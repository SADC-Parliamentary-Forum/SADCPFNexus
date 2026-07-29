"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { riskApi, type RiskBcpLink, type RiskDependency } from "@/lib/api";

export default function RiskBcpPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [riskId, setRiskId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [linkType, setLinkType] = useState<"bcp_note" | "insurance_policy">("bcp_note");
  const [policyId, setPolicyId] = useState("");
  const [relatedRiskId, setRelatedRiskId] = useState("");

  const linksQuery = useQuery({
    queryKey: ["risk", "bcp-links"],
    queryFn: () => riskApi.listBcpLinks().then((r) => r.data.data ?? []),
  });
  const depsQuery = useQuery({
    queryKey: ["risk", "dependencies"],
    queryFn: () => riskApi.listRiskDependencies().then((r) => r.data.data ?? []),
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

  const links = (linksQuery.data ?? []) as RiskBcpLink[];
  const deps = (depsQuery.data ?? []) as RiskDependency[];

  function onLink(e: FormEvent) {
    e.preventDefault();
    createLink.mutate();
  }

  function onDep(e: FormEvent) {
    e.preventDefault();
    createDep.mutate();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">BCP / Insurance Linkage</h1>
          <p className="page-subtitle">
            Light linkage from risks to BCP notes and Fixed Asset insurance policies — not a full BCP module. Map simple risk interdependencies below.
          </p>
        </div>
        <Link href="/risk/control-testing" className="btn-secondary">
          Control testing
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onLink} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2">
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
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

      <form onSubmit={onDep} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-3">
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
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
