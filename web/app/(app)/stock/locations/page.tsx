"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockLocationsApi, type StockLocation } from "@/lib/api";
import { canManageStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockLocationsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<StockLocation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockLocationsApi.list()
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => toast("error", t("stock.locations.loadFailed")))
      .finally(() => setLoading(false));
  }, [toast, t]);

  useEffect(() => {
    setCanManage(canManageStock(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!code.trim() || !name.trim()) {
      toast("error", t("stock.common.codeNameRequired"));
      return;
    }
    try {
      await stockLocationsApi.create({ code: code.trim(), name: name.trim(), description: description.trim() || undefined });
      toast("success", t("stock.locations.created"));
      setCode(""); setName(""); setDescription("");
      load();
    } catch {
      toast("error", t("stock.locations.createFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.locations.title")}
        subtitle={t("stock.locations.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.locations.title") }]} />}
      />

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="stock-locations-code" className="block text-xs font-semibold mb-1">{t("stock.common.code")}</label>
            <input id="stock-locations-code" className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAIN" />
          </div>
          <div>
            <label htmlFor="stock-locations-name" className="block text-xs font-semibold mb-1">{t("stock.common.name")}</label>
            <input id="stock-locations-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("stock.locations.namePlaceholder")} />
          </div>
          <div>
            <label htmlFor="stock-locations-description" className="block text-xs font-semibold mb-1">{t("stock.common.description")}</label>
            <input id="stock-locations-description" className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>{t("stock.locations.add")}</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading")}</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">{t("stock.common.code")}</th>
              <th className="px-4 py-2">{t("stock.common.name")}</th>
              <th className="px-4 py-2">{t("stock.common.description")}</th>
              <th className="px-4 py-2">{t("stock.common.active")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2 text-neutral-500">{l.description || "—"}</td>
                <td className="px-4 py-2">{l.is_active ? t("stock.common.yes") : t("stock.common.no")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/stock" className="btn-secondary text-sm">{t("stock.common.backToRegister")}</Link>
    </div>
  );
}
