"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ContractSubNav, ContractTableWrap } from "@/components/contracts/ContractChrome";

type ReportType = "register" | "financial" | "compliance" | "operational";
const TYPES: ReportType[] = ["register", "financial", "compliance", "operational"];

export default function ContractReportsPage() {
  const { t } = useI18n();
  const [type, setType] = useState<ReportType>("register");
  const [showExceptions, setShowExceptions] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contract-report", type],
    queryFn: () => contractsApi.report(type).then((r) => r.data),
    enabled: !showExceptions,
  });

  const { data: exceptions } = useQuery({
    queryKey: ["contract-exceptions-register"],
    queryFn: () => contractsApi.exceptionRegister().then((r) => r.data.data),
    enabled: showExceptions,
  });

  const rows = data?.data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.reportsTitle"
        subtitle="contracts.reportsSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.reports" }]} />}
      />
      <ContractSubNav />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setType(item); setShowExceptions(false); }}
              className={`filter-tab ${!showExceptions && type === item ? "active" : ""}`}
            >
              {t(`contracts.reports.${item}`)}
            </button>
          ))}
          <button type="button" onClick={() => setShowExceptions(true)} className={`filter-tab ${showExceptions ? "active" : ""}`}>
            {t("contracts.reports.exceptions")}
          </button>
        </div>
        {!showExceptions && (
          <div className="flex gap-2">
            {(["csv", "xlsx", "pdf"] as const).map((f) => (
              <a key={f} href={contractsApi.reportDownloadUrl(type, f)} className="btn-secondary text-xs uppercase">{f}</a>
            ))}
          </div>
        )}
      </div>

      {showExceptions ? (
        <div className="card overflow-hidden">
          {(exceptions ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.reports.noExceptions")}</div>
          ) : (
            <ContractTableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("contracts.reports.severity")}</th>
                    <th>{t("contracts.reports.contract")}</th>
                    <th>{t("contracts.col.type")}</th>
                    <th>{t("contracts.col.title")}</th>
                    <th>{t("contracts.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(exceptions ?? []).map((e) => (
                    <tr key={e.id}>
                      <td><span className={`badge ${e.severity === "critical" ? "badge-danger" : e.severity === "high" ? "badge-warning" : "badge-muted"}`}>{e.severity}</span></td>
                      <td className="font-mono text-xs text-neutral-600">{e.contract?.reference_number ?? "—"}</td>
                      <td className="text-sm">{e.type.replace(/_/g, " ")}</td>
                      <td className="text-sm text-neutral-800">{e.title}</td>
                      <td className="text-sm capitalize">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContractTableWrap>
          )}
        </div>
      ) : isLoading ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.reports.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-500">{t("contracts.reports.noData")}</div>
      ) : (
        <div className="card overflow-hidden">
          <ContractTableWrap>
            <table className="data-table">
              <thead>
                <tr>{columns.map((c) => <th key={c} className="capitalize whitespace-nowrap">{c.replace(/_/g, " ")}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className="text-sm whitespace-nowrap">{typeof row[c] === "boolean" ? (row[c] ? t("contracts.yes") : t("contracts.no")) : String(row[c] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ContractTableWrap>
        </div>
      )}
    </div>
  );
}
