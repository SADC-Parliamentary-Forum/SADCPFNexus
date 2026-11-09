"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function BidSubmissionsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "bid-submissions"],
    queryFn: () => tendersApi.bidSubmissions().then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={t("procurement.bidSubmissions.title")}
        subtitle={t("procurement.bidSubmissions.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("procurement.bidSubmissions.title") }]} />}
      />
      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-4 py-3">{t("procurement.col.tender")}</th>
                <th className="px-4 py-3">{t("procurement.col.vendor")}</th>
                <th className="px-4 py-3">{t("procurement.col.version")}</th>
                <th className="px-4 py-3">{t("procurement.col.amount")}</th>
                <th className="px-4 py-3">{t("procurement.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row, i) => (
                <tr key={i} className="border-b border-neutral-50">
                  <td className="px-4 py-3">{String(row.tender_reference ?? "")}</td>
                  <td className="px-4 py-3">{String(row.vendor_name ?? "")}</td>
                  <td className="px-4 py-3">{String(row.version ?? "")}</td>
                  <td className="px-4 py-3">
                    {row.financials_sealed ? <span className="text-neutral-400 italic">{t("procurement.bidSubmissions.sealed")}</span> : String(row.quoted_amount ?? "—")}
                  </td>
                  <td className="px-4 py-3">{String(row.status ?? "")}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <TableEmpty colSpan={5} title={t("procurement.bidSubmissions.empty")} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
