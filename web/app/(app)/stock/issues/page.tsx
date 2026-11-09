"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockIssuesApi, type StockIssue } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockIssuesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockIssue[]>([]);

  const load = useCallback(() => {
    stockIssuesApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", t("stock.issues.loadFailed")));
  }, [toast, t]);

  useEffect(() => { load(); }, [load]);

  const ack = async (id: number) => {
    try {
      await stockIssuesApi.acknowledge(id);
      toast("success", t("stock.issues.acknowledged"));
      load();
    } catch {
      toast("error", t("stock.issues.acknowledgeFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.issues.title")}
        subtitle={t("stock.issues.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.issues.title") }]} />}
      />
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">{t("stock.common.voucher")}</th>
            <th className="px-4 py-2">{t("stock.common.date")}</th>
            <th className="px-4 py-2">{t("stock.common.issuedTo")}</th>
            <th className="px-4 py-2">{t("stock.common.status")}</th>
            <th className="px-4 py-2">{t("stock.common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 font-medium">{r.voucher_number}</td>
              <td className="px-4 py-2">{formatDateShort(r.issue_date)}</td>
              <td className="px-4 py-2">{r.issued_to_user?.name ?? "—"}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2">
                {r.status === "issued" && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => ack(r.id)}>{t("stock.issues.acknowledge")}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
