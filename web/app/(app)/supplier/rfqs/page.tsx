"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function SupplierRfqsPage() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-rfqs"],
    queryFn: () => supplierPortalApi.rfqs().then((response) => response.data.data),
  });

  if (isLoading) return <div className="card p-6">{t("supplier.rfqs.loading")}</div>;
  if (isError || !data) return <div className="card p-6">{t("supplier.rfqs.loadFailed")}</div>;

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={t("supplier.dashboard.rfqs")}
        subtitle={t("supplier.rfqs.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("supplier.dashboard.rfqs") }]} />}
      />

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>{t("leave.certifyQueue.col.reference")}</th>
              <th>{t("assignments.handover.colTitle")}</th>
              <th>{t("supplier.rfqs.col.deadline")}</th>
              <th>{t("assignments.handover.colStatus")}</th>
              <th>{t("supplier.rfqs.col.quote")}</th>
              <th className="text-right">{t("supplier.rfqs.col.action")}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <TableEmpty colSpan={6} title={t("supplier.rfqs.empty")} />
            ) : (
              data.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="font-mono text-xs text-neutral-600">{invitation.procurement_request?.reference_number}</td>
                  <td>
                    <div className="space-y-1">
                      <p className="font-medium text-neutral-900">{invitation.procurement_request?.title}</p>
                      <div className="flex flex-wrap gap-1">
                        {(invitation.procurement_request?.supplierCategories ?? []).map((category) => (
                          <span key={category.id} className="badge badge-primary">
                            {category.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-neutral-600">
                    {invitation.procurement_request?.rfq_deadline ? formatDateShort(invitation.procurement_request.rfq_deadline) : t("supplier.rfqs.open")}
                  </td>
                  <td><span className="badge badge-muted">{invitation.status}</span></td>
                  <td className="text-sm text-neutral-600">{invitation.quote ? t("supplier.rfqs.submitted") : t("supplier.rfqs.pending")}</td>
                  <td className="text-right">
                    <Link href={`/supplier/rfqs/${invitation.procurement_request_id}`} className="btn-secondary text-sm py-1 px-2">
                      {t("leave.certifyQueue.view")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
