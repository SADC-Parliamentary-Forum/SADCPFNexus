"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { assetsApi, type Asset } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { AssetPicker } from "@/components/assets/AssetPicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type AssetOption = { id: number; asset_code: string; name: string; status: string; book_value?: number };
type Disposal = {
  id: number;
  reference: string;
  status: string;
  reason: string;
  method?: string | null;
  justification: string;
  estimated_value?: number | null;
  proceeds?: number | null;
  accounting_reference?: string | null;
  hod_comments?: string | null;
  finance_comments?: string | null;
  asset?: AssetOption;
  requester?: { id: number; name: string };
};

const REASONS = ["obsolete", "damaged", "lost", "stolen", "surplus", "other"] as const;
const METHODS = ["sale", "donation", "scrap", "write_off", "transfer"] as const;

export default function AssetDisposalPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="w-full min-w-0 space-y-5 text-sm text-neutral-500">{t("assets.disposal.loading")}</div>}>
      <AssetDisposalPageInner />
    </Suspense>
  );
}

function AssetDisposalPageInner() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const tv = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [rows, setRows] = useState<Disposal[]>([]);
  const [pickedAsset, setPickedAsset] = useState<Asset | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Disposal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    reason: "obsolete",
    method: "scrap",
    justification: "",
    estimated_value: "",
  });
  const [completeForm, setCompleteForm] = useState({
    method: "scrap",
    proceeds: "",
    accounting_reference: "",
  });

  async function load() {
    const r = await api.get<{ data: Disposal[] }>("/asset-disposals");
    const data = r.data as { data?: Disposal[] } & Disposal[];
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    setRows(list);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  useEffect(() => {
    const assetId = searchParams.get("asset");
    if (!assetId) return;
    setForm((current) => ({ ...current, asset_id: assetId }));
    setShowCreate(true);
    assetsApi.get(Number(assetId)).then((res) => {
      const asset = res.data as Asset;
      if (!asset?.id) return;
      setPickedAsset(asset);
    }).catch(() => undefined);
  }, [searchParams]);

  async function createDisposal(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api.post("/asset-disposals", {
        asset_id: Number(form.asset_id),
        reason: form.reason,
        method: form.method,
        justification: form.justification,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      });
      setMsg(t("assets.disposal.created"));
      setShowCreate(false);
      setForm({ asset_id: "", reason: "obsolete", method: "scrap", justification: "", estimated_value: "" });
      setPickedAsset(null);
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t("assets.disposal.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function advance(id: number, action: string, payload: Record<string, unknown> = {}) {
    setSaving(true);
    setErr(null);
    try {
      await api.post(`/asset-disposals/${id}/${action}`, payload);
      setMsg(tv(`assets.disposal.recorded.${action}`, `Disposal ${action} recorded.`)); // i18n-ignore
      setCompleteOpen(false);
      await load();
      if (selected?.id === id) {
        const r = await api.get<{ data: Disposal }>(`/asset-disposals/${id}`);
        setSelected((r.data as { data: Disposal }).data);
      }
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : tv(`assets.disposal.failed.${action}`, `Failed to ${action}.`)); // i18n-ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title={t("assets.disposal.title")}
        subtitle={t("assets.disposal.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.disposal.title" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/assets/revaluation" className="btn-secondary btn-sm">
            {t("assets.disposal.revaluations")}
          </Link>
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            {t("assets.disposal.new")}
          </button>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      {showCreate && (
        <form onSubmit={createDisposal}>
          <FormSection title={t("assets.disposal.createTitle")} icon="delete_forever" dense>
            <div className="space-y-3">
          <AssetPicker
            id="disposal-asset"
            label={t("assets.disposal.asset")}
            value={pickedAsset}
            onSelect={(asset) => {
              setPickedAsset(asset);
              setForm((current) => ({ ...current, asset_id: asset ? String(asset.id) : "" }));
            }}
            status="live"
            required
            dataTestId="disposal-asset"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label={t("assets.disposal.reason")} htmlFor="disposal-reason">
              <select id="disposal-reason" className="form-input w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{t(`assets.disposal.reason.${r}`)}</option>
                ))}
              </select>
            </FormField>
            <FormField label={t("assets.disposal.method")} htmlFor="disposal-method">
              <select id="disposal-method" className="form-input w-full" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t(`assets.disposal.method.${m}`)}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label={t("assets.disposal.justification")} htmlFor="disposal-justification" required>
            <textarea
              id="disposal-justification"
              className="form-input w-full"
              rows={3}
              required
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
            />
          </FormField>
          <FormField label={t("assets.disposal.estimatedValue")} htmlFor="disposal-value">
            <input
              id="disposal-value"
              type="number"
              min="0"
              step="0.01"
              className="form-input w-full"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
            />
          </FormField>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? t("assets.disposal.saving") : t("assets.disposal.submit")}</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreate(false)}>{t("common.cancel")}</button>
          </div>
            </div>
          </FormSection>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900 lg:col-span-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("assets.disposal.col.reference")}</th>
                <th>{t("assets.disposal.asset")}</th>
                <th>{t("assets.disposal.reason")}</th>
                <th>{t("assets.disposal.col.status")}</th>
                <th>{t("assets.disposal.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={selected?.id === d.id ? "bg-neutral-50" : undefined}>
                  <td>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => setSelected(d)}>
                      {d.reference}
                    </button>
                  </td>
                  <td>{d.asset?.asset_code ?? "—"}</td>
                  <td>{tv(`assets.disposal.reason.${d.reason}`, d.reason)}</td>
                  <td>{tv(`assets.disposal.status.${d.status}`, d.status)}</td>
                  <td className="flex flex-wrap gap-1">
                    {d.status === "draft" && (
                      <button className="btn-secondary text-xs" disabled={saving} onClick={() => advance(d.id, "recommend", { comments: "Recommended" })}>
                        {t("assets.disposal.hodRecommend")}
                      </button>
                    )}
                    {d.status === "recommended" && (
                      <button className="btn-secondary text-xs" disabled={saving} onClick={() => advance(d.id, "finance-review", { comments: "Finance OK" })}>
                        {t("assets.disposal.financeReview")}
                      </button>
                    )}
                    {d.status === "finance_reviewed" && (
                      <button className="btn-secondary text-xs" disabled={saving} onClick={() => advance(d.id, "approve")}>
                        {t("common.approve")}
                      </button>
                    )}
                    {d.status === "approved" && (
                      <button
                        className="btn-primary text-xs"
                        disabled={saving}
                        onClick={() => {
                          setSelected(d);
                          setCompleteForm({
                            method: d.method || "scrap",
                            proceeds: "",
                            accounting_reference: "",
                          });
                          setCompleteOpen(true);
                        }}
                      >
                        {t("assets.disposal.complete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <TableEmpty colSpan={5} title={t("assets.disposal.empty")} />
              )}
            </tbody>
          </table>
        </div>

        <div className="card space-y-2 p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">{t("assets.disposal.detail")}</h2>
          {!selected && <p className="text-sm text-neutral-500">{t("assets.disposal.selectHint")}</p>}
          {selected && (
            <>
              <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.reference")}</span> {selected.reference}</p>
              <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.asset")}</span> {selected.asset?.asset_code} — {selected.asset?.name}</p>
              <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.status")}</span> {tv(`assets.disposal.status.${selected.status}`, selected.status)}</p>
              <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.reasonMethod")}</span> {tv(`assets.disposal.reason.${selected.reason}`, selected.reason)} / {selected.method ? tv(`assets.disposal.method.${selected.method}`, selected.method) : "—"}</p>
              <p className="text-sm whitespace-pre-wrap"><span className="font-medium">{t("assets.disposal.d.justification")}</span> {selected.justification}</p>
              {selected.hod_comments && <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.hod")}</span> {selected.hod_comments}</p>}
              {selected.finance_comments && <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.finance")}</span> {selected.finance_comments}</p>}
              {selected.accounting_reference && <p className="text-sm"><span className="font-medium">{t("assets.disposal.d.accountingRef")}</span> {selected.accounting_reference}</p>}
            </>
          )}
        </div>
      </div>

      {completeOpen && selected && (
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void advance(selected.id, "complete", {
              method: completeForm.method,
              proceeds: completeForm.proceeds ? Number(completeForm.proceeds) : null,
              accounting_reference: completeForm.accounting_reference || null,
            });
          }}
        >
          <h2 className="text-lg font-semibold">{t("assets.disposal.completeTitle", { reference: selected.reference })}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label htmlFor="assets-disposal-method-setcompleteform" className="block text-sm">
              {t("assets.disposal.method")}
              <select id="assets-disposal-method-setcompleteform" className="form-input mt-1 w-full" value={completeForm.method} onChange={(e) => setCompleteForm({ ...completeForm, method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t(`assets.disposal.method.${m}`)}</option>
                ))}
              </select>
            </label>
            <label htmlFor="assets-disposal-proceeds-setcompleteform" className="block text-sm">
              {t("assets.disposal.proceeds")}
              <input id="assets-disposal-proceeds-setcompleteform" type="number" min="0" step="0.01" className="form-input mt-1 w-full" value={completeForm.proceeds} onChange={(e) => setCompleteForm({ ...completeForm, proceeds: e.target.value })} />
            </label>
            <label htmlFor="assets-disposal-accounting-reference-setcompleteform" className="block text-sm">
              {t("assets.disposal.accountingReference")}
              <input id="assets-disposal-accounting-reference-setcompleteform" className="form-input mt-1 w-full" value={completeForm.accounting_reference} onChange={(e) => setCompleteForm({ ...completeForm, accounting_reference: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>{t("assets.disposal.complete")}</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setCompleteOpen(false)}>{t("common.cancel")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
