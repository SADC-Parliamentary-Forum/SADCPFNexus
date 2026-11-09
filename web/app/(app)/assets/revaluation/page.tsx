"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { AssetPicker } from "@/components/assets/AssetPicker";
import type { Asset } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type AssetOption = { id: number; asset_code: string; name: string; book_value?: number };
type Revaluation = {
  id: number;
  reference: string;
  status: string;
  previous_book_value?: number;
  proposed_value: number;
  reason: string;
  effective_date: string;
  asset?: AssetOption;
};

export default function AssetRevaluationPage() {
  const [rows, setRows] = useState<Revaluation[]>([]);
  const { t } = useI18n();
  const [pickedAsset, setPickedAsset] = useState<Asset | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    asset_id: "",
    proposed_value: "",
    reason: "",
    effective_date: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const r = await api.get<{ data: Revaluation[] }>("/asset-revaluations");
    const body = r.data as { data?: Revaluation[] };
    setRows(Array.isArray(body.data) ? body.data : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/asset-revaluations", {
        asset_id: Number(form.asset_id),
        proposed_value: Number(form.proposed_value),
        reason: form.reason,
        effective_date: form.effective_date,
      });
      setMsg(t("assets.revaluation.requested"));
      setForm({ asset_id: "", proposed_value: "", reason: "", effective_date: new Date().toISOString().slice(0, 10) });
      setPickedAsset(null);
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t("assets.revaluation.requestFailed"));
    }
  }

  async function approve(id: number) {
    await api.post(`/asset-revaluations/${id}/approve`, { comments: "Approved" });
    setMsg(t("assets.revaluation.approved"));
    await load();
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header flex items-start justify-between gap-3">
        <ModulePageHeader
        title={t("assets.revaluation.title")}
        subtitle={t("assets.revaluation.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.revaluation.title" }]} />}
      />
        <Link href="/assets/disposal" className="btn-secondary btn-sm">{t("assets.revaluation.disposals")}</Link>
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={create} className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">{t("assets.revaluation.new")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <AssetPicker
            id="assets-revaluation-asset-setform-select-bv"
            label={t("assets.revaluation.asset")}
            value={pickedAsset}
            onSelect={(asset) => {
              setPickedAsset(asset);
              setForm((current) => ({ ...current, asset_id: asset ? String(asset.id) : "" }));
            }}
            status="live"
            required
            hint={pickedAsset && pickedAsset.book_value != null ? t("assets.revaluation.currentBookValue", { value: pickedAsset.book_value }) : undefined}
            dataTestId="revaluation-asset"
          />
          <label htmlFor="assets-revaluation-proposed-value-setform" className="block text-sm">
            {t("assets.revaluation.proposedValue")}
            <input id="assets-revaluation-proposed-value-setform" type="number" min="0" step="0.01" required className="form-input mt-1 w-full" value={form.proposed_value} onChange={(e) => setForm({ ...form, proposed_value: e.target.value })} />
          </label>
          <label htmlFor="assets-revaluation-effective-date-setform" className="block text-sm">
            {t("assets.revaluation.effectiveDate")}
            <input id="assets-revaluation-effective-date-setform" type="date" required className="form-input mt-1 w-full" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
          </label>
          <label htmlFor="assets-revaluation-reason-setform" className="block text-sm md:col-span-2">
            {t("assets.revaluation.reason")}
            <textarea id="assets-revaluation-reason-setform" required rows={2} className="form-input mt-1 w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="btn-primary btn-sm">{t("common.submit")}</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
        <table className="data-table">
          <thead>
            <tr><th>{t("assets.revaluation.reference")}</th><th>{t("assets.revaluation.asset")}</th><th>{t("assets.revaluation.previous")}</th><th>{t("assets.revaluation.proposed")}</th><th>{t("assets.revaluation.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference}</td>
                <td>{r.asset?.asset_code ?? "—"}</td>
                <td>{r.previous_book_value ?? "—"}</td>
                <td>{r.proposed_value}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "pending" && (
                    <button type="button" className="btn-primary text-xs" onClick={() => approve(r.id)}>{t("common.approve")}</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <TableEmpty colSpan={6} title={t("assets.revaluation.empty")} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
