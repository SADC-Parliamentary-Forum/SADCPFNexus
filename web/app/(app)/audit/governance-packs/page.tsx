"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

type PlanProgress = {
  plan_id?: number;
  title?: string;
  status?: string;
  completion_pct?: number;
};

type PackFinding = {
  id?: number;
  title?: string;
  rating?: string;
  status?: string;
};

type GovernancePack = {
  id?: number;
  title?: string;
  fiscal_year?: number;
  audience?: string;
  payload?: {
    generated_at?: string;
    fiscal_year?: number;
    plan_progress?: PlanProgress[];
    critical_high_findings?: PackFinding[];
  };
};

export default function AuditGovernancePacksPage() {
  const [title, setTitle] = useState("FSC meeting pack");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pack, setPack] = useState<GovernancePack | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (await auditApi.createGovernancePack({
        title,
        fiscal_year: Number(year),
        audience: "fsc",
      })).data.data as GovernancePack,
    onSuccess: (row) => setPack(row),
  });

  const progress = pack?.payload?.plan_progress ?? [];
  const findings = pack?.payload?.critical_high_findings ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Governance meeting packs"
        subtitle="Export plan progress plus critical/high findings for FSC. This is a structured pack, not a signed minute."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Audit" }, { label: "Governance packs" }]} />}
      />
      <div className="card space-y-3 p-4 text-sm">
        <label className="block">
          <span className="mb-1 block text-neutral-600">Title</span>
          <input className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-neutral-600">Fiscal year</span>
          <input className="form-input w-40" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Generating…" : "Generate pack"}
        </button>
        {create.isError && <p className="text-sm text-red-700">Could not generate the pack.</p>}
      </div>
      {pack && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {pack.title} · FY {pack.payload?.fiscal_year ?? pack.fiscal_year}
            {pack.payload?.generated_at ? ` · ${pack.payload.generated_at}` : ""}
          </p>
          <div className="card overflow-x-auto p-4">
            <h2 className="mb-2 text-sm font-semibold">Plan progress</h2>
            {progress.length === 0 ? (
              <p className="text-sm text-neutral-500">No plans in this fiscal year.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-neutral-600">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((row) => (
                    <tr key={row.plan_id ?? row.title} className="border-t border-neutral-100">
                      <td className="py-2 pr-3">{row.title ?? "—"}</td>
                      <td className="py-2 pr-3 capitalize">{row.status ?? "—"}</td>
                      <td className="py-2 text-right">{row.completion_pct ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card overflow-x-auto p-4">
            <h2 className="mb-2 text-sm font-semibold">Critical / high findings</h2>
            {findings.length === 0 ? (
              <p className="text-sm text-neutral-500">No open critical or high findings.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-neutral-600">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Finding</th>
                    <th className="py-2 pr-3 font-medium">Rating</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((row) => (
                    <tr key={row.id ?? row.title} className="border-t border-neutral-100">
                      <td className="py-2 pr-3">{row.title ?? "—"}</td>
                      <td className="py-2 pr-3 capitalize">{row.rating ?? "—"}</td>
                      <td className="py-2 capitalize">{row.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
