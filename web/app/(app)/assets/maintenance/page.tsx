"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type RecordRow = {
  id: number;
  title: string;
  status: string;
  maintenance_type: string;
  under_warranty: boolean;
  asset?: { asset_code: string; name: string };
};

export default function AssetMaintenancePage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    api.get<{ data: RecordRow[] }>("/assets-meta/maintenance")
      .then((r) => setRows(Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title={t("assets.maintenance.title")}
        subtitle={t("assets.maintenance.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.maintenance.title" }]} />}
      />
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
        <table className="data-table">
          <thead>
            <tr><th>{t("assets.maintenance.asset")}</th><th>{t("assets.maintenance.recordTitle")}</th><th>{t("assets.maintenance.type")}</th><th>{t("assets.maintenance.warranty")}</th><th>{t("assets.maintenance.status")}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.asset?.asset_code ?? "—"}</td>
                <td>{r.title}</td>
                <td>{r.maintenance_type}</td>
                <td>{r.under_warranty ? t("assets.maintenance.yes") : t("assets.maintenance.no")}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && <TableEmpty colSpan={5} title={t("assets.maintenance.empty")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
