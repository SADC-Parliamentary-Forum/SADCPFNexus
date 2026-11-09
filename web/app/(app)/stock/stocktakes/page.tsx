"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stocktakesApi, type Stocktake } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StocktakesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<Stocktake[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    setLoading(true);
    stocktakesApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", t("stock.stocktakes.loadFailed")))
      .finally(() => setLoading(false));
  }, [toast, t]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      toast("error", t("stock.stocktakes.nameRequired"));
      return;
    }
    try {
      const res = await stocktakesApi.create({
        name: name.trim(),
        count_date: countDate,
        include_all_active: true,
      });
      toast("success", t("stock.stocktakes.created"));
      window.location.href = `/stock/stocktakes/${res.data.data.id}`;
    } catch {
      toast("error", t("stock.stocktakes.createFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("stock.stocktakes.title")}
        subtitle={t("stock.stocktakes.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.stocktakes.title") }]} />}
      />
      </div>

      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="stock-stocktakes-name" className="block text-xs font-semibold mb-1">{t("stock.common.name")}</label>
            <input id="stock-stocktakes-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("stock.stocktakes.namePlaceholder")} />
          </div>
          <div>
            <label htmlFor="stock-stocktakes-count-date" className="block text-xs font-semibold mb-1">{t("stock.stocktakes.countDate")}</label>
            <input id="stock-stocktakes-count-date" type="date" className="form-input" value={countDate} onChange={(e) => setCountDate(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>{t("stock.stocktakes.start")}</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading")}</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">{t("stock.common.reference")}</th>
              <th className="px-4 py-2">{t("stock.common.name")}</th>
              <th className="px-4 py-2">{t("stock.common.date")}</th>
              <th className="px-4 py-2">{t("stock.common.status")}</th>
              <th className="px-4 py-2">{t("stock.common.lines")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/stock/stocktakes/${r.id}`} className="btn-secondary text-xs py-1 px-2">{r.reference_number}</Link>
                </td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{formatDateShort(r.count_date)}</td>
                <td className="px-4 py-2 capitalize">{r.status.replace("_", " ")}</td>
                <td className="px-4 py-2">{r.lines_count ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
