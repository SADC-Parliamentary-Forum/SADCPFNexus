"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { assetsApi, assetCategoriesApi, type Asset, type AssetCategory, type TenantUserOption } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { assigneeDepartmentName, formatAssigneeLabel, tenantUserFromAsset } from "@/lib/asset-assignee";
import { createFilePreviewUrl } from "@/lib/filePreview";
import { AssetIdentifierFields, EMPTY_IDENTIFIERS, isSerialConflict, type AssetIdentifiers } from "@/components/assets/AssetIdentifierFields";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type T = (key: string, vars?: Record<string, string | number>) => string;

const STATUSES = ["active", "service_due", "loan_out", "retired"] as const;
const DEPRECIATION_METHODS = [
  { value: "straight_line", label: "assets.form.method.straightLine" },
  { value: "declining_balance", label: "assets.form.method.decliningBalance" },
] as const;
const STEP_LABELS = ["assets.form.step.basic", "assets.form.step.invoice", "assets.form.step.financial", "assets.form.step.review"] as const;

function getAgeDisplay(purchaseDate: string, issuedAt: string, t: T): string {
  const ref = purchaseDate || issuedAt;
  if (!ref) return "—";
  const refDate = new Date(ref);
  const now = new Date();
  let years = now.getFullYear() - refDate.getFullYear();
  let months = now.getMonth() - refDate.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years === 0) {
    return months === 0 ? t("assets.form.age.lessThanMonth") : t("assets.form.age.months", { months });
  }
  if (months === 0) return t("assets.form.age.years", { years });
  return t("assets.form.age.yearsMonths", { years, months });
}

