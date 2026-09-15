"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetsApi, type AssetHandover } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetHandoversPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AssetHandover[]>([]);

  useEffect(() => {
    assetsApi.handovers({ per_page: 50 })
      .then((r) => {
        const payload = r.data as { data?: AssetHandover[] };
        setRows(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <ModulePageHeader
          title="assets.handover.title"
          subtitle="assets.handover.subtitle"
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.handover.title") }]} />}
        />
        <Link href="/assets/handovers/new" className="btn-primary" data-testid="handover-create">
          {t("assets.handover.create")}
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>{t("assets.handover.type")}</th>
              <th>{t("assets.view.fieldStatus")}</th>
              <th>{t("assets.handover.target")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid={`handover-row-${row.reference}`}>
                <td className="font-mono text-xs">{row.reference}</td>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.to_user?.name ?? row.custody_target_type}</td>
                <td className="text-right">
                  <Link className="btn-secondary text-xs" href={`/assets/handovers/${row.id}`}>{t("common.open")}</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}><EmptyState icon="handshake" title="assets.handover.empty" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
