"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetLabelsApi, type AssetLabelTemplate } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { LabelTemplateVisualEditor } from "@/components/assets/LabelTemplateVisualEditor";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  PAGE_PRESETS,
  clampLayout,
  defaultLayout,
  labelsPerPage,
  resizeItem,
  sanitizeLayout,
  toTemplateSavePayload,
  type LayoutItem,
} from "@/lib/labelTemplateLayout";

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
  layout: LayoutItem[];
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
  layout: defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 }),
};

function sizeOf(form: Pick<FormState, "label_width_mm" | "label_height_mm" | "qr_mm">) {
  return { labelWidthMm: form.label_width_mm, labelHeightMm: form.label_height_mm, qrMm: form.qr_mm };
}

function fromTemplate(tpl: AssetLabelTemplate): FormState {
  const base = {
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
  return {
    ...base,
    layout: sanitizeLayout(tpl.layout, sizeOf(base)),
  };
}

const PRESET_KEYS: Record<(typeof PAGE_PRESETS)[number]["id"], string> = {
  avery18: "assets.labels.presetAvery18",
  avery8: "assets.labels.presetAvery8",
  avery2: "assets.labels.presetAvery2",
  thermal: "assets.labels.presetThermal",
};

export default function AssetLabelTemplatesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<AssetLabelTemplate[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  function load() {
    assetLabelsApi.templates({ include_inactive: true }).then((r) => {
      setRows(r.data.data ?? []);
    }).catch(() => setError(t("assets.labels.loadTemplatesFailed")));
  }

  useEffect(() => { load(); }, []);

  function startEdit(tpl: AssetLabelTemplate) {
    setEditId(tpl.id);
    setForm(fromTemplate(tpl));
    setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNew() {
    setEditId(null);
    setForm({ ...EMPTY, code: `custom_${Date.now().toString(36)}`, layout: defaultLayout(sizeOf(EMPTY)) });
    setEditorOpen(true);
  }

  function applyPreset(id: (typeof PAGE_PRESETS)[number]["id"]) {
    const preset = PAGE_PRESETS.find((row) => row.id === id);
    if (!preset) return;
    setForm((prev) => {
      const next = {
        ...prev,
        page_size: preset.page_size,
        page_width_mm: preset.page_width_mm,
        page_height_mm: preset.page_height_mm,
        margin_top_mm: preset.margin_top_mm,
        margin_left_mm: preset.margin_left_mm,
        label_width_mm: preset.label_width_mm,
        label_height_mm: preset.label_height_mm,
        h_gap_mm: preset.h_gap_mm,
        v_gap_mm: preset.v_gap_mm,
        rows: preset.rows,
        columns: preset.columns,
        qr_mm: preset.qr_mm,
      };
      return { ...next, layout: defaultLayout(sizeOf(next)) };
    });
  }

  function patchNumber(key: keyof FormState, value: number) {
    if (!Number.isFinite(value)) return;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "label_width_mm" || key === "label_height_mm") {
        next.layout = clampLayout(next.layout, sizeOf(next));
      }
      if (key === "qr_mm") {
        next.layout = resizeItem(next.layout, "qr", value, value, sizeOf(next));
      }
      return next;
    });
  }

  function apiErrorMessage(err: unknown): string {
    if (!err || typeof err !== "object" || !("response" in err)) return t("common.error");
    const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    const field = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return field || data?.message || t("common.error");
  }

  async function save() {
    const prepared = toTemplateSavePayload(form);
    if (!prepared.ok) {
      setError(t(prepared.error === "code" ? "assets.labels.codeRequired" : "assets.labels.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = editId
        ? await assetLabelsApi.updateTemplate(editId, prepared.payload)
        : await assetLabelsApi.createTemplate(prepared.payload);
      const saved = response.data.data;
      toast("success", t(editId ? "assets.labels.templateUpdated" : "assets.labels.templateCreated"));
      setEditId(saved.id);
      setForm(fromTemplate(saved));
      setEditorOpen(true);
      load();
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
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
        setEditorOpen(false);
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

  const mmField = (key: keyof FormState, label: string) => (
    <label className="text-xs font-semibold">{label}
      <input
        type="number"
        step="0.1"
        className="form-input mt-1"
        value={form[key] as number}
        onChange={(e) => patchNumber(key, Number(e.target.value))}
      />
    </label>
  );

  const intField = (key: keyof FormState, label: string) => (
    <label className="text-xs font-semibold">{label}
      <input
        type="number"
        step="1"
        min={1}
        className="form-input mt-1"
        value={form[key] as number}
        onChange={(e) => patchNumber(key, Number(e.target.value))}
      />
    </label>
  );

  return (
    <div className="w-full min-w-0 space-y-5">
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

      {editorOpen && (
        <div className="card space-y-4 p-5">
          <div className="sticky top-0 z-20 -mx-5 -mt-5 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur">
            <h3 className="text-sm font-semibold">{editId ? t("assets.labels.editTemplate") : t("assets.labels.newTemplate")}</h3>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(EMPTY); setEditorOpen(false); }}>{t("common.cancel")}</Button>
              <Button type="button" disabled={saving} onClick={save}>{saving ? t("common.loading") : t("common.save")}</Button>
            </div>
          </div>
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
            {mmField("page_width_mm", t("assets.labels.fieldPageW"))}
            {mmField("page_height_mm", t("assets.labels.fieldPageH"))}
            {mmField("margin_top_mm", t("assets.labels.fieldMarginT"))}
            {mmField("margin_left_mm", t("assets.labels.fieldMarginL"))}
            {mmField("label_width_mm", t("assets.labels.fieldLabelW"))}
            {mmField("label_height_mm", t("assets.labels.fieldLabelH"))}
            {mmField("h_gap_mm", t("assets.labels.fieldHGap"))}
            {mmField("v_gap_mm", t("assets.labels.fieldVGap"))}
            {intField("rows", t("assets.labels.fieldRows"))}
            {intField("columns", t("assets.labels.fieldCols"))}
            <label className="text-xs font-semibold">{t("assets.labels.fieldFont")}
              <input
                type="number"
                step="1"
                min={6}
                max={18}
                className="form-input mt-1"
                value={form.font_pt}
                onChange={(e) => patchNumber("font_pt", Number(e.target.value))}
              />
            </label>
            {mmField("qr_mm", t("assets.labels.fieldQr"))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.labels.presets")}</p>
            <div className="flex flex-wrap gap-2">
              {PAGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="btn-secondary"
                  onClick={() => applyPreset(preset.id)}
                >
                  {t(PRESET_KEYS[preset.id])}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {t("assets.labels.labelsPerPage", { count: labelsPerPage(form.rows, form.columns) })}
            </p>
          </div>

          <LabelTemplateVisualEditor
            geometry={form}
            layout={form.layout}
            onChange={(layout) => setForm((prev) => ({ ...prev, layout }))}
            onReset={() => setForm((prev) => ({ ...prev, layout: defaultLayout(sizeOf(prev)) }))}
          />

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
              <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(EMPTY); setEditorOpen(false); }}>{t("common.cancel")}</Button>
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
