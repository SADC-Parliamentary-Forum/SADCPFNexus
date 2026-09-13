"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { assetMovementsApi, type AssetMovement } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";

export default function AssetTransfersPage() {
  const [rows, setRows] = useState<AssetMovement[]>([]);

  useEffect(() => {
    assetMovementsApi.list({ movement_type: "transfer", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title="Asset Transfers"
        subtitle="Custody transfers and movement log. Assignment history is immutable on the API."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Asset Transfers" }]} />}
      />
        <Link href="/assets/movement/new" className="btn-primary">Record movement</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.movement_date}</td>
                <td>{m.asset?.asset_code ?? m.asset_id}</td>
                <td>{m.from_user?.name ?? "—"}</td>
                <td>{m.to_user?.name ?? "—"}</td>
                <td>{m.reason ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <TableEmpty colSpan={5} title="No transfer movements yet. Use Register → assign/transfer actions." />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
