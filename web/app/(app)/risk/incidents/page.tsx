"use client";

import { useEffect, useState } from "react";
import { riskApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function RiskIncidentsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    riskApi.listIncidents()
      .then((r) => setData(((r.data as { data?: Record<string, unknown>[] }).data ?? r.data ?? []) as Record<string, unknown>[]))
      .catch((e: { response?: { data?: { message?: string } } }) => setError(e?.response?.data?.message ?? t("risk.incidents.loadError")));
  }, [t]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <ModulePageHeader
        title="risk.incidents.title"
        subtitle="risk.incidents.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.incidents.title" }]} />}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2.5">{t("risk.incidents.col.code")}</th>
              <th className="px-3 py-2.5">{t("risk.incidents.col.title")}</th>
              <th className="px-3 py-2.5">{t("risk.incidents.col.severity")}</th>
              <th className="px-3 py-2.5">{t("risk.incidents.col.status")}</th>
              <th className="px-3 py-2.5">{t("risk.incidents.col.linked")}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">{t("risk.incidents.empty")}</td></tr>
            )}
            {data.map((row) => (
              <tr key={String(row.id)} className="border-b border-neutral-100">
                <td className="px-3 py-2.5 font-mono text-xs">{String(row.incident_code ?? "—")}</td>
                <td className="px-3 py-2.5">{String(row.title ?? "—")}</td>
                <td className="px-3 py-2.5">{String(row.severity ?? "—")}</td>
                <td className="px-3 py-2.5">{String(row.status ?? "—")}</td>
                <td className="px-3 py-2.5">{row.risk_id != null ? String(row.risk_id) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
