"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetLifecycleApi, assetsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Incident = {
  id: number;
  type: string;
  status: string;
  police_case_number?: string | null;
  asset?: { id: number; tag_number?: string; name?: string; status?: string };
};

export default function AssetIncidentsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Incident[]>([]);

  async function load() {
    const r = await assetLifecycleApi.incidents();
    const payload = r.data as { data?: Incident[] };
    setRows(payload.data ?? []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.incidents.title"
        subtitle="assets.incidents.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.incidents.title") }]} />}
      />
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Status</th>
              <th>Police case</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.asset?.id ? (
                    <Link href={`/assets/${row.asset.id}`} className="text-primary">
                      {row.asset.tag_number || row.asset.name}
                    </Link>
                  ) : "—"}
                </td>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.police_case_number ?? "—"}</td>
                <td>
                  {row.asset?.id && row.status === "open" && (row.type === "lost" || row.type === "stolen") && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={async () => {
                        await assetsApi.reportFound(row.asset!.id, { notes: "Recovered" });
                        await load();
                      }}
                    >
                      {t("assets.incidents.recover")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <TableEmpty colSpan={5} title={t("assets.incidents.empty")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
