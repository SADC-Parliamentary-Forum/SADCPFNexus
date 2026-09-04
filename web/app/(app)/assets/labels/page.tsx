"use client";

import { useEffect, useState } from "react";
import { assetLabelsApi, assetsApi, type Asset } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Template = { id: number; name: string; kind: string; code: string };

export default function AssetLabelsPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [reprint, setReprint] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    assetLabelsApi.templates().then((r) => {
      const rows = (r.data as { data?: Template[] }).data ?? [];
      setTemplates(rows);
      if (rows[0]) setTemplateId(rows[0].id);
    }).catch(() => setTemplates([]));
    assetLabelsApi.reprintQueue().then((r) => {
      setReprint((r.data as { data?: Asset[] }).data ?? []);
    }).catch(() => setReprint([]));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      assetsApi.list({ per_page: 100, search: search.trim() || undefined }).then((r) => {
        setAssets((r.data as { data?: Asset[] }).data ?? []);
      }).catch(() => setAssets([]));
    }, search ? 200 : 0);
    return () => window.clearTimeout(handle);
  }, [search]);

  async function printSelected(isReprint = false) {
    if (!templateId || selected.length === 0) return;
    setError(null);
    try {
      const res = await assetLabelsApi.print({
        asset_ids: selected,
        template_id: templateId,
        reprint: isReprint,
        reprint_reason: isReprint ? "MANUAL_REPRINT" : null,
      });
      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setMsg(isReprint ? t("assets.labels.reprint") : t("assets.labels.printSelected"));
    } catch {
      setError(t("common.error"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.labels.title")}
          subtitle={t("assets.labels.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.labels.title") }]} />}
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">{t("common.search")}
          <input className="input mt-1" name="asset-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="text-sm">{t("common.filter")}
          <select className="input mt-1" value={templateId} onChange={(e) => setTemplateId(Number(e.target.value))}>
            {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
        </label>
        <Button type="button" onClick={() => printSelected(false)}>{t("assets.labels.printSelected")}</Button>
        <Button type="button" variant="secondary" onClick={() => printSelected(true)}>{t("assets.labels.reprint")}</Button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>{t("assets.labels.colTag")}</th>
              <th>{t("assets.labels.colName")}</th>
              <th>{t("assets.labels.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={asset.tag_number || asset.asset_code}
                    checked={selected.includes(asset.id)}
                    onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, asset.id] : cur.filter((id) => id !== asset.id))}
                  />
                </td>
                <td>{asset.tag_number || asset.asset_code}</td>
                <td>{asset.name}</td>
                <td>{asset.label_status || asset.status}</td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan={4}>{t("common.noResults")}</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold">{t("assets.labels.reprintQueue")}</h2>
      <ul className="card p-4 text-sm">
        {reprint.map((asset) => (
          <li key={asset.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={asset.tag_number || asset.asset_code}
              checked={selected.includes(asset.id)}
              onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, asset.id] : cur.filter((id) => id !== asset.id))}
            />
            {asset.tag_number || asset.asset_code} — {asset.name}
          </li>
        ))}
        {reprint.length === 0 && <li>{t("common.noResults")}</li>}
      </ul>
    </div>
  );
}
