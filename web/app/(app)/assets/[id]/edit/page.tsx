"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { assetsApi, assetCategoriesApi, tenantUsersApi, type Asset, type AssetCategory } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";

const STATUSES = ["active", "service_due", "loan_out", "retired"] as const;
const DEPRECIATION_METHODS = [
  { value: "straight_line", label: "Straight Line" },
  { value: "declining_balance", label: "Declining Balance" },
] as const;
const STEP_LABELS = ["Basic info", "Invoice & amount", "Financial", "Review"] as const;

function getAgeDisplay(purchaseDate: string, issuedAt: string): string {
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
    return months === 0 ? "Less than 1 month" : `${months} month(s)`;
  }
  if (months === 0) return `${years} year(s)`;
  return `${years} year(s) ${months} month(s)`;
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
  const params = useParams();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [userOptions, setUserOptions] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assetCode, setAssetCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("active");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
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
        setAssignedTo(a.assigned_to ?? "");
        setIssuedAt(formatDateForInput(a.issued_at));
        setNotes(a.notes ?? "");
        setInvoiceNumber(a.invoice_number ?? "");
        setPurchaseDate(formatDateForInput(a.purchase_date));
        setPurchaseValue(a.purchase_value != null ? String(a.purchase_value) : "");
        setUsefulLifeYears(a.useful_life_years != null ? String(a.useful_life_years) : "");
        setSalvageValue(a.salvage_value != null ? String(a.salvage_value) : "");
        setDepreciationMethod(a.depreciation_method ?? "straight_line");
      })
      .catch(() => {
        setError("Failed to load asset.");
      })
      .finally(() => setLoading(false));
  }, [id, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    Promise.all([tenantUsersApi.list(), assetCategoriesApi.list()])
      .then(([userRes, catRes]) => {
        setUserOptions((userRes.data as { data?: { id: number; name: string }[] }).data ?? []);
        setCategories((catRes.data as { data?: AssetCategory[] }).data ?? []);
      })
      .catch(() => {});
  }, [allowed]);

  useEffect(() => {
    if (!invoiceFile) {
      setInvoicePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(invoiceFile);
    setInvoicePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [invoiceFile]);

  const previewAge = useMemo(() => getAgeDisplay(purchaseDate, issuedAt), [purchaseDate, issuedAt]);
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
      setError("Please choose a PDF or image file (JPEG, PNG, WebP).");
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
      setError("Asset code and name are required.");
      return;
    }
    if (categories.length === 0 || !category) {
      setError("No asset categories defined. Create categories first.");
      return;
    }
    setSubmitting(true);
    try {
      await assetsApi.update(id, {
        asset_code: code,
        name: assetName,
        category,
        status: status || "active",
        assigned_to: assignedTo === "" ? undefined : Number(assignedTo),
        issued_at: issuedAt || undefined,
        notes: notes.trim() || undefined,
        invoice_number: invoiceNumber.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_value: pv ?? undefined,
        useful_life_years: ul ?? undefined,
        salvage_value: salvageValue === "" ? undefined : Number(salvageValue),
        depreciation_method: depreciationMethod || "straight_line",
      });
      if (invoiceFile) {
        await assetsApi.uploadInvoice(id, invoiceFile);
      }
      router.push("/assets");
      router.refresh();
    } catch (err: unknown) {
      const data =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data
          : null;
      const msg =
        data?.message ??
        (data?.errors ? Object.values(data.errors).flat().join(" ") : null) ??
        "Failed to update asset. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (allowed === null || allowed === false) {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 flex items-center justify-center gap-2 text-neutral-500">
        <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
        <span className="text-sm">Loading asset…</span>
      </div>
    );
  }

  if (error && !asset) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="text-red-600">{error}</p>
        <Link href="/assets" className="text-primary mt-2 inline-block text-sm">Back to Assets</Link>
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/assets" className="hover:text-primary transition-colors">
            Assets
          </Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">Edit {asset.asset_code}</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Edit Asset</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Update the asset details below. You can attach a new invoice to replace the existing one.
        </p>
      </div>

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
                  {label}
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
              Basic asset information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="asset_code" className={labelCls}>Asset code <span className="text-red-500">*</span></label>
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
                <label htmlFor="name" className={labelCls}>Name <span className="text-red-500">*</span></label>
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
                <label htmlFor="category" className={labelCls}>Category <span className="text-red-500">*</span></label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} disabled={submitting}>
                  {categories.length === 0 ? (
                    <option value="">— No categories —</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.code}>{c.name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="status" className={labelCls}>Status</label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} disabled={submitting}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="assigned_to" className={labelCls}>Assigned to</label>
              <select
                id="assigned_to"
                value={assignedTo === "" ? "" : assignedTo}
                onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputCls}
                disabled={submitting}
              >
                <option value="">— Not assigned —</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="issued_at" className={labelCls}>Issued date</label>
              <input id="issued_at" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={`${inputCls} max-w-xs`} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <label htmlFor="notes" className={labelCls}>Notes</label>
              <textarea id="notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} disabled={submitting} />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
              Invoice & amount
            </h3>
            <div className="space-y-2">
              <label htmlFor="invoice_number" className={labelCls}>Invoice number</label>
              <input id="invoice_number" type="text" maxLength={64} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`${inputCls} max-w-sm`} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <label htmlFor="purchase_value_step2" className={labelCls}>Amount / Purchase value ($)</label>
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
              <label htmlFor="invoice_file" className={labelCls}>Attach new invoice (PDF or image)</label>
              <input
                id="invoice_file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-medium hover:file:bg-primary/20"
                disabled={submitting}
              />
              <p className="text-xs text-neutral-500 mt-1">Leave empty to keep current invoice. PDF, JPEG, PNG or WebP. Max 10 MB.</p>
            </div>
            {invoicePreviewUrl && invoiceFile && (
              <div className="mt-4">
                <p className="text-xs font-medium text-neutral-700 mb-2">Invoice preview</p>
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 max-h-[400px] overflow-auto">
                  {invoiceFile.type.startsWith("image/") ? (
                    <img src={invoicePreviewUrl} alt="Invoice preview" className="max-w-full h-auto object-contain" />
                  ) : (
                    <iframe src={invoicePreviewUrl} title="Invoice preview" className="w-full min-h-[400px] border-0" />
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
              Financial & depreciation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="purchase_date" className={labelCls}>Purchase date</label>
                <input id="purchase_date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} disabled={submitting} />
              </div>
              <div className="space-y-2">
                <label htmlFor="purchase_value" className={labelCls}>Purchase value ($)</label>
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
                <label htmlFor="useful_life_years" className={labelCls}>Useful life (years)</label>
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
                <label htmlFor="salvage_value" className={labelCls}>Salvage value ($)</label>
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
              <label htmlFor="depreciation_method" className={labelCls}>Depreciation method</label>
              <select id="depreciation_method" value={depreciationMethod} onChange={(e) => setDepreciationMethod(e.target.value)} className={`${inputCls} max-w-xs`} disabled={submitting}>
                {DEPRECIATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className={`${cardCls} bg-neutral-50 border-neutral-100`}>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">4</span>
              Review and save
            </h3>
            <div className="space-y-2">
              {[
                { label: "Asset code", value: assetCode || "—" },
                { label: "Name", value: name || "—" },
                { label: "Category", value: categories.find((c) => c.code === category)?.name ?? category },
                { label: "Status", value: status.replace("_", " ") },
                { label: "Invoice number", value: invoiceNumber || "—" },
                { label: "Purchase value", value: pv != null ? `$${pv.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—" },
                { label: "New invoice attached", value: invoiceFile ? invoiceFile.name : "No (existing kept)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start py-2 border-b border-neutral-50">
                  <span className="text-xs text-neutral-500 flex-shrink-0 w-40">{label}</span>
                  <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-neutral-500 block mb-1">Age</span>
                <p className="text-sm font-semibold text-neutral-900">{previewAge}</p>
              </div>
              <div>
                <span className="text-xs text-neutral-500 block mb-1">Current (depreciated) value</span>
                <p className="text-sm font-semibold text-neutral-900">
                  {previewCurrentValue != null ? `$${previewCurrentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
              <p className="text-xs text-amber-700">If you change the asset code, the QR code will be regenerated automatically.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                disabled={submitting}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/assets" className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
              Cancel
            </Link>
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Step
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save changes"}
                <span className={`material-symbols-outlined text-[18px] ${submitting ? "animate-spin" : ""}`}>{submitting ? "progress_activity" : "save"}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
