"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { riskApi, type RiskKri, type RiskKriCatalogEntry } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

function statusBadge(status: RiskKri["last_status"]): string {
  if (status === "breach") return "badge-danger";
  if (status === "warning") return "badge-warning";
  if (status === "ok") return "badge-success";
  return "badge";
}

export default function RiskKriPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<number, { risk_id: string; strategic_objective_id: string }>>({});

  const krisQuery = useQuery({
    queryKey: ["risk", "kris"],
    queryFn: () => riskApi.listKris().then((r) => r.data.data ?? []),
  });

  const catalogQuery = useQuery({
    queryKey: ["risk", "kris", "catalog"],
    queryFn: () => riskApi.kriCatalog().then((r) => r.data.data ?? []),
  });

  const evaluate = useMutation({
    mutationFn: () => riskApi.evaluateKris(),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["risk", "kris"] });
    },
    onError: () => setError("Could not evaluate KRIs."),
  });

  const updateKri = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RiskKri> }) => riskApi.updateKri(id, data),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["risk", "kris"] });
    },
    onError: () => setError("Could not update KRI links/thresholds."),
  });

  const kris = (krisQuery.data ?? []) as RiskKri[];
  const catalog = (catalogQuery.data ?? []) as RiskKriCatalogEntry[];
  const catalogByCode = Object.fromEntries(catalog.map((c) => [c.code, c]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Key Risk Indicators"
        subtitle="Automated KRIs from Nexus data (budget, assignments, leave, stock, risk register). Threshold breaches raise in-app alerts."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Risk", href: "/risk" }, { label: "KRIs" }]} />
        }
        actions={
          <>
            <Link href="/risk/dashboard" className="btn-secondary">
              Risk dashboard
            </Link>
            <button
              type="button"
              className="btn-primary"
              disabled={evaluate.isPending}
              onClick={() => evaluate.mutate()}
            >
              {evaluate.isPending ? "Evaluating…" : "Evaluate now"}
            </button>
          </>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>KRI</th>
              <th>Source</th>
              <th>Value</th>
              <th>Thresholds</th>
              <th>Status</th>
              <th>Linked risk / objective</th>
            </tr>
          </thead>
          <tbody>
            {kris.map((kri) => {
              const draft = linkDrafts[kri.id] ?? {
                risk_id: kri.risk_id?.toString() ?? "",
                strategic_objective_id: kri.strategic_objective_id?.toString() ?? "",
              };
              const source = catalogByCode[kri.code];
              return (
                <tr key={kri.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-neutral-900">{kri.name}</div>
                    <div className="text-xs text-neutral-500">{kri.code}</div>
                    <div className="mt-1 text-xs text-neutral-600">{kri.description}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">{kri.source_module}</div>
                    <div className="mt-1 text-xs text-neutral-700">{source?.data_source ?? kri.source_key}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold">
                      {kri.last_value == null ? "—" : kri.last_value}
                      {kri.unit === "percent" ? "%" : ""}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {kri.last_evaluated_at ? new Date(kri.last_evaluated_at).toLocaleString() : "Not evaluated"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-700">
                    <div>Warn ≥ {kri.warning_threshold ?? "—"}</div>
                    <div>Breach ≥ {kri.breach_threshold ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={statusBadge(kri.last_status)}>{kri.last_status ?? "n/a"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="mb-2 space-y-1 text-xs text-neutral-600">
                      {kri.risk && (
                        <div>
                          Risk:{" "}
                          <Link className="text-blue-700 underline" href={`/risk/${kri.risk.id}`}>
                            {kri.risk.risk_code}
                          </Link>
                        </div>
                      )}
                      {kri.strategic_objective && <div>Objective: {kri.strategic_objective.code}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="input input-sm w-24"
                        placeholder="Risk ID"
                        value={draft.risk_id}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [kri.id]: { ...draft, risk_id: e.target.value },
                          }))
                        }
                      />
                      <input
                        className="input input-sm w-28"
                        placeholder="Objective ID"
                        value={draft.strategic_objective_id}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [kri.id]: { ...draft, strategic_objective_id: e.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={updateKri.isPending}
                        onClick={() =>
                          updateKri.mutate({
                            id: kri.id,
                            data: {
                              risk_id: draft.risk_id ? Number(draft.risk_id) : null,
                              strategic_objective_id: draft.strategic_objective_id
                                ? Number(draft.strategic_objective_id)
                                : null,
                            },
                          })
                        }
                      >
                        Link
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {kris.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  {krisQuery.isLoading ? "Loading KRIs…" : "No KRIs configured."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-900">Data sources (documented)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Each KRI maps to an explicit Nexus table/query — no invented metrics.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {catalog.map((entry) => (
            <li key={entry.code} className="rounded border border-neutral-100 px-3 py-2">
              <span className="font-medium">{entry.code}</span>
              <span className="text-neutral-500"> — {entry.data_source}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
