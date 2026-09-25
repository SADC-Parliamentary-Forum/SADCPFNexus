"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi, type ContractRiskPortfolio } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ContractSubNav, ContractTableWrap, formatContractMoney } from "@/components/contracts/ContractChrome";

const LEVEL_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function LevelBadge({ level, label }: { level: string; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLES[level] ?? LEVEL_STYLES.low}`}>
      {label}
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
  const levelLabel = (level: string) => {
    const key = `contracts.risk.${level}`;
    return t(key) !== key ? t(key) : level;
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.riskTitle"
        subtitle="contracts.riskSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.risk" }]} />}
      />
      <ContractSubNav />

      {isLoading || !r ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.risk.assessing")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {([
              [t("contracts.risk.critical"), r.levels.critical, "text-red-700"],
              [t("contracts.risk.high"), r.levels.high, "text-orange-700"],
              [t("contracts.risk.medium"), r.levels.medium, "text-amber-700"],
              [t("contracts.risk.low"), r.levels.low, "text-neutral-700"],
              [t("contracts.risk.atRisk"), r.totals.at_risk, "text-neutral-900"],
              [t("contracts.risk.atRiskValue"), r.totals.at_risk_value.toLocaleString(), "text-neutral-900"],
            ] as [string, string | number, string][]).map(([label, val, tone]) => (
              <div key={label} className="card p-4 min-w-0">
                <p className={`text-2xl font-bold truncate ${tone}`}>{val}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
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
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.risk.tableTitle")}</div>
            {r.contracts.length === 0 ? (
              <p className="p-6 text-sm text-neutral-400">{t("contracts.risk.none")}</p>
            ) : (
              <ContractTableWrap>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("contracts.col.reference")}</th>
                      <th>{t("contracts.col.title")}</th>
                      <th>{t("contracts.risk")}</th>
                      <th className="text-right">{t("contracts.risk.score")}</th>
                      <th className="text-right">{t("contracts.col.value")}</th>
                      <th>{t("contracts.col.endDate")}</th>
                      <th>{t("contracts.risk.factors")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.contracts.map((c) => (
                      <tr key={c.id}>
                        <td className="text-sm font-mono">
                          <Link href={`/contracts/${c.id}`} className="text-primary hover:underline">{c.reference_number ?? `#${c.id}`}</Link>
                        </td>
                        <td className="text-sm max-w-[16rem] truncate">{c.title}</td>
                        <td><LevelBadge level={c.level} label={levelLabel(c.level)} /></td>
                        <td className="text-right text-sm font-semibold">{c.score}</td>
                        <td className="text-right text-sm whitespace-nowrap">{formatContractMoney(undefined, c.value)}</td>
                        <td className="text-sm whitespace-nowrap">{c.end_date ?? "—"}</td>
                        <td className="text-xs text-neutral-600">{c.factors.map((f) => f.label).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ContractTableWrap>
            )}
          </div>
        </>
      )}
    </div>
  );
}
