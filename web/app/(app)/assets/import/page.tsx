"use client";

import { FormEvent, useEffect, useState } from "react";
import { assetImportApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Counts = Record<string, number>;
type StagingRow = {
  id: number;
  asset_tag: string | null;
  asset_name: string | null;
  serial_number: string | null;
  model: string | null;
  legacy_location: string | null;
  proposed_action: string;
  review_status: string;
  blocking: boolean;
  current_book_value: string | null;
  original_cost: string | null;
  data_quality_flags?: string[];
  source_refs?: { raw_id: number; kind: string }[];
};

export default function AssetImportPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"legacy" | "template">("legacy");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [filter, setFilter] = useState("pending");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function loadStaging(id: number, nextFilter = filter) {
    const r = await assetImportApi.staging(id, { filter: nextFilter, per_page: 50 });
    const data = (r.data as { data?: StagingRow[] }).data ?? [];
    setRows(Array.isArray(data) ? data : []);
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("mode", mode);
    try {
      const res = await assetImportApi.upload(form);
      const payload = res.data.data as { batch?: { id: number; status: string }; counts?: Counts };
      setBatchId(payload.batch?.id ?? null);
      setBatchStatus(payload.batch?.status ?? "");
      setCounts(payload.counts ?? null);
      setMsg(res.data.message);
      if (payload.batch?.id) await loadStaging(payload.batch.id);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (batchId) loadStaging(batchId).catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, batchId]);

  async function approveReady() {
    if (!batchId) return;
    setBusy(true);
    try {
      const r = await assetImportApi.approve(batchId, { all_non_blocking: true });
      setMsg((r.data as { message?: string }).message ?? t("assets.import.approveReady"));
      await loadStaging(batchId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!batchId) return;
    setBusy(true);
    try {
      const r = await assetImportApi.commit(batchId, { approve_non_blocking: true });
      const payload = r.data as { message?: string; data?: { batch?: { status: string } } };
      setMsg(payload.message ?? t("assets.import.commit"));
      setBatchStatus(payload.data?.batch?.status ?? batchStatus);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function exclude(row: StagingRow) {
    if (!batchId) return;
    const reason = window.prompt(t("assets.import.exclude")) || "Excluded during review";
    await assetImportApi.exclude(batchId, row.id, reason);
    await loadStaging(batchId);
  }

  async function showRaw(row: StagingRow) {
    if (!batchId || !row.source_refs?.[0]?.raw_id) return;
    const r = await assetImportApi.raw(batchId, row.source_refs[0].raw_id);
    setRaw((r.data as { data?: unknown }).data ?? r.data);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.import.title")}
          subtitle={t("assets.import.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.import.title") }]} />}
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onUpload} className="card space-y-3 p-4">
        <div className="flex gap-3">
          <label className="text-sm">
            <input type="radio" checked={mode === "legacy"} onChange={() => setMode("legacy")} /> {t("assets.import.legacy")}
          </label>
          <label className="text-sm">
            <input type="radio" checked={mode === "template"} onChange={() => setMode("template")} /> {t("assets.import.template")}
          </label>
        </div>
        {mode === "legacy" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">{t("assets.import.categoryFile")}<input className="input mt-1" type="file" name="category" accept=".xls,.xlsx" required /></label>
            <label className="text-sm">{t("assets.import.locationFile")}<input className="input mt-1" type="file" name="location" accept=".xls,.xlsx" required /></label>
            <label className="text-sm">{t("assets.import.stagingFile")}<input className="input mt-1" type="file" name="staging" accept=".xlsx" /></label>
          </div>
        ) : (
          <label className="text-sm">{t("assets.import.template")}<input className="input mt-1" type="file" name="template" accept=".xlsx" required /></label>
        )}
        <Button type="submit" disabled={busy}>{busy ? t("common.loading") : t("assets.import.upload")}</Button>
      </form>

      {counts && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="card p-3">
              <div className="text-xs text-neutral-500">{k.replaceAll("_", " ")}</div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}

      {batchId && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={approveReady} disabled={busy}>{t("assets.import.approveReady")}</Button>
          <Button type="button" onClick={commit} disabled={busy}>{t("assets.import.commit")}</Button>
          <p className="text-xs text-neutral-500 self-center">{t("assets.import.commitHint")} {batchStatus}</p>
        </div>
      )}

      <div className="flex gap-2">
        {["pending", "blocking", "missing_serial", "approved", "excluded"].map((f) => (
          <button key={f} type="button" className={`text-sm ${filter === f ? "font-semibold" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tag</th><th>Name</th><th>Serial</th><th>Location</th><th>Action</th><th>Status</th><th>Cost</th><th>NBV</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.blocking ? "bg-red-50" : undefined}>
                <td>{row.asset_tag}</td>
                <td>{row.asset_name}</td>
                <td>{row.serial_number ?? "—"}</td>
                <td>{row.legacy_location ?? "—"}</td>
                <td>{row.proposed_action}</td>
                <td>{row.review_status}</td>
                <td>{row.original_cost ?? "—"}</td>
                <td>{row.current_book_value ?? "—"}</td>
                <td className="space-x-2">
                  <button type="button" onClick={() => showRaw(row)}>{t("assets.import.rawJson")}</button>
                  <button type="button" onClick={() => exclude(row)}>{t("assets.import.exclude")}</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9}>{t("common.noResults")}</td></tr>}
          </tbody>
        </table>
      </div>

      {raw != null && (
        <pre className="card overflow-auto p-3 text-xs">{JSON.stringify(raw, null, 2)}</pre>
      )}
    </div>
  );
}