function computeDepreciatedValue(
  purchaseValue: number | null,
  usefulLifeYears: number | null,
  salvageValue: number,
  referenceDate: Date | null
): number | null {
  if (purchaseValue == null || usefulLifeYears == null || usefulLifeYears <= 0 || !referenceDate) {
    return null;
  }
  const now = new Date();
  const yearsElapsed = Math.min(
    Math.floor((now.getTime() - referenceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
    usefulLifeYears
  );
  const depreciable = purchaseValue - salvageValue;
  const current = salvageValue + depreciable * Math.max(0, 1 - yearsElapsed / usefulLifeYears);
  return Math.round(current * 100) / 100;
}

function formatDateForInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EditAssetPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const params = useParams();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [assignedUser, setAssignedUser] = useState<TenantUserOption | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assetCode, setAssetCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("active");
  const [issuedAt, setIssuedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [salvageValue, setSalvageValue] = useState("");
  const [depreciationMethod, setDepreciationMethod] = useState<string>("straight_line");
  const [identifiers, setIdentifiers] = useState<AssetIdentifiers>(EMPTY_IDENTIFIERS);
  const [serialConflict, setSerialConflict] = useState(false);
  const [allowSerialDuplicate, setAllowSerialDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(canManageAssets(getStoredUser()));
  }, []);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      router.replace("/assets");
      return;
    }
    if (allowed === false) {
      router.replace("/assets");
      return;
    }
    if (!allowed) return;
    assetsApi
      .get(id)
      .then((res) => {
        const a = res.data;
        setAsset(a);
        setAssetCode(a.asset_code ?? "");
        setName(a.name ?? "");
        setCategory(a.category ?? "");
        setStatus(a.status ?? "active");
        setAssignedUser(tenantUserFromAsset(a));
        setIssuedAt(formatDateForInput(a.issued_at));
        setNotes(a.notes ?? "");
        setInvoiceNumber(a.invoice_number ?? "");
        setPurchaseDate(formatDateForInput(a.purchase_date));
        setPurchaseValue(a.purchase_value != null ? String(a.purchase_value) : "");
        setUsefulLifeYears(a.useful_life_years != null ? String(a.useful_life_years) : "");
        setSalvageValue(a.salvage_value != null ? String(a.salvage_value) : "");
        setDepreciationMethod(a.depreciation_method ?? "straight_line");
        setIdentifiers({
          serial_number: a.serial_number ?? "",
          manufacturer: a.manufacturer ?? "",
          model: a.model ?? "",
        });
      })
      .catch(() => {
        setError(t("assets.edit.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, allowed, router, t]);

  useEffect(() => {
    if (!allowed) return;
    assetCategoriesApi.list()
      .then((catRes) => {
        setCategories((catRes.data as { data?: AssetCategory[] }).data ?? []);
      })
      .catch(() => {});
  }, [allowed]);

  useEffect(() => {
    if (!invoiceFile) {
      setInvoicePreviewUrl(null);
      return;
    }
    const url = createFilePreviewUrl(invoiceFile);
    setInvoicePreviewUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoiceFile]);

  const previewAge = useMemo(() => getAgeDisplay(purchaseDate, issuedAt, t), [purchaseDate, issuedAt, t]);
  const pv = purchaseValue === "" ? null : Number(purchaseValue);
  const ul = usefulLifeYears === "" ? null : Number(usefulLifeYears);
  const sv = salvageValue === "" ? 0 : Number(salvageValue);
  const refDateForValue = purchaseDate ? new Date(purchaseDate) : issuedAt ? new Date(issuedAt) : null;
  const previewCurrentValue = useMemo(
    () => computeDepreciatedValue(pv, ul, sv, refDateForValue),
    [pv, ul, sv, purchaseDate, issuedAt]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setInvoiceFile(null);
      return;
    }
    const type = file.type.toLowerCase();
    const ok = type === "application/pdf" || type.startsWith("image/");
    if (!ok) {
      setError(t("assets.form.invalidFile"));
      setInvoiceFile(null);
      return;
    }
    setError(null);
    setInvoiceFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = assetCode.trim();
    const assetName = name.trim();
    if (!code || !assetName) {
      setError(t("assets.form.codeNameRequired"));
      return;
    }
    if (categories.length === 0 || !category) {
      setError(t("assets.form.noCategoriesError"));
      return;
    }
    setSubmitting(true);
    try {
      await assetsApi.update(id, {
        asset_code: code,
        name: assetName,
        category,
        status: status || "active",
        assigned_to: assignedUser?.id ?? null,
        department: assigneeDepartmentName(assignedUser) ?? undefined,
        issued_at: issuedAt || undefined,
        notes: notes.trim() || undefined,
        invoice_number: invoiceNumber.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_value: pv ?? undefined,
        useful_life_years: ul ?? undefined,
        salvage_value: salvageValue === "" ? undefined : Number(salvageValue),
        depreciation_method: depreciationMethod || "straight_line",
        serial_number: identifiers.serial_number.trim() || null,
        manufacturer: identifiers.manufacturer.trim() || null,
        model: identifiers.model.trim() || null,
        allow_serial_duplicate: allowSerialDuplicate || undefined,
      });
      if (invoiceFile) {
        await assetsApi.uploadInvoice(id, invoiceFile);
      }
      toast.success(t("assets.edit.toast.updated"), t("assets.edit.toast.updatedDetail", { name: assetName, code }));
      router.push("/assets");
      router.refresh();
    } catch (err: unknown) {
      if (isSerialConflict(err)) {
        setSerialConflict(true);
        setCurrentStep(1);
      }
      const data =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
          : null;
      const msg =
        data?.message ??
        (data?.errors ? Object.values(data.errors).flat().join(" ") : null) ??
        t("assets.edit.updateFailed");
      setError(msg);
      toast.error(t("assets.edit.toast.notUpdated"), msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (allowed === null || allowed === false) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("assets.edit.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.assets", href: "/assets" }, { label: "assets.edit.title" }]} />}
        />
        <div className="p-8 flex items-center justify-center gap-2 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          <span className="text-sm">{t("assets.edit.loading")}</span>
        </div>
      </div>
    );
  }

  if (error && !asset) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("assets.edit.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.assets", href: "/assets" }, { label: "assets.edit.title" }]} />}
        />
        <p className="text-red-600">{error}</p>
        <Link href="/assets" className="btn-secondary mt-2 inline-flex text-sm">{t("assets.edit.backToAssets")}</Link>
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50";
  const labelCls = "block text-xs font-medium text-neutral-700 mb-1";
  const cardCls = "rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5";

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("assets.edit.title")}
        subtitle={t("assets.edit.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.assets", href: "/assets" }, { label: "assets.edit.title" }]} />}
      />

      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i + 1 < currentStep ? "bg-primary text-white" : i + 1 === currentStep ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i + 1 < currentStep ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    i + 1 === currentStep ? "text-primary" : i + 1 < currentStep ? "text-neutral-700" : "text-neutral-400"
                  }`}
                >
                  {t(label)}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i + 1 < currentStep ? "bg-primary" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {error}
          </div>
        )}

        {currentStep === 1 && (
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">1</span>
              {t("assets.form.basicTitle")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="asset_code" className={labelCls}>{t("assets.form.assetCode")} <span className="text-red-500">*</span></label>
                <input
                  id="asset_code"
                  type="text"
                  maxLength={64}
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className={labelCls}>{t("assets.form.name")} <span className="text-red-500">*</span></label>
                <input
                  id="name"
                  type="text"
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="category" className={labelCls}>{t("assets.form.category")} <span className="text-red-500">*</span></label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    const code = e.target.value;
                    setCategory(code);
                    const cat = categories.find((c) => c.code === code);
                    if (cat?.useful_life_years) setUsefulLifeYears(String(cat.useful_life_years));
                  }}
                  className={inputCls}
                  disabled={submitting}
                >
                  {categories.length === 0 ? (
                    <option value="">{t("assets.form.noCategories")}</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.code}>{c.name}</option>
                    ))
                  )}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    <Link href="/assets/categories" className="btn-secondary text-xs py-1 px-2">
                      {t("assets.form.addCategory")}
                    </Link>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="status" className={labelCls}>{t("assets.form.status")}</label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} disabled={submitting}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`assets.form.status.${s}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <AssetIdentifierFields
              idPrefix="edit-asset"
              value={identifiers}
              onChange={(next) => {
                setIdentifiers(next);
                setSerialConflict(false);
                setAllowSerialDuplicate(false);
              }}
              disabled={submitting}
              serialConflict={serialConflict}
              allowDuplicate={allowSerialDuplicate}
              onAllowDuplicateChange={setAllowSerialDuplicate}
              inputClassName={inputCls}
              labelClassName={labelCls}
              showReprintNote
            />
            <AssetAssigneePicker
              id="assigned_to"
              label={t("assets.form.assignedTo")}
              value={assignedUser}
              onSelect={setAssignedUser}
              disabled={submitting}
              hint={t("assets.form.assigneeHint")}
            />
            <div className="space-y-2">
              <label htmlFor="issued_at" className={labelCls}>{t("assets.form.issuedDate")}</label>
              <input id="issued_at" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={`${inputCls} max-w-xs`} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <label htmlFor="notes" className={labelCls}>{t("assets.form.notes")}</label>
              <textarea id="notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} disabled={submitting} />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
              {t("assets.form.invoiceTitle")}
            </h3>
            <div className="space-y-2">
              <label htmlFor="invoice_number" className={labelCls}>{t("assets.form.invoiceNumber")}</label>
              <input id="invoice_number" type="text" maxLength={64} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`${inputCls} max-w-sm`} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <label htmlFor="purchase_value_step2" className={labelCls}>{t("assets.form.amountValue")}</label>
              <input
                id="purchase_value_step2"
                type="number"
                min={0}
                step="0.01"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
                className={`${inputCls} max-w-xs`}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invoice_file" className={labelCls}>{t("assets.edit.attachInvoice")}</label>
              <input
                id="invoice_file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-medium hover:file:bg-primary/20"
                disabled={submitting}
              />
              <p className="text-xs text-neutral-500 mt-1">{t("assets.edit.invoiceHint")}</p>
            </div>
            {invoicePreviewUrl && invoiceFile && (
              <div className="mt-4">
                <p className="text-xs font-medium text-neutral-700 mb-2">{t("assets.form.invoicePreview")}</p>
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 max-h-[400px] overflow-auto">
                  {invoiceFile.type.startsWith("image/") ? (
                    <img src={invoicePreviewUrl} alt={t("assets.form.invoicePreview")} className="max-w-full h-auto object-contain" />
                  ) : (
                    <iframe src={invoicePreviewUrl} title={t("assets.form.invoicePreview")} className="w-full min-h-[400px] border-0" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">3</span>
              {t("assets.form.financialTitle")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="purchase_date" className={labelCls}>{t("assets.form.purchaseDate")}</label>
                <input id="purchase_date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} disabled={submitting} />
              </div>
              <div className="space-y-2">
                <label htmlFor="purchase_value" className={labelCls}>{t("assets.form.purchaseValueUsd")}</label>
                <input
                  id="purchase_value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="useful_life_years" className={labelCls}>{t("assets.form.usefulLife")}</label>
                <input
                  id="useful_life_years"
                  type="number"
                  min={1}
                  max={100}
                  value={usefulLifeYears}
                  onChange={(e) => setUsefulLifeYears(e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="salvage_value" className={labelCls}>{t("assets.form.salvageValueUsd")}</label>
                <input
                  id="salvage_value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(e.target.value)}
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="depreciation_method" className={labelCls}>{t("assets.form.depreciationMethod")}</label>
              <select id="depreciation_method" value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)} className={`${inputCls} max-w-xs`} disabled={submitting}>
                {DEPRECIATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.label)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className={`${cardCls} bg-neutral-50 border-neutral-100`}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">4</span>
              {t("assets.form.reviewTitle")}
            </h3>
            <div className="space-y-2">
              {[
                { label: t("assets.form.assetCode"), value: assetCode || "—" },
                { label: t("assets.form.name"), value: name || "—" },
                { label: t("assets.form.category"), value: categories.find((c) => c.code === category)?.name ?? category },
                { label: t("assets.form.status"), value: t(`assets.form.status.${status}`) },
                { label: t("assets.form.serialNumber"), value: identifiers.serial_number.trim() || "—" },
                { label: t("assets.form.makeModel"), value: [identifiers.manufacturer.trim(), identifiers.model.trim()].filter(Boolean).join(" ") || "—" },
                { label: t("assets.form.assignedTo"), value: assignedUser ? formatAssigneeLabel(assignedUser) : "—" },
                { label: t("assets.form.invoiceNumber"), value: invoiceNumber || "—" },
                { label: t("assets.form.purchaseValue"), value: pv != null ? `$${pv.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—" },
                { label: t("assets.edit.newInvoiceAttached"), value: invoiceFile ? invoiceFile.name : t("assets.edit.existingKept") },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start py-2 border-b border-neutral-50">
                  <span className="text-xs text-neutral-500 flex-shrink-0 w-40">{label}</span>
                  <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-neutral-500 block mb-1">{t("assets.form.age")}</span>
                <p className="text-sm font-semibold text-neutral-900">{previewAge}</p>
              </div>
              <div>
                <span className="text-xs text-neutral-500 block mb-1">{t("assets.form.currentValue")}</span>
                <p className="text-sm font-semibold text-neutral-900">
                  {previewCurrentValue != null ? `$${previewCurrentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
              <p className="text-xs text-amber-700">{t("assets.edit.qrNote")}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                disabled={submitting}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {t("common.back")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/assets" className="btn-secondary">
              {t("common.cancel")}
            </Link>
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={submitting}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("assets.form.nextStep")}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? t("assets.form.saving") : t("assets.edit.saveChanges")}
                <span className={`material-symbols-outlined text-[18px] ${submitting ? "animate-spin" : ""}`}>{submitting ? "progress_activity" : "save"}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
