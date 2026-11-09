"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function SupplierPurchaseOrdersPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-purchase-orders"],
    queryFn: () => supplierPortalApi.purchaseOrders().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">{t("supplier.purchaseOrders.loading")}</div>;
  if (isError || !data) return <div className="card p-6">{t("supplier.purchaseOrders.loadFailed")}</div>;

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={t("supplier.purchaseOrders.title")}
        subtitle={t("supplier.purchaseOrders.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("supplier.purchaseOrders.title") }]} />}
      />

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>{t("leave.certifyQueue.col.reference")}</th>
              <th>{t("supplier.purchaseOrders.col.request")}</th>
              <th>{t("supplier.purchaseOrders.col.total")}</th>
              <th>{t("assignments.handover.colStatus")}</th>
              <th>{t("supplier.purchaseOrders.col.issued")}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <TableEmpty colSpan={5} title={t("supplier.purchaseOrders.empty")} />
            ) : (
              data.map((po) => (
                <tr key={po.id}>
                  <td className="font-mono text-xs text-neutral-600">{po.reference_number}</td>
                  <td>
                    {po.procurement_request ? (
                      <Link href={`/procurement/${po.procurement_request.id}`} className="btn-secondary text-xs py-1 px-2">
                        {po.procurement_request.reference_number}
                      </Link>
                    ) : "-"}
                  </td>
                  <td>{po.currency} {(po.total_amount ?? 0).toLocaleString()}</td>
                  <td><span className="badge badge-muted">{po.status}</span></td>
                  <td>{po.issued_at ? formatDateShort(po.issued_at) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
