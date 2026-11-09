"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { assetsApi, type Asset } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetsIntakePage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = canManageAssets(getStoredUser());
  const { t } = useI18n();

  useEffect(() => {
    assetsApi.list({ status: "pending", per_page: 100 })
      .then((r) => setItems(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title={t("assets.intake.title")}
        subtitle={t("assets.intake.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.intake.title" }]} />}
      />
        <Link href="/assets" className="btn-secondary">{t("assets.intake.fullRegister")}</Link>
      </div>
      {loading ? <p>{t("common.loading")}</p> : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("assets.intake.code")}</th>
                <th>{t("assets.intake.name")}</th>
                <th>{t("assets.intake.category")}</th>
                <th>{t("assets.intake.estValue")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <TableEmpty colSpan={5} title={t("assets.intake.empty")} />
              )}
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{a.asset_code}</td>
                  <td>{a.name}</td>
                  <td>{a.category}</td>
                  <td>{a.purchase_value ?? "—"}</td>
                  <td>
                    {canManage && (
                      <Link href={`/assets?status=pending`} className="btn-primary text-xs">{t("assets.intake.capitalise")}</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
