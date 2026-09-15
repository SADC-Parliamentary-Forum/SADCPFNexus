"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { assetLifecycleApi, assetMovementsApi, type AssetMovement } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Transfer = {
  id: number;
  status: string;
  reason?: string | null;
  asset?: { id: number; tag_number?: string; name?: string };
  from_user?: { id: number; name?: string };
  to_user?: { id: number; name?: string };
};

export default function AssetTransfersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AssetMovement[]>([]);
  const [handshake, setHandshake] = useState<Transfer[]>([]);

  async function loadHandshake() {
    const r = await assetLifecycleApi.transfers({ per_page: 50 });
    const payload = r.data as { data?: Transfer[] };
    setHandshake(payload.data ?? []);
  }

  useEffect(() => {
    assetMovementsApi.list({ movement_type: "transfer", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]));
    loadHandshake().catch(() => setHandshake([]));
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
      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <h2 className="px-4 pt-4 text-sm font-semibold">{t("assets.transfer.pending")}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {handshake.map((row) => (
              <tr key={row.id}>
                <td>{row.asset?.tag_number || row.asset?.name || "—"}</td>
                <td>{row.from_user?.name ?? "—"}</td>
                <td>{row.to_user?.name ?? "—"}</td>
                <td>{row.status}</td>
                <td className="space-x-2">
                  {row.status === "pending_outgoing" && (
                    <button type="button" className="btn-secondary text-xs" onClick={async () => {
                      await assetLifecycleApi.confirmOutgoing(row.id);
                      await loadHandshake();
                    }}>{t("assets.transfer.confirmOutgoing")}</button>
                  )}
                  {(row.status === "pending_incoming" || row.status === "pending_outgoing") && (
                    <button type="button" className="btn-primary text-xs" onClick={async () => {
                      await assetLifecycleApi.acceptTransfer(row.id);
                      await loadHandshake();
                    }}>{t("assets.transfer.acceptIncoming")}</button>
                  )}
                </td>
              </tr>
            ))}
            {handshake.length === 0 && <TableEmpty colSpan={5} title={t("assets.checkout.empty")} />}
          </tbody>
        </table>
      </section>
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
