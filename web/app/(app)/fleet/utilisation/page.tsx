"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function FleetUtilisationPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fleet-utilisation", from, to],
    queryFn: async () => (await api.get("/fleet/utilisation", { params: { from, to } })).data.data,
  });

  const vehicles = useMemo(() => (data?.vehicles ?? []) as Array<Record<string, unknown>>, [data]);

  function exportRows() {
    exportToCsv(
      `fleet-utilisation-${from}-to-${to}.csv`,
      vehicles.map((v) => ({
        vehicle: `${v.asset_tag ?? ""} — ${v.name ?? ""}`,
        booking_days: v.booking_days,
        idle_days: v.idle_days,
        km_travelled: v.km_travelled,
        utilisation_pct: v.utilisation_pct,
      })),
      [
        { key: "vehicle", header: t("fleet.col.vehicle") },
        { key: "booking_days", header: t("fleet.utilisation.bookingDays") },
        { key: "idle_days", header: t("fleet.utilisation.idleDays") },
        { key: "km_travelled", header: t("fleet.utilisation.km") },
        { key: "utilisation_pct", header: t("fleet.utilisation.utilPct") },
      ],
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("fleet.utilisation.title")}
        subtitle={t("fleet.utilisation.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("fleet.utilisation.title") }]} />}
        actions={
          <button type="button" className="btn-secondary" onClick={exportRows} disabled={vehicles.length === 0}>
            {t("correspondence.exportCsv")}
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input type="date" className="form-input" aria-label={t("fleet.utilisation.from")} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="form-input" aria-label={t("fleet.utilisation.to")} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
      {isError && <p className="text-sm text-red-700">{t("fleet.utilisation.loadFailed")}</p>}
      {data && (
        <p className="text-sm text-neutral-600">{t("fleet.utilisation.summary", { pct: String(data.summary?.avg_utilisation_pct ?? ""), km: String(data.summary?.total_km ?? "") })}</p>
      )}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">{t("fleet.col.vehicle")}</th><th className="p-2">{t("fleet.utilisation.bookingDays")}</th><th className="p-2">{t("fleet.utilisation.idleDays")}</th><th className="p-2">{t("fleet.utilisation.km")}</th><th className="p-2">{t("fleet.utilisation.utilPct")}</th></tr></thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={String(v.asset_id)} className="border-t border-neutral-200">
                <td className="p-2">{String(v.asset_tag)} — {String(v.name)}</td>
                <td className="p-2">{String(v.booking_days)}</td>
                <td className="p-2">{String(v.idle_days)}</td>
                <td className="p-2">{String(v.km_travelled)}</td>
                <td className="p-2">{String(v.utilisation_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
