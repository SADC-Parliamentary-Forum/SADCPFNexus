"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetLifecycleApi, assetsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Checkout = {
  id: number;
  purpose?: string | null;
  expected_return_at?: string | null;
  returned_at?: string | null;
  asset?: { id: number; tag_number?: string; name?: string };
  borrower?: { id: number; name?: string };
};

export default function AssetCheckoutsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Checkout[]>([]);

  async function load() {
    const r = await assetLifecycleApi.checkouts({ open: true, per_page: 50 });
    const payload = r.data as { data?: Checkout[] } & Checkout[];
    setRows(Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.checkout.title"
        subtitle="assets.checkout.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.checkout.title") }]} />}
      />
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Borrower</th>
              <th>Purpose</th>
              <th>Expected return</th>
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
                <td>{row.borrower?.name ?? "—"}</td>
                <td>{row.purpose ?? "—"}</td>
                <td>{row.expected_return_at ?? "—"}</td>
                <td>
                  {row.asset?.id && !row.returned_at && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={async () => {
                        await assetsApi.returnCheckout(row.asset!.id);
                        await load();
                      }}
                    >
                      {t("assets.checkout.return")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <TableEmpty colSpan={5} title={t("assets.checkout.empty")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
