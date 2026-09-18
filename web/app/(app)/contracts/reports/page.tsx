"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { contractsApi } from "@/lib/api";

type ReportType = "register" | "financial" | "compliance" | "operational";
const TYPES: ReportType[] = ["register", "financial", "compliance", "operational"];

export default function ContractReportsPage() {
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
    <div className="space-y-6">
      <ModulePageHeader
        title="Contract Reports"
        subtitle="Register, financial, compliance, operational and exception reporting"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Reports" }]} />}
      />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button key={t} onClick={() => { setType(t); setShowExceptions(false); }}
              className={`filter-tab capitalize ${!showExceptions && type === t ? "active" : ""}`}>{t}</button>
          ))}
          <button onClick={() => setShowExceptions(true)} className={`filter-tab ${showExceptions ? "active" : ""}`}>Exceptions</button>
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
            <div className="p-6 text-sm text-neutral-500">No exceptions recorded.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Severity</th><th>Contract</th><th>Type</th><th>Title</th><th>Status</th></tr></thead>
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
          )}
        </div>
      ) : isLoading ? (
        <div className="card p-6 text-sm text-neutral-500">Loading report…</div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-500">No data for this report.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr>{columns.map((c) => <th key={c} className="capitalize whitespace-nowrap">{c.replace(/_/g, " ")}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} className="text-sm whitespace-nowrap">{typeof row[c] === "boolean" ? (row[c] ? "Yes" : "No") : String(row[c] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
