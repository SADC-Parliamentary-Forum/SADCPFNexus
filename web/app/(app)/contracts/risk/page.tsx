"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractRiskPortfolio } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const LEVEL_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function LevelBadge({ level }: { level: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${LEVEL_STYLES[level] ?? LEVEL_STYLES.low}`}>
      {level in LEVEL_STYLES ? t(`contracts.risk.level.${level}`) : level}
    </span>
  );
}

export default function ContractRiskPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["contract-risk"],
    queryFn: () => contractsApi.risk().then((r) => r.data.data),
  });
  const r: ContractRiskPortfolio | undefined = data;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="contracts.risk.title"
        subtitle="contracts.risk.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.risk.crumb" }]} />}
      />

      {isLoading || !r ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.risk.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["contracts.risk.level.critical", r.levels.critical, "text-red-700"],
              ["contracts.risk.level.high", r.levels.high, "text-orange-700"],
              ["contracts.risk.level.medium", r.levels.medium, "text-amber-700"],
              ["contracts.risk.level.low", r.levels.low, "text-neutral-700"],
              ["contracts.risk.atRiskContracts", r.totals.at_risk, "text-neutral-900"],
              ["contracts.risk.atRiskValue", r.totals.at_risk_value.toLocaleString(), "text-neutral-900"],
            ] as [string, string | number, string][]).map(([label, val, tone]) => (
              <div key={label} className="card p-4">
                <p className={`text-2xl font-bold ${tone}`}>{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{t(label)}</p>
              </div>
            ))}
          </div>

          {r.top_factors.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.risk.topFactors")}</div>
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
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.risk.listTitle")}</div>
            {r.contracts.length === 0 ? (
              <p className="p-6 text-sm text-neutral-400">{t("contracts.risk.empty")}</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("contracts.field.reference")}</th><th>{t("contracts.field.title")}</th><th>{t("contracts.risk.crumb")}</th><th className="text-right">{t("contracts.risk.score")}</th>
                    <th className="text-right">{t("contracts.field.value")}</th><th>{t("contracts.field.endDateLower")}</th><th>{t("contracts.risk.factors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm font-mono">
                        <Link href={`/contracts/${c.id}`} className="font-semibold text-primary hover:opacity-80">{c.reference_number ?? `#${c.id}`}</Link>
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
