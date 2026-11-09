"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MyCorrespondenceActionsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<CorrespondenceLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    correspondenceApi
      .myActions({ per_page: 50 })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("correspondence.myActions.title")}
        subtitle={t("correspondence.myActions.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.myActions.title") }]} />}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3">{t("correspondence.col.reference")}</th>
              <th className="px-4 py-3">{t("correspondence.col.subject")}</th>
              <th className="px-4 py-3">{t("correspondence.col.status")}</th>
              <th className="px-4 py-3">{t("correspondence.col.deadline")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">{t("common.loading")}</td></tr>
            )}
            {!loading && items.length === 0 && (
              <TableEmpty colSpan={4} title={t("correspondence.myActions.empty")} />
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/correspondence/${item.id}`} className="font-medium text-primary">
                    {item.registry_reference || item.reference_number || `#${item.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3"><span className="badge-muted">{item.status}</span></td>
                <td className="px-4 py-3 text-neutral-500">{item.final_deadline || item.internal_deadline || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
