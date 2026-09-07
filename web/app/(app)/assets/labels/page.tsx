"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { assetLabelsApi, assetsApi, type Asset, type AssetLabelTemplate } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RowCheckbox, SelectAllCheckbox, selectionColumnClass } from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { openPdfBlob } from "@/lib/openPdfBlob";

export default function AssetLabelsPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<AssetLabelTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reprint, setReprint] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const getId = useCallback((asset: Asset) => asset.id, []);
  const selection = useRowSelection({ rows: assets, getId });
  const reprintIds = reprint.map((asset) => asset.id);
  const allReprintSelected = reprintIds.length > 0 && reprintIds.every((id) => selection.isSelected(id));
  const someReprintSelected = reprintIds.some((id) => selection.isSelected(id));

  useEffect(() => {
    assetLabelsApi.templates().then((r) => {
      const rows = r.data.data ?? [];
      setTemplates(rows);
      if (rows[0]) setTemplateId(rows[0].id);
    }).catch(() => {
      setTemplates([]);
      setError(t("assets.labels.loadTemplatesFailed"));
    });
    assetLabelsApi.reprintQueue().then((r) => {
      setReprint((r.data as { data?: Asset[] }).data ?? []);
    }).catch(() => setReprint([]));
  }, [t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      assetsApi.list({ per_page: 100, search: search.trim() || undefined }).then((r) => {
        setAssets((r.data as { data?: Asset[] }).data ?? []);
      }).catch(() => setAssets([]));
    }, search ? 200 : 0);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function toggleAllReprint() {
    selection.setSelected((prev) => {
      const next = new Set(prev);
      const allOn = reprintIds.length > 0 && reprintIds.every((id) => next.has(id));
      if (allOn) reprintIds.forEach((id) => next.delete(id));
      else reprintIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function printSelected(isReprint = false) {
    const selected = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (!templateId) {
      setError(t("assets.labels.needTemplate"));
      return;
    }
    if (selected.length === 0) {
      setError(t("assets.labels.needSelection"));
      return;
    }
    setError(null);
    setMsg(null);
    setPrinting(true);
    try {
      const res = await assetLabelsApi.print({
        asset_ids: selected,
        template_id: templateId,
        reprint: isReprint,
        reprint_reason: isReprint ? "MANUAL_REPRINT" : null,
      });
      const blob = res.data as Blob;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = await openPdfBlob(blob, `asset-labels-${Date.now()}.pdf`);
      setPdfUrl(url);
      setMsg(isReprint ? t("assets.labels.reprintDone") : t("assets.labels.printDone"));
    } catch (err: unknown) {
      let message = t("common.error");
      if (err instanceof Error && err.message) message = err.message;
      if (isAxiosError(err) && err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text()) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          /* keep */
        }
      }
      setError(message);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.labels.title")}
          subtitle={t("assets.labels.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.labels.title" }]} />}
          actions={
            <Link href="/assets/labels/templates" className="btn-secondary">
              {t("assets.labels.editTemplates")}
            </Link>
          }
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">{t("common.search")}
          <input className="input mt-1" name="asset-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="text-sm">{t("assets.labels.template")}
          <select
            className="input mt-1 min-w-[16rem]"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
          >
            {templates.length === 0 && <option value="">{t("assets.labels.noTemplates")}</option>}
            {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={printing || assets.length === 0}
          onClick={selection.toggleAllSelectable}
        >
          {selection.allSelectableSelected ? t("assets.labels.clearSelection") : t("assets.labels.selectAll")}
        </Button>
        <Button type="button" disabled={printing} onClick={() => printSelected(false)}>
          {printing ? t("assets.labels.printing") : t("assets.labels.printSelected")}
        </Button>
        <Button type="button" variant="secondary" disabled={printing} onClick={() => printSelected(true)}>
          {t("assets.labels.reprint")}
        </Button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className={selectionColumnClass.th}>
                <SelectAllCheckbox
                  checked={selection.allSelectableSelected}
                  indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                  onChange={selection.toggleAllSelectable}
                  disabled={assets.length === 0 || printing}
                  label={t("assets.labels.selectAll")}
                />
              </th>
              <th>{t("assets.labels.colTag")}</th>
              <th>{t("assets.labels.colName")}</th>
              <th>{t("assets.labels.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td className={selectionColumnClass.td}>
                  <RowCheckbox
                    checked={selection.isSelected(asset.id)}
                    onChange={() => selection.toggle(asset.id)}
                    label={asset.tag_number || asset.asset_code}
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

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t("assets.labels.reprintQueue")}</h2>
        <SelectAllCheckbox
          checked={allReprintSelected}
          indeterminate={someReprintSelected && !allReprintSelected}
          onChange={toggleAllReprint}
          disabled={reprint.length === 0 || printing}
          label={t("assets.labels.selectAllReprint")}
        />
      </div>
      <ul className="card p-4 text-sm">
        {reprint.map((asset) => (
          <li key={asset.id} className="flex items-center gap-2">
            <RowCheckbox
              checked={selection.isSelected(asset.id)}
              onChange={() => selection.toggle(asset.id)}
              label={asset.tag_number || asset.asset_code}
            />
            {asset.tag_number || asset.asset_code} — {asset.name}
          </li>
        ))}
        {reprint.length === 0 && <li>{t("common.noResults")}</li>}
      </ul>

      {pdfUrl && (
        <section className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold">{t("assets.labels.preview")}</h3>
            <a href={pdfUrl} download="asset-labels.pdf" className="btn-secondary text-sm">{t("assets.labels.downloadPdf")}</a>
          </div>
          <iframe title={t("assets.labels.preview")} src={pdfUrl} className="h-[70vh] w-full border-0" />
        </section>
      )}
    </div>
  );
}
