"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { loadPdfLibs } from "@/lib/pdf-libs";
import { assetsApi, assetRequestsApi, tenantUsersApi, type Asset, type AssetRegisterSummary, type AssetRequest, type TenantUserOption } from "@/lib/api";
import { canDisposeAssets, canManageAssets, canPrintAssetLabels, canRetireAssets, getStoredUser } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { useRowSelection } from "@/lib/useRowSelection";
import {
  A4_LANDSCAPE_WIDTH_MM,
  REGISTER_PDF_COLUMNS,
  REGISTER_PDF_MARGIN_MM,
  parseRegisterExportJson,
  printPageHref,
  registerExportQuery,
  registerListParams,
  registerPdfAvailableWidth,
  registerPdfColumnWidths,
} from "@/lib/asset-register-print";
import { DEFAULT_PAGE_SIZE, getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { ListPagination } from "@/components/ui/ListPagination";
import { BulkSelectionBar, RowCheckbox, SelectAllCheckbox } from "@/components/ui/BulkSelectionBar";
import { AssetLabelsQuickPrintModal } from "@/components/assets/AssetLabelsQuickPrintModal";

const RETIREABLE_STATUSES = new Set(["active", "service_due", "loan_out"]);
const EMPTY_SUMMARY: AssetRegisterSummary = {
  total: 0,
  live: 0,
  pending: 0,
  active: 0,
  retired: 0,
  disposed: 0,
  categories: [],
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:           { label: "Pending capitalisation", cls: "badge-warning" },
  active:            { label: "Active",       cls: "badge-success" },
  assigned:          { label: "Assigned",     cls: "badge-info" },
  available:         { label: "Available",    cls: "badge-success" },
  service_due:       { label: "Service Due",  cls: "badge-warning" },
  loan_out:          { label: "Loan Out",      cls: "badge-info" },
  pending_disposal:  { label: "Pending disposal", cls: "badge-warning" },
  retired:           { label: "Retired",       cls: "badge-muted" },
  disposed:          { label: "Disposed",      cls: "badge-muted" },
  sold:              { label: "Sold",          cls: "badge-muted" },
  written_off:       { label: "Written off",   cls: "badge-muted" },
  scrapped:          { label: "Scrapped",      cls: "badge-muted" },
  donated_out:       { label: "Donated",       cls: "badge-muted" },
};

const UNASSIGNABLE_STATUSES = [
  "pending",
  "retired",
  "disposed",
  "sold",
  "written_off",
  "scrapped",
  "donated_out",
  "pending_disposal",
];

function canAssignAsset(status: string): boolean {
  return !UNASSIGNABLE_STATUSES.includes(status);
}

// ─── Depreciation helpers ────────────────────────────────────────────────────

const DEPR_METHODS = [
  { value: "straight_line",    label: "Straight Line"    },
  { value: "declining_balance", label: "Declining Balance (Double)" },
] as const;

function calcDepreciation(
  purchaseValue: number,
  usefulLifeYears: number,
  salvageValue: number,
  method: string,
  purchaseDate: string | null | undefined,
  issuedAt: string | null | undefined,
): { currentValue: number; pct: number; yearsElapsed: number; annualDepr: number | null } | null {
  if (!purchaseValue || !usefulLifeYears || usefulLifeYears <= 0) return null;
  const raw = purchaseDate ?? issuedAt;
  if (!raw) return null;
  const ref = new Date(raw.slice(0, 10) + "T00:00:00");
  if (isNaN(ref.getTime())) return null;
  const yearsElapsed = Math.max(0, Math.min(
    usefulLifeYears,
    (Date.now() - ref.getTime()) / (365.25 * 86_400_000),
  ));
  let currentValue: number;
  let annualDepr: number | null = null;
  if (method === "declining_balance") {
    const rate = 2 / usefulLifeYears;
    currentValue = Math.max(salvageValue, purchaseValue * Math.pow(1 - rate, yearsElapsed));
  } else {
    const annual = (purchaseValue - salvageValue) / usefulLifeYears;
    annualDepr = Math.round(annual * 100) / 100;
    currentValue = Math.max(salvageValue, purchaseValue - annual * yearsElapsed);
  }
  currentValue = Math.round(currentValue * 100) / 100;
  const pct = Math.min(100, (yearsElapsed / usefulLifeYears) * 100);
  return { currentValue, pct, yearsElapsed, annualDepr };
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Capitalise Modal (pending GRN drafts → active register) ─────────────────

function CapitaliseModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset;
  onClose: () => void;
  onSaved: (updated: Asset) => void;
}) {
  const [purchaseDate, setPurchaseDate] = useState(asset.purchase_date?.slice(0, 10) ?? "");
  const [purchaseValue, setPurchaseValue] = useState(
    asset.purchase_value != null ? String(asset.purchase_value) : "",
  );
  const [usefulLife, setUsefulLife] = useState(
    asset.useful_life_years != null ? String(asset.useful_life_years) : "3",
  );
  const [salvageValue, setSalvageValue] = useState(
    asset.salvage_value != null ? String(asset.salvage_value) : "0",
  );
  const [method, setMethod] = useState(asset.depreciation_method ?? "straight_line");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pv = purchaseValue === "" ? null : Number(purchaseValue);
  const ul = usefulLife === "" ? null : Number(usefulLife);
  const sv = salvageValue === "" ? 0 : Number(salvageValue);
  const preview = pv && ul ? calcDepreciation(pv, ul, sv, method, purchaseDate || null, asset.issued_at) : null;

  const handleSave = async () => {
    if (!purchaseDate || pv == null || Number.isNaN(pv)) {
      setError("Purchase date and purchase value are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await assetsApi.capitalise(asset.id, {
        category: asset.category,
        purchase_date: purchaseDate,
        purchase_value: pv,
        useful_life_years: ul && !Number.isNaN(ul) ? ul : undefined,
        salvage_value: sv,
        depreciation_method: method,
      });
      onSaved(res.data.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ||
        Object.values(
          (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {},
        )
          .flat()
          .join(" ") ||
        "Failed to capitalise asset.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">Capitalise Asset</h3>
              <p className="text-xs text-neutral-400">
                {asset.asset_code} — {asset.name}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close asset form" className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error_outline</span>
              {error}
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Confirm financial details to add this GRN draft into the Fixed Asset Register. No auto-capitalisation —
            officer confirmation is required.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Purchase Date *</label>
              <input
                type="date"
                className="form-input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Purchase Value *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Useful Life (years)</label>
              <input
                type="number"
                min={1}
                max={100}
                className="form-input"
                value={usefulLife}
                onChange={(e) => setUsefulLife(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Salvage Value</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input"
                value={salvageValue}
                onChange={(e) => setSalvageValue(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Depreciation Method</label>
              <select className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {DEPR_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {preview && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Book value preview</p>
              <p className="text-lg font-bold text-neutral-900">{fmtMoney(preview.currentValue)}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !purchaseDate || pv == null}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            {saving ? "Capitalising…" : "Capitalise"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Depreciation Modal ───────────────────────────────────────────────────────

function DepreciationModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset;
  onClose: () => void;
  onSaved: (updated: Asset) => void;
}) {
  const [purchaseDate,    setPurchaseDate]    = useState(asset.purchase_date?.slice(0, 10) ?? "");
  const [purchaseValue,   setPurchaseValue]   = useState(asset.purchase_value != null ? String(asset.purchase_value) : "");
  const [usefulLife,      setUsefulLife]      = useState(asset.useful_life_years != null ? String(asset.useful_life_years) : "");
  const [salvageValue,    setSalvageValue]    = useState(asset.salvage_value != null ? String(asset.salvage_value) : "0");
  const [method,          setMethod]          = useState(asset.depreciation_method ?? "straight_line");
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const pv  = purchaseValue  === "" ? null : Number(purchaseValue);
  const ul  = usefulLife     === "" ? null : Number(usefulLife);
  const sv  = salvageValue   === "" ? 0    : Number(salvageValue);

  const preview = pv && ul ? calcDepreciation(pv, ul, sv, method, purchaseDate || null, asset.issued_at) : null;

  const handleSave = async () => {
    if (!pv || !ul) { setError("Purchase value and useful life are required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await assetsApi.update(asset.id, {
        asset_code:         asset.asset_code,
        name:               asset.name,
        category:           asset.category,
        purchase_date:      purchaseDate  || undefined,
        purchase_value:     pv,
        useful_life_years:  ul,
        salvage_value:      sv,
        depreciation_method: method,
      });
      onSaved(res.data as unknown as Asset);
    } catch {
      setError("Failed to save depreciation settings.");
    } finally {
      setSaving(false);
    }
  };

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">trending_down</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">Set Depreciation</h3>
              <p className="text-xs text-neutral-400">{asset.asset_code} — {asset.name}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close asset details" className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error_outline</span>{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <F label="Purchase Date">
              <input type="date" className="form-input" value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)} />
            </F>
            <F label="Purchase Value *">
              <input type="number" min={0} step="0.01" className="form-input" placeholder="0.00"
                value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} />
            </F>
            <F label="Useful Life (years) *">
              <input type="number" min={1} max={100} className="form-input" placeholder="e.g. 5"
                value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} />
            </F>
            <F label="Salvage / Residual Value">
              <input type="number" min={0} step="0.01" className="form-input" placeholder="0.00"
                value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} />
            </F>
            <div className="col-span-2">
              <F label="Depreciation Method">
                <select className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {DEPR_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </F>
            </div>
          </div>

          {/* Live preview */}
          {preview ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-bold text-primary uppercase tracking-wide">Calculated Depreciation</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Current Book Value</p>
                  <p className="text-lg font-bold text-neutral-900">{fmtMoney(preview.currentValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">% Depreciated</p>
                  <p className="text-lg font-bold text-neutral-900">{preview.pct.toFixed(1)}%</p>
                </div>
                {preview.annualDepr != null && (
                  <div>
                    <p className="text-xs text-neutral-500">Annual Depreciation</p>
                    <p className="text-sm font-semibold text-neutral-700">{fmtMoney(preview.annualDepr)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-neutral-500">Years Elapsed</p>
                  <p className="text-sm font-semibold text-neutral-700">{preview.yearsElapsed.toFixed(1)} yr</p>
                </div>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Purchase</span>
                  <span>End of life ({ul} yr)</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${preview.pct >= 80 ? "bg-red-500" : preview.pct >= 50 ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${preview.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
              Enter purchase value and useful life to see a live calculation.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || !pv || !ul}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? "Saving…" : "Save Depreciation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset;
  onClose: () => void;
  onSaved: (updated: Asset) => void;
}) {
  const { t } = useI18n();
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [assignedTo, setAssignedTo] = useState<number | "">(asset.assigned_to ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenantUsersApi.list()
      .then((r) => setUsers(r.data.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const handleSave = async () => {
    if (assignedTo === "") {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await assetsApi.assign(asset.id, { assigned_to: Number(assignedTo) });
      onSaved(res.data.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ||
        Object.values(
          (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {},
        )
          .flat()
          .join(" ") ||
        t("assets.assignFailed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">person_add</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">{t("assets.assignTitle")}</h3>
              <p className="text-xs text-neutral-400">
                {asset.asset_code} — {asset.name}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.cancel")} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error_outline</span>
              {error}
            </div>
          )}
          <p className="text-xs text-neutral-500">{t("assets.assignHint")}</p>
          <div>
            <label htmlFor="assign-user" className="block text-xs font-semibold text-neutral-700 mb-1">
              {t("assets.assignedTo")}
            </label>
            <select
              id="assign-user"
              className="form-input"
              value={assignedTo === "" ? "" : assignedTo}
              onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={saving}
            >
              <option value="">{t("assets.notAssigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || assignedTo === ""}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            {saving ? "…" : t("assets.assignSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectCapitalisationModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!reason.trim()) {
      setError(t("assets.register.rejectReasonRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await assetsApi.rejectCapitalisation(asset.id, { reason: reason.trim() });
      onSaved();
    } catch {
      setError(t("assets.register.rejectFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t("assets.register.rejectTitle")}
        </h2>
        <p className="text-sm text-neutral-600">{asset.asset_code} — {asset.name}</p>
        <label className="block text-xs font-semibold text-neutral-600">
          {t("assets.register.rejectReason")}
          <textarea
            className="form-input mt-1 text-sm min-h-[96px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "…" : t("assets.register.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}

const requestStatusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "badge-warning" },
  approved: { label: "Approved", cls: "badge-success" },
  rejected: { label: "Rejected", cls: "badge-danger" },
};

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AssetsPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { success } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"inventory" | "my-requests">("inventory");
  const [showRequestButton, setShowRequestButton] = useState(false);
  const [showAddAssetButton, setShowAddAssetButton] = useState(false);
  const [canDispose, setCanDispose] = useState(false);
  const [canRetire, setCanRetire] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelIds, setLabelIds] = useState<number[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window === "undefined") return "live";
    return new URLSearchParams(window.location.search).get("status") || "live";
  });
  const [filterCategory, setFilterCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [summary, setSummary] = useState<AssetRegisterSummary>(EMPTY_SUMMARY);
  const [reqPage, setReqPage] = useState(1);
  const [reqLastPage, setReqLastPage] = useState(1);
  const [reqTotal, setReqTotal] = useState(0);
  const [capitaliseAsset, setCapitaliseAsset] = useState<Asset | null>(null);
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null);
  const [rejectAsset, setRejectAsset] = useState<Asset | null>(null);
  const [retiringId, setRetiringId] = useState<number | null>(null);
  const [confirmingReturnId, setConfirmingReturnId] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setShowRequestButton(!!user);
    setShowAddAssetButton(canManageAssets(user));
    setCanDispose(canDisposeAssets(user));
    setCanRetire(canRetireAssets(user));
    setShowPrintLabels(canPrintAssetLabels(user));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAssets = useCallback(() => {
    setLoading(true);
    setError(null);
    return assetsApi
      .list(registerListParams({
        page,
        perPage: DEFAULT_PAGE_SIZE,
        status: filterStatus,
        category: filterCategory,
        search,
      }))
      .then((res) => {
        const payload = res.data;
        const rows = getListData<Asset>(payload);
        const nextLast = getLastPage(payload);
        setAssets(rows);
        setLastPage(nextLast);
        setFilteredTotal(getTotal(payload, rows.length));
        if (payload.summary) setSummary(payload.summary);
        if (page > nextLast) setPage(nextLast);
      })
      .catch(() => setError(t("assets.register.loadFailed")))
      .finally(() => setLoading(false));
  }, [page, filterStatus, filterCategory, search, t]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    setReqLoading(true);
    assetRequestsApi
      .list({ per_page: DEFAULT_PAGE_SIZE, page: reqPage })
      .then((res) => {
        const rows = getListData<AssetRequest>(res.data);
        const nextLast = getLastPage(res.data);
        setRequests(rows);
        setReqLastPage(nextLast);
        setReqTotal(getTotal(res.data, rows.length));
        if (reqPage > nextLast) setReqPage(nextLast);
      })
      .catch(() => {})
      .finally(() => setReqLoading(false));
  }, [reqPage]);

  const categories = summary.categories ?? [];
  const pagedAssets = assets;
  const hasInventory = summary.total > 0;
  const listFilters = useMemo(
    () => ({ status: filterStatus, category: filterCategory, search }),
    [filterStatus, filterCategory, search],
  );

  const getAssetId = useCallback((asset: Asset) => asset.id, []);
  const selection = useRowSelection({ rows: pagedAssets, getId: getAssetId });
  const exportIds = useMemo(
    () => selection.selectedIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
    [selection.selectedIds],
  );
  const printHref = printPageHref(selection.selectedCount > 0 ? exportIds : [], listFilters);

  const loadFilteredExportRows = useCallback(async (ids: number[]): Promise<Asset[]> => {
    const res = await assetsApi.registerExport({
      ...registerExportQuery(ids, listFilters),
      format: "json",
    });
    const text = await (res.data as Blob).text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    return parseRegisterExportJson(parsed) as unknown as Asset[];
  }, [listFilters]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setError(null);
    try {
      const exportTargets =
        selection.selectedCount > 0
          ? pagedAssets.filter((asset) => selection.isSelected(asset.id))
          : await loadFilteredExportRows([]);
      if (exportTargets.length === 0) {
        setError(t("assets.register.exportEmpty"));
        return;
      }
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = Number(doc.internal.pageSize.getWidth()) || A4_LANDSCAPE_WIDTH_MM;
      const margin = REGISTER_PDF_MARGIN_MM;
      const available = registerPdfAvailableWidth(pageWidth, margin);
      const widths = registerPdfColumnWidths(pageWidth, margin);
      const columnStyles = Object.fromEntries(widths.map((cellWidth, index) => [index, { cellWidth }]));
      doc.setFontSize(14);
      doc.text("Asset Register", margin, 15);
      doc.setFontSize(9);
      doc.text(
        `Generated ${new Date().toLocaleDateString("en-GB")} – ${exportTargets.length} item(s)`,
        margin,
        22,
      );
      autoTable(doc, {
        head: [REGISTER_PDF_COLUMNS.map((col) => col.header)],
        body: exportTargets.map((asset) => [
          asset.asset_code,
          asset.name,
          asset.category,
          statusConfig[asset.status]?.label ?? asset.status,
          asset.assigned_user?.name ?? "",
        ]),
        startY: 28,
        margin: { left: margin, right: margin, top: 28, bottom: 12 },
        tableWidth: available,
        styles: {
          fontSize: 8,
          cellPadding: 1.2,
          overflow: "linebreak",
          minCellWidth: 8,
          valign: "middle",
        },
        columnStyles,
      });
      doc.save(`assets-register-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setError(t("assets.register.exportFailed"));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    setError(null);
    try {
      const res = await assetsApi.registerExport(
        registerExportQuery(selection.selectedCount > 0 ? exportIds : [], listFilters),
      );
      const blob = res.data as Blob;
      const type = (blob.type || "").toLowerCase();
      const peek = await blob.slice(0, 8).text();
      if (type.includes("json") || peek.trim().startsWith("{")) {
        throw new Error(t("assets.register.exportFailed"));
      }
      downloadBlob(blob, `fixed-asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      setError(t("assets.register.exportFailed"));
    } finally {
      setExportingExcel(false);
    }
  };

  const openLabels = async () => {
    setError(null);
    try {
      const ids =
        selection.selectedCount > 0 ? exportIds : (await loadFilteredExportRows([])).map((asset) => asset.id);
      if (ids.length === 0) {
        setError(t("assets.register.exportEmpty"));
        return;
      }
      setLabelIds(ids);
      setLabelsOpen(true);
    } catch {
      setError(t("assets.register.exportFailed"));
    }
  };

  const statusCounts = {
    live: summary.live,
    pending: summary.pending,
    active: summary.active,
    retired: summary.retired,
    disposed: summary.disposed,
  };

  const handleRejectCapitalisation = (asset: Asset) => {
    setRejectAsset(asset);
  };

  const handleRetire = async (asset: Asset) => {
    const ok = await confirm({
      title: t("assets.register.retireConfirmTitle"),
      message: t("assets.register.retireConfirm"),
      confirmText: t("assets.register.retire"),
      variant: "danger",
    });
    if (!ok) return;
    setRetiringId(asset.id);
    setError(null);
    try {
      await assetsApi.retire(asset.id);
      await loadAssets();
      success(t("assets.register.retired"));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t("assets.register.retireFailed");
      setError(msg);
    } finally {
      setRetiringId(null);
    }
  };

  const handleConfirmReturn = async (asset: Asset) => {
    setConfirmingReturnId(asset.id);
    setError(null);
    try {
      await assetsApi.returnAsset(asset.id);
      await loadAssets();
    } catch {
      setError(t("assets.register.returnFailed"));
    } finally {
      setConfirmingReturnId(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <ModulePageHeader
        title="assets.register.title"
        subtitle="Capital assets, movements, and GRN capitalisation queue."
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.register.title") }]} />}
      />
        <div className="flex gap-2 flex-wrap">
          {(showAddAssetButton || showRequestButton) && (
            <>
              <Link
                href={printHref}
                className="btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="asset-register-print"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                {t("assets.register.print")}
              </Link>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exportingPdf}
                className="btn-secondary"
                data-testid="asset-register-export-pdf"
              >
                {exportingPdf ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                )}
                {t("assets.register.exportPdf")}
              </button>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exportingExcel}
                className="btn-secondary"
                data-testid="asset-register-export-excel"
              >
                {exportingExcel ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                )}
                {t("assets.register.exportExcel")}
              </button>
              {showPrintLabels && (
                <button
                  type="button"
                  onClick={() => {
                    if (exportIds.length === 0 && filteredTotal === 0) {
                      setError(t("assets.register.exportEmpty"));
                      return;
                    }
                    void openLabels();
                  }}
                  className="btn-secondary"
                  data-testid="asset-register-print-labels"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                  {t("assets.register.printLabels")}
                </button>
              )}
            </>
          )}
          {showAddAssetButton && (
            <>
              <Link href="/assets/categories" className="btn-secondary">
                <span className="material-symbols-outlined text-[18px]">category</span>
                Categories
              </Link>
              <Link href="/assets/import" className="btn-secondary">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Import
              </Link>
              <Link href="/assets/add" className="btn-primary">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Asset
              </Link>
            </>
          )}
          {canDispose && (
            <Link href="/assets/disposal" className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              {t("assets.register.disposalQueue")}
            </Link>
          )}
          {canRetire && (
            <Link href="/assets/depreciation" className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              {t("assets.register.depreciation")}
            </Link>
          )}
          {showRequestButton && (
            <Link href="/assets/requests?new=1" className="btn-primary">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Request Asset
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setView("inventory")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "inventory" ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          {t("assets.register.inventory")}
        </button>
        <button
          type="button"
          onClick={() => setView("my-requests")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === "my-requests" ? "bg-primary text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
        >
          {t("assets.register.myRequests")} ({reqTotal})
        </button>
      </div>

      {/* Summary stats — only when viewing inventory */}
      {view === "inventory" && !loading && hasInventory && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: t("assets.register.live"), count: statusCounts.live, icon: "inventory_2", color: "text-primary", bg: "bg-primary/10", status: "live" },
            { label: t("assets.register.pending"), count: statusCounts.pending,     icon: "pending_actions", color: "text-amber-600",  bg: "bg-amber-50",   status: "pending" },
            { label: t("assets.register.active"),  count: statusCounts.active,      icon: "check_circle",    color: "text-green-600",  bg: "bg-green-50",   status: "active" },
            { label: t("assets.register.retiredStatus"), count: statusCounts.retired, icon: "archive",         color: "text-neutral-500", bg: "bg-neutral-100", status: "retired" },
            { label: t("assets.register.disposed"), count: statusCounts.disposed, icon: "delete_forever", color: "text-red-700", bg: "bg-red-50", status: "disposed" },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setFilterStatus(s.status);
                setPage(1);
              }}
              className={`card p-4 text-left transition-shadow hover:shadow-elevated ${filterStatus === s.status ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="text-lg font-bold text-neutral-900 mt-0.5">{s.count}</p>
                </div>
                <div className={`h-9 w-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${s.color} text-[18px]`}>{s.icon}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter — only when viewing inventory */}
      {view === "inventory" && !loading && hasInventory && (
        <div className="card p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">{t("assets.register.search")}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-neutral-400 text-[18px]">search</span>
              <input
                className="form-input pl-8 text-sm"
                placeholder={t("assets.register.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">{t("assets.register.status")}</label>
            <select
              className="form-input text-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="live">{t("assets.register.live")}</option>
              <option value="all">{t("assets.register.allStatuses")}</option>
              <option value="pending">{t("assets.register.pendingCapitalisation")}</option>
              <option value="active">{t("assets.register.active")}</option>
              <option value="service_due">{t("assets.register.serviceDue")}</option>
              <option value="loan_out">{t("assets.register.loanOut")}</option>
              <option value="pending_disposal">{t("assets.register.pendingDisposal")}</option>
              <option value="retired">{t("assets.register.retiredStatus")}</option>
              <option value="disposed">{t("assets.register.disposed")}</option>
            </select>
          </div>
          {categories.length > 0 && (
            <div className="min-w-[130px]">
              <label className="block text-xs font-semibold text-neutral-600 mb-1">{t("assets.register.category")}</label>
              <select
                className="form-input text-sm"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("assets.register.allCategories")}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {(search || filterStatus !== "live" || filterCategory !== "all") && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearch(""); setFilterStatus("live"); setFilterCategory("all"); setPage(1); }}
              className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mt-5"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
              {t("assets.register.clearFilters")}
            </button>
          )}
        </div>
      )}

      {view === "my-requests" ? (
        <>
          {reqLoading ? (
            <div className="card p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-3">
              {requests.map((req) => {
                const s = requestStatusConfig[req.status] ?? { label: req.status, cls: "badge-muted" };
                return (
                  <div key={req.id} className="card p-5 hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${s.cls}`}>{s.label}</span>
                          <span className="text-xs text-neutral-400">
                            {req.created_at ? new Date(req.created_at).toLocaleDateString("en-GB") : ""}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-700 whitespace-pre-wrap">{req.justification}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div data-testid="asset-requests-pagination">
                <ListPagination page={reqPage} lastPage={reqLastPage} total={reqTotal} onPageChange={setReqPage} />
              </div>
            </div>
          ) : (
            <div className="card p-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
                <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-600">{t("assets.register.emptyRequests")}</p>
              <p className="text-xs text-neutral-400 mt-1">{t("assets.register.emptyRequestsHint")}</p>
              <Link href="/assets/requests?new=1" className="btn-primary mt-5 inline-flex">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Request Asset
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <div className="card p-12 text-center">
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          ) : pagedAssets.length > 0 ? (
            <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-600">
                <SelectAllCheckbox
                  checked={selection.allSelectableSelected}
                  indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                  onChange={selection.toggleAllSelectable}
                  disabled={pagedAssets.length === 0}
                  label={t("assets.register.selectAll")}
                />
                <span data-testid="asset-register-select-all">{t("assets.register.selectAll")}</span>
              </label>
              <p className="text-xs text-neutral-500">{t("assets.register.selectHint")}</p>
            </div>
            <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear}>
              <Link
                href={printHref}
                className="btn-secondary text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("assets.register.print")}
              </Link>
              <button type="button" className="btn-secondary text-xs" onClick={() => void handleExportExcel()}>
                {t("assets.register.exportExcel")}
              </button>
              {showPrintLabels && (
                <button type="button" className="btn-secondary text-xs" onClick={() => void openLabels()}>
                  {t("assets.register.printLabels")}
                </button>
              )}
            </BulkSelectionBar>
            <div className="grid gap-4 sm:grid-cols-2">
              {pagedAssets.map((asset) => {
                const s = statusConfig[asset.status] ?? { label: asset.status, cls: "badge-muted" };
                return (
                  <div key={asset.id} className="card p-5 hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <RowCheckbox
                          checked={selection.isSelected(asset.id)}
                          onChange={() => selection.toggle(asset.id)}
                          label={asset.asset_code}
                        />
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="text-xs font-mono text-neutral-400 hover:text-primary"
                              data-testid="asset-register-view"
                            >
                              {asset.asset_code}
                            </Link>
                            <span className={`badge ${s.cls}`}>{s.label}</span>
                            {asset.custody_state === "pending_acceptance" && (
                              <span className="badge badge-warning">{t("assets.register.pendingAcceptance")}</span>
                            )}
                            {asset.custody_state === "pending_return" && (
                              <span className="badge badge-warning">{t("assets.register.pendingReturn")}</span>
                            )}
                          </div>
                          <Link
                            href={`/assets/${asset.id}`}
                            className="text-sm font-semibold text-neutral-900 mt-0.5 truncate hover:text-primary block"
                            data-testid="asset-register-view"
                          >
                            {asset.name}
                          </Link>
                          <p className="text-xs text-neutral-500 mt-1 capitalize">{asset.category}</p>
                          {(asset.current_value != null || asset.value != null) && (
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {t("assets.register.bookValue")}: {Number(asset.current_value ?? asset.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          {asset.age_display && (
                            <p className="text-xs text-neutral-500 mt-0.5">{t("assets.register.age")}: {asset.age_display}</p>
                          )}
                          <p className={`text-xs mt-0.5 ${asset.assigned_user?.name ? "text-neutral-500" : "text-neutral-400"}`}>
                            {asset.assigned_user?.name
                              ? `${t("assets.assignedTo")}: ${asset.assigned_user.name}`
                              : t("assets.notAssigned")}
                          </p>
                        </div>
                      </div>
                      {(showAddAssetButton || canDispose || canRetire || asset.custody_state === "pending_return") && (
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {asset.status === "pending" ? (
                            showAddAssetButton ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setCapitaliseAsset(asset)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90"
                              >
                                {t("assets.register.capitalise")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectCapitalisation(asset)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {t("assets.register.reject")}
                              </button>
                            </>
                            ) : null
                          ) : (
                            <>
                              {showAddAssetButton && canAssignAsset(asset.status) && asset.custody_state !== "pending_return" && (
                                <button
                                  type="button"
                                  onClick={() => setAssignAsset(asset)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10"
                                >
                                  {t("assets.assign")}
                                </button>
                              )}
                              {showAddAssetButton && (
                                <Link
                                  href={`/assets/${asset.id}/edit`}
                                  className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-primary transition-colors"
                                  aria-label="Edit asset"
                                >
                                  <span className="material-symbols-outlined text-[20px]">edit</span>
                                </Link>
                              )}
                              {showAddAssetButton && asset.custody_state === "pending_return" && (
                                <button
                                  type="button"
                                  onClick={() => void handleConfirmReturn(asset)}
                                  disabled={confirmingReturnId === asset.id}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  {confirmingReturnId === asset.id ? t("common.loading") : t("assets.register.confirmReturn")}
                                </button>
                              )}
                              {canDispose && asset.status === "pending_disposal" && (
                                <Link
                                  href="/assets/disposal"
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-50"
                                >
                                  {t("assets.register.pendingDisposal")}
                                </Link>
                              )}
                              {canDispose && RETIREABLE_STATUSES.has(asset.status) && (
                                <Link
                                  href={`/assets/disposal?asset=${asset.id}`}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  {t("assets.register.dispose")}
                                </Link>
                              )}
                              {canRetire && RETIREABLE_STATUSES.has(asset.status) && (
                                <button
                                  type="button"
                                  onClick={() => void handleRetire(asset)}
                                  disabled={retiringId === asset.id}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                                >
                                  {retiringId === asset.id ? "…" : t("assets.register.retire")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div data-testid="asset-register-pagination">
              <ListPagination
                page={page}
                lastPage={lastPage}
                total={filteredTotal}
                onPageChange={setPage}
              />
            </div>
            </>
          ) : hasInventory ? (
            <div className="card p-10 text-center">
              <span className="material-symbols-outlined text-3xl text-neutral-300">search_off</span>
              <p className="mt-2 text-sm font-semibold text-neutral-600">{t("assets.register.emptyFiltered")}</p>
              <button type="button" onClick={() => { setSearchInput(""); setSearch(""); setFilterStatus("live"); setFilterCategory("all"); setPage(1); }} className="mt-3 text-xs text-primary hover:underline">{t("assets.register.clearFilters")}</button>
            </div>
          ) : (
            <div className="card p-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
                <span className="material-symbols-outlined text-4xl text-neutral-300">inventory_2</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-600">{t("assets.register.empty")}</p>
              <p className="text-xs text-neutral-400 mt-1">{t("assets.register.emptyHint")}</p>
              {showRequestButton && (
                <Link href="/assets/requests?new=1" className="btn-primary mt-5 inline-flex">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Request Asset
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {capitaliseAsset && (
        <CapitaliseModal
          asset={capitaliseAsset}
          onClose={() => setCapitaliseAsset(null)}
          onSaved={() => {
            void loadAssets();
            setCapitaliseAsset(null);
          }}
        />
      )}
      {assignAsset && (
        <AssignModal
          asset={assignAsset}
          onClose={() => setAssignAsset(null)}
          onSaved={() => {
            void loadAssets();
            setAssignAsset(null);
          }}
        />
      )}
      {rejectAsset && (
        <RejectCapitalisationModal
          asset={rejectAsset}
          onClose={() => setRejectAsset(null)}
          onSaved={() => {
            void loadAssets();
            setRejectAsset(null);
          }}
        />
      )}
      <AssetLabelsQuickPrintModal
        open={labelsOpen}
        assetIds={labelIds}
        onClose={() => setLabelsOpen(false)}
      />
    </div>
  );
}
