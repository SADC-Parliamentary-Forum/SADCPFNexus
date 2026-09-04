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
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    assetLabelsApi.templates().then((r) => {
      const rows = (r.data as { data?: Template[] }).data ?? [];
      setTemplates(rows);
      if (rows[0]) setTemplateId(rows[0].id);
    }).catch(() => setTemplates([]));
    assetsApi.list({ per_page: 100 }).then((r) => {
      setAssets((r.data as { data?: Asset[] }).data ?? []);
    }).catch(() => setAssets([]));
    assetLabelsApi.reprintQueue().then((r) => {
      setReprint((r.data as { data?: Asset[] }).data ?? []);
    }).catch(() => setReprint([]));
  }, []);

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
      setMsg(t("assets.labels.printSelected"));
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
        <label className="text-sm">{t("common.filter")}
          <select className="input mt-1" value={templateId} onChange={(e) => setTemplateId(Number(e.target.value))}>
            {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
        </label>
        <Button type="button" onClick={() => printSelected(false)}>{t("assets.labels.printSelected")}</Button>
        <Button type="button" onClick={() => printSelected(true)}>{t("assets.labels.reprintQueue")}</Button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th></th><th>Tag</th><th>Name</th><th>Status</th></tr></thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(asset.id)}
                    onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, asset.id] : cur.filter((id) => id !== asset.id))}
                  />
                </td>
                <td>{asset.tag_number || asset.asset_code}</td>
                <td>{asset.name}</td>
                <td>{asset.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold">{t("assets.labels.reprintQueue")}</h2>
      <ul className="card p-4 text-sm">
        {reprint.map((asset) => <li key={asset.id}>{asset.tag_number || asset.asset_code} — {asset.name}</li>)}
        {reprint.length === 0 && <li>{t("common.noResults")}</li>}
      </ul>
    </div>
  );
}
