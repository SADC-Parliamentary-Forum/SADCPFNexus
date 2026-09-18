"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractRiskPortfolio } from "@/lib/api";

const LEVEL_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function LevelBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${LEVEL_STYLES[level] ?? LEVEL_STYLES.low}`}>
      {level}
    </span>
  );
}

export default function ContractRiskPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["contract-risk"],
    queryFn: () => contractsApi.risk().then((r) => r.data.data),
  });
  const r: ContractRiskPortfolio | undefined = data;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Contract Risk"
        subtitle="Portfolio risk scoring across expiry, deliverables, exceptions, signatures and exposure"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Risk" }]} />}
      />

      {isLoading || !r ? (
        <div className="card p-6 text-sm text-neutral-500">Assessing portfolio risk…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["Critical", r.levels.critical, "text-red-700"],
              ["High", r.levels.high, "text-orange-700"],
              ["Medium", r.levels.medium, "text-amber-700"],
              ["Low", r.levels.low, "text-neutral-700"],
              ["At-risk contracts", r.totals.at_risk, "text-neutral-900"],
              ["At-risk value", r.totals.at_risk_value.toLocaleString(), "text-neutral-900"],
            ] as [string, string | number, string][]).map(([label, val, tone]) => (
              <div key={label} className="card p-4">
                <p className={`text-2xl font-bold ${tone}`}>{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {r.top_factors.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Most common risk factors</div>
              <div className="flex flex-wrap gap-2 p-4">
                {r.top_factors.map((f) => (
                  <span key={f.code} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                    {f.label}
                    <span className="rounded-full bg-white px-1.5 font-semibold text-neutral-900">{f.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">At-risk contracts (highest first)</div>
            {r.contracts.length === 0 ? (
              <p className="p-6 text-sm text-neutral-400">No contracts currently flagged for risk.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th><th>Title</th><th>Risk</th><th className="text-right">Score</th>
                    <th className="text-right">Value</th><th>End date</th><th>Factors</th>
                  </tr>
                </thead>
                <tbody>
                  {r.contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm font-mono">
                        <Link href={`/contracts/${c.id}`} className="text-primary hover:underline">{c.reference_number ?? `#${c.id}`}</Link>
                      </td>
                      <td className="text-sm max-w-[16rem] truncate">{c.title}</td>
                      <td><LevelBadge level={c.level} /></td>
                      <td className="text-right text-sm font-semibold">{c.score}</td>
                      <td className="text-right text-sm">{c.value.toLocaleString()}</td>
                      <td className="text-sm">{c.end_date ?? "—"}</td>
                      <td className="text-xs text-neutral-600">{c.factors.map((f) => f.label).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
