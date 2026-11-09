"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function UnifiedInventoryRegisterPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["inventory", "unified-register"],
    queryFn: () => inventoryApi.unifiedRegister({ per_page: 50 }).then((r) => r.data.data ?? []),
  });
  const rows = query.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.unifiedRegister.title")}
        subtitle={t("stock.unifiedRegister.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.unifiedRegister.crumb") }]} />}
      />
      <div className="card overflow-x-auto p-4">
        {query.isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
        {query.isError && <p className="text-sm text-red-700">{t("stock.unifiedRegister.loadFailed")}</p>}
        {!query.isLoading && !query.isError && (
          <table className="min-w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3">{t("stock.common.source")}</th>
                <th className="py-2 pr-3">{t("stock.common.label")}</th>
                <th className="py-2 pr-3">{t("stock.common.asset")}</th>
                <th className="py-2 pr-3">{t("stock.common.stockItem")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{String(r.source ?? "—")}</td>
                  <td className="py-2 pr-3">{String(r.label ?? "—")}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.asset_id ? String(r.asset_id) : "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.stock_item_id ? String(r.stock_item_id) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <TableEmpty colSpan={4} title={t("stock.unifiedRegister.empty")} />
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
