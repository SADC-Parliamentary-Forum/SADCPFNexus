"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockUnitsApi, type StockUnit } from "@/lib/api";
import { canConfigureStockCatalogue, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockUnitsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<StockUnit[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockUnitsApi.list()
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => toast("error", t("stock.units.loadFailed")))
      .finally(() => setLoading(false));
  }, [toast, t]);

  useEffect(() => {
    setCanManage(canConfigureStockCatalogue(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!code.trim() || !name.trim()) {
      toast("error", t("stock.common.codeNameRequired"));
      return;
    }
    try {
      await stockUnitsApi.create({ code: code.trim(), name: name.trim() });
      toast("success", t("stock.units.created"));
      setCode(""); setName("");
      load();
    } catch {
      toast("error", t("stock.units.createFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.units.title")}
        subtitle={t("stock.units.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.units.title") }]} />}
      />

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="stock-units-code" className="block text-xs font-semibold mb-1">{t("stock.common.code")}</label>
            <input id="stock-units-code" className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("stock.units.codePlaceholder")} />
          </div>
          <div>
            <label htmlFor="stock-units-name" className="block text-xs font-semibold mb-1">{t("stock.common.name")}</label>
            <input id="stock-units-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("stock.units.namePlaceholder")} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>{t("stock.addUnit")}</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="straighten"
            title={t("stock.units.emptyTitle")}
            description={t("stock.units.emptyHint")}
          />
        </div>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">{t("stock.common.code")}</th>
              <th className="px-4 py-2">{t("stock.common.name")}</th>
              <th className="px-4 py-2">{t("stock.common.active")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{u.code}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.is_active ? t("stock.common.yes") : t("stock.common.no")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/stock" className="btn-secondary text-sm">{t("stock.common.backToRegister")}</Link>
    </div>
  );
}
