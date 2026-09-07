"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetLabelsApi, type AssetLabelTemplate } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type FormState = {
  code: string;
  name: string;
  kind: "permanent" | "custody";
  page_size: string;
  page_width_mm: number;
  page_height_mm: number;
  margin_top_mm: number;
  margin_left_mm: number;
  label_width_mm: number;
  label_height_mm: number;
  h_gap_mm: number;
  v_gap_mm: number;
  rows: number;
  columns: number;
  font_pt: number;
  qr_mm: number;
  is_default: boolean;
  is_active: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  kind: "permanent",
  page_size: "A4",
  page_width_mm: 210,
  page_height_mm: 297,
  margin_top_mm: 8.7,
  margin_left_mm: 4.7,
  label_width_mm: 63.5,
  label_height_mm: 46.6,
  h_gap_mm: 2.5,
  v_gap_mm: 0,
  rows: 6,
  columns: 3,
  font_pt: 8,
  qr_mm: 22,
  is_default: false,
  is_active: true,
};

function fromTemplate(tpl: AssetLabelTemplate): FormState {
  return {
    code: tpl.code,
    name: tpl.name,
    kind: tpl.kind,
    page_size: tpl.page_size || "A4",
    page_width_mm: Number(tpl.page_width_mm),
    page_height_mm: Number(tpl.page_height_mm),
    margin_top_mm: Number(tpl.margin_top_mm),
    margin_left_mm: Number(tpl.margin_left_mm),
    label_width_mm: Number(tpl.label_width_mm),
    label_height_mm: Number(tpl.label_height_mm),
    h_gap_mm: Number(tpl.h_gap_mm),
    v_gap_mm: Number(tpl.v_gap_mm),
    rows: Number(tpl.rows),
    columns: Number(tpl.columns),
    font_pt: Number(tpl.font_pt),
    qr_mm: Number(tpl.qr_mm),
    is_default: Boolean(tpl.is_default),
    is_active: Boolean(tpl.is_active),
  };
}

export default function AssetLabelTemplatesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<AssetLabelTemplate[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    assetLabelsApi.templates({ include_inactive: true }).then((r) => {
      setRows(r.data.data ?? []);
    }).catch(() => setError(t("assets.labels.loadTemplatesFailed")));
  }

  useEffect(() => { load(); }, []);

  function startEdit(tpl: AssetLabelTemplate) {
    setEditId(tpl.id);
    setForm(fromTemplate(tpl));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNew() {
    setEditId(null);
    setForm({ ...EMPTY, code: `custom_${Date.now().toString(36)}` });
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await assetLabelsApi.updateTemplate(editId, form);
        toast("success", t("assets.labels.templateUpdated"));
      } else {
        await assetLabelsApi.createTemplate(form);
        toast("success", t("assets.labels.templateCreated"));
      }
      setEditId(null);
      setForm(EMPTY);
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(tpl: AssetLabelTemplate) {
    if (!(await confirm({
      title: t("assets.labels.deleteTemplate"),
      message: tpl.name,
      variant: "danger",
    }))) return;
    try {
      await assetLabelsApi.deleteTemplate(tpl.id);
      toast("success", t("assets.labels.templateDeleted"));
      if (editId === tpl.id) {
        setEditId(null);
        setForm(EMPTY);
      }
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast("error", msg || t("common.error"));
    }
  }

  const num = (key: keyof FormState) => (
    <input
      type="number"
      step="0.1"
      className="form-input"
      value={form[key] as number}
      onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
    />
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.labels.templatesTitle")}
          subtitle={t("assets.labels.templatesSubtitle")}
          breadcrumbs={
            <PageBreadcrumbs items={[
              { label: "assets.labels.title", href: "/assets/labels" },
              { label: "assets.labels.templatesTitle" },
            ]} />
          }
          actions={
            <div className="flex gap-2">
              <Link href="/assets/labels" className="btn-secondary">{t("assets.labels.backToPrint")}</Link>
              <Button type="button" onClick={startNew}>{t("assets.labels.newTemplate")}</Button>
            </div>
          }
        />
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {(editId !== null || form.code) && (
        <div className="card space-y-4 p-5">
          <h3 className="text-sm font-semibold">{editId ? t("assets.labels.editTemplate") : t("assets.labels.newTemplate")}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold">{t("assets.labels.fieldName")}
              <input className="form-input mt-1" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldCode")}
              <input className="form-input mt-1 font-mono" disabled={!!editId} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} />
            </label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldKind")}
              <select className="form-input mt-1" value={form.kind} onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as FormState["kind"] }))}>
                <option value="permanent">{t("assets.labels.kindPermanent")}</option>
                <option value="custody">{t("assets.labels.kindCustody")}</option>
              </select>
            </label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldPageW")}{num("page_width_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldPageH")}{num("page_height_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldMarginT")}{num("margin_top_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldMarginL")}{num("margin_left_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldLabelW")}{num("label_width_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldLabelH")}{num("label_height_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldHGap")}{num("h_gap_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldVGap")}{num("v_gap_mm")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldRows")}{num("rows")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldCols")}{num("columns")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldFont")}{num("font_pt")}</label>
            <label className="text-xs font-semibold">{t("assets.labels.fieldQr")}{num("qr_mm")}</label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))} />
              {t("assets.labels.fieldDefault")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
              {t("assets.labels.fieldActive")}
            </label>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(EMPTY); }}>{t("common.cancel")}</Button>
              <Button type="button" disabled={saving} onClick={save}>{saving ? t("common.loading") : t("common.save")}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-sm font-semibold">{t("assets.labels.templatesTitle")}</h3>
          <span className="badge-muted">{rows.length}</span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {rows.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{tpl.name}</p>
                <p className="text-xs text-neutral-500 font-mono">{tpl.code} · {tpl.kind} · {tpl.columns}×{tpl.rows} · {tpl.label_width_mm}×{tpl.label_height_mm} mm</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => startEdit(tpl)}>{t("common.edit")}</button>
                <button type="button" className="btn-secondary" onClick={() => remove(tpl)}>{t("common.delete")}</button>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-8 text-sm text-neutral-500">{t("common.noResults")}</li>}
        </ul>
      </div>
    </div>
  );
}
