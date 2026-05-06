"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { vendorsApi, vendorAttachmentsApi, supplierCategoriesApi, VENDOR_DOC_TYPES, type Vendor, type VendorRating, type VendorContract, type VendorPerformanceEvaluation, type ProcurementAttachment, type SupplierCategory } from "@/lib/api";
import { canManageProcurementVendors, getStoredUser } from "@/lib/auth";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { formatDateShort, formatCurrency } from "@/lib/utils";

function canManageVendors(): boolean {
  return canManageProcurementVendors(getStoredUser());
}

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return isFinite(n) ? n : null;
};

// ─── Star Components ──────────────────────────────────────────────────────────
function StarDisplay({ avg, count }: { avg?: number | null; count?: number }) {
  const safeAvg = toNum(avg);
  if (safeAvg == null) return <span className="text-sm text-neutral-400">No ratings yet</span>;
  const full = Math.floor(safeAvg);
  const half = safeAvg - full >= 0.5;
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-symbols-outlined text-[22px] leading-none ${
          i < full ? "text-amber-400" : i === full && half ? "text-amber-300" : "text-neutral-200"
        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {i < full ? "star" : i === full && half ? "star_half" : "star"}
        </span>
      ))}
      <span className="text-sm font-bold text-neutral-700 ml-1">{safeAvg.toFixed(1)}</span>
      <span className="text-xs text-neutral-400">/ 5</span>
      {count !== undefined && <span className="text-xs text-neutral-400">· {count} {count === 1 ? "rating" : "ratings"}</span>}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        const filled = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            className={`material-symbols-outlined text-[30px] leading-none transition-colors ${
              filled ? "text-amber-400" : "text-neutral-200 hover:text-amber-300"
            }`}
            style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
          >
            star
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-neutral-600">
          {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][value]}
        </span>
      )}
    </div>
  );
}

// ─── Rating Distribution ───────────────────────────────────────────────────────
function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="material-symbols-outlined text-[13px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
      <span className="w-2 text-neutral-500 text-right">{star}</span>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-2 rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-neutral-400 text-right">{count}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:  { label: "Approved",  cls: "badge-success", icon: "check_circle"  },
  submitted: { label: "Pending",   cls: "badge-warning", icon: "pending"       },
  rejected:  { label: "Rejected",  cls: "badge-danger",  icon: "cancel"        },
  draft:     { label: "Draft",     cls: "badge-muted",   icon: "edit_note"     },
  awarded:   { label: "Awarded",   cls: "badge-primary", icon: "emoji_events"  },
};

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  goods:    { icon: "inventory_2",  color: "text-primary",    bg: "bg-primary/10"  },
  services: { icon: "handyman",     color: "text-purple-600", bg: "bg-purple-50"   },
  works:    { icon: "construction", color: "text-orange-600", bg: "bg-orange-50"   },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonDetail() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="h-5 w-40 rounded bg-neutral-100" />
      <div className="card p-6 space-y-4">
        <div className="h-6 w-64 rounded bg-neutral-100" />
        <div className="h-4 w-48 rounded bg-neutral-100" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-neutral-100" />
              <div className="h-4 w-32 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100">
          <div className="h-4 w-36 rounded bg-neutral-100" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-5 py-3 border-b border-neutral-50 flex gap-4">
            <div className="h-4 w-24 rounded bg-neutral-100" />
            <div className="h-4 w-40 rounded bg-neutral-100" />
            <div className="h-4 w-20 rounded bg-neutral-100 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const PAYMENT_TERMS_EDIT  = ["Immediate", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"] as const;

const COUNTRIES_EDIT = [
  "Botswana", "Comoros", "Democratic Republic of Congo", "Eswatini", "Lesotho",
  "Madagascar", "Malawi", "Mauritius", "Mozambique", "Namibia", "Seychelles",
  "South Africa", "Tanzania", "Zambia", "Zimbabwe", "Other",
] as const;

type EditTab = "basic" | "contact" | "banking" | "admin";

interface EditModalProps {
  vendor: Vendor;
  onClose: () => void;
}

function EditModal({ vendor, onClose }: EditModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EditTab>("basic");
  const [form, setForm] = useState({
    name:                vendor.name                ?? "",
    contact_name:        vendor.contact_name        ?? "",
    registration_number: vendor.registration_number ?? "",
    tax_number:          vendor.tax_number          ?? "",
    category_ids:        (vendor.categories ?? []).map((c) => c.id),
    country:             vendor.country             ?? "",
    website:             vendor.website             ?? "",
    contact_email:       vendor.contact_email       ?? "",
    contact_phone:       vendor.contact_phone       ?? "",
    address:             vendor.address             ?? "",
    payment_terms:       vendor.payment_terms       ?? "",
    bank_name:           vendor.bank_name           ?? "",
    bank_account:        vendor.bank_account        ?? "",
    bank_branch:         vendor.bank_branch         ?? "",
    is_sme:              vendor.is_sme              ?? false,
    notes:               vendor.notes               ?? "",
    is_approved:         vendor.is_approved         ?? false,
    is_active:           vendor.is_active           ?? true,
  });
  const [formError, setFormError] = useState("");

  const { data: categoriesData, isLoading: catsLoading } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const availableCategories: SupplierCategory[] = (categoriesData ?? []).filter((c) => c.is_active);

  const toggleCategory = (id: number) => {
    setForm((f) => {
      if (f.category_ids.includes(id)) return { ...f, category_ids: f.category_ids.filter((x) => x !== id) };
      if (f.category_ids.length >= 3) return f;
      return { ...f, category_ids: [...f.category_ids, id] };
    });
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) => vendorsApi.update(vendor.id, data as unknown as Partial<Vendor>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", vendor.id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update vendor.";
      setFormError(msg);
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { setFormError("Vendor name is required."); setTab("basic"); return; }
    if (form.category_ids.length === 0) { setFormError("Select at least one category."); setTab("basic"); return; }
    setFormError("");
    mutation.mutate(form);
  };

  const EDIT_TABS = [
    { key: "basic"   as EditTab, label: "Business", icon: "business"        },
    { key: "contact" as EditTab, label: "Contact",  icon: "contacts"        },
    { key: "banking" as EditTab, label: "Banking",  icon: "account_balance" },
    { key: "admin"   as EditTab, label: "Admin",    icon: "settings"        },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-[20px] text-primary">edit</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Edit Vendor</h2>
              <p className="text-xs text-neutral-500">{vendor.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-neutral-200 px-6 mt-4 flex-shrink-0">
          {EDIT_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {formError && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 flex-shrink-0">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {formError}
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {tab === "basic" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Vendor Name <span className="text-red-500">*</span></label>
                <input type="text" className="form-input" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              {(["registration_number", "tax_number"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">{k === "registration_number" ? "Registration Number" : "VAT / Tax Number"}</label>
                  <input type="text" className="form-input" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-600">
                    Categories <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs font-medium tabular-nums ${form.category_ids.length === 3 ? "text-amber-600" : "text-neutral-400"}`}>
                    {form.category_ids.length} / 3 selected
                  </span>
                </div>
                {catsLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4].map((i) => <div key={i} className="h-9 rounded-lg bg-neutral-100 animate-pulse" />)}
                  </div>
                ) : availableCategories.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-2">No categories configured.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {availableCategories.map((cat) => {
                      const selected = form.category_ids.includes(cat.id);
                      const disabled = !selected && form.category_ids.length >= 3;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleCategory(cat.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all
                            ${selected
                              ? "border-primary bg-primary/8 text-primary font-semibold"
                              : disabled
                                ? "border-neutral-100 bg-neutral-50 text-neutral-300 cursor-not-allowed"
                                : "border-neutral-200 text-neutral-600 hover:border-primary/50 hover:bg-primary/5"
                            }`}
                        >
                          <span className={`material-symbols-outlined flex-shrink-0 text-[16px] ${selected ? "text-primary" : "text-neutral-300"}`}
                            style={{ fontVariationSettings: selected ? "'FILL' 1" : "'FILL' 0" }}>
                            check_box{selected ? "" : "_outline_blank"}
                          </span>
                          <span className="truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-neutral-400">Select up to 3 categories that best describe this vendor.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Country</label>
                <select className="form-input" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}>
                  <option value="">— Select —</option>
                  {COUNTRIES_EDIT.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Website</label>
                <input type="url" className="form-input" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://" />
              </div>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary" checked={form.is_sme} onChange={(e) => setForm((f) => ({ ...f, is_sme: e.target.checked }))} />
                  <span className="text-xs font-medium text-neutral-700">Small or Medium Enterprise (SME)</span>
                </label>
              </div>
            </div>
          )}
          {tab === "contact" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Primary Contact Person</label>
                <input type="text" className="form-input" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
              {(["contact_email", "contact_phone"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">{k === "contact_email" ? "Contact Email" : "Contact Phone"}</label>
                  <input type={k === "contact_email" ? "email" : "text"} className="form-input" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Address</label>
                <input type="text" className="form-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
          )}
          {tab === "banking" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Bank Name</label>
                <input type="text" className="form-input" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Payment Terms</label>
                <select className="form-input" value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}>
                  <option value="">— Select —</option>
                  {PAYMENT_TERMS_EDIT.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Account Number</label>
                <input type="text" className="form-input" value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Branch / SWIFT Code</label>
                <input type="text" className="form-input" value={form.bank_branch} onChange={(e) => setForm((f) => ({ ...f, bank_branch: e.target.value }))} />
              </div>
            </div>
          )}
          {tab === "admin" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Internal Notes</label>
                <textarea className="form-input h-28 resize-none" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex gap-6">
                {(["is_approved", "is_active"] as const).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary" checked={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))} />
                    <span className="text-xs font-medium text-neutral-700">{k === "is_approved" ? "Approved" : "Active"}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-60">
            {mutation.isPending && <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>}
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete / Deactivate Dialog ───────────────────────────────────────────────
function DeactivateDialog({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => vendorsApi.destroy(vendor.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      router.push("/procurement/vendors");
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
            <span className="material-symbols-outlined text-[22px] text-red-600">warning</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Deactivate Vendor?</h3>
            <p className="mt-1 text-xs text-neutral-500">
              <strong className="text-neutral-700">{vendor.name}</strong> will be marked inactive.
              Existing quote history is preserved.
            </p>
          </div>
        </div>
        {mutation.isError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Failed to deactivate vendor. Please try again.
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending && (
              <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
            )}
            {mutation.isPending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main detail page ─────────────────────────────────────────────────────────
export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const vendorId = Number(id);
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit]               = useState(false);
  const [showDeactivate, setShowDeactivate]   = useState(false);
  const [showReject, setShowReject]           = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [rejectError, setRejectError]         = useState<string | null>(null);
  const [activeTab, setActiveTab]               = useState<"details" | "ratings" | "contracts" | "documents" | "compliance">("details");
  const [attachments, setAttachments]           = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading]               = useState(false);
  const [myRating, setMyRating]                 = useState(0);
  const [myReview, setMyReview]                 = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingToast, setRatingToast]           = useState<string | null>(null);
  const [showBlacklist, setShowBlacklist]       = useState(false);
  const [blacklistReason, setBlacklistReason]   = useState("");
  const [blacklistRef, setBlacklistRef]         = useState("");
  // Evaluation form state
  const [evalScores, setEvalScores]   = useState({ delivery: 0, quality: 0, price: 0, compliance: 0, communication: 0 });
  const [evalContractId, setEvalContractId] = useState<number | "">("");
  const [evalNotes, setEvalNotes]           = useState("");
  const [evalSubmitting, setEvalSubmitting] = useState(false);

  useEffect(() => {
    if (vendorId) vendorAttachmentsApi.list(vendorId).then((r) => setAttachments(r.data.data ?? [])).catch(() => {});
  }, [vendorId]);

  const approveMutation = useMutation({
    mutationFn: () => vendorsApi.approve(vendorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => vendorsApi.reject(vendorId, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      setShowReject(false);
      setRejectReason("");
    },
    onError: (e: unknown) => {
      setRejectError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to reject vendor.");
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn:  () => vendorsApi.get(vendorId).then((r) => r.data.data),
    enabled:  !!vendorId,
  });

  const { data: contractsData } = useQuery({
    queryKey: ["vendor-contracts", vendorId],
    queryFn:  () => vendorsApi.listContracts(vendorId).then((r) => r.data.data as VendorContract[]),
    enabled:  !!vendorId && activeTab === "contracts",
  });

  const { data: evaluationsData, refetch: refetchEvaluations } = useQuery({
    queryKey: ["vendor-evaluations", vendorId],
    queryFn:  () => vendorsApi.listEvaluations(vendorId).then((r) => r.data.data as VendorPerformanceEvaluation[]),
    enabled:  !!vendorId && (activeTab === "ratings" || activeTab === "compliance"),
  });

  if (isLoading) return <SkeletonDetail />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
          <p className="text-sm text-neutral-500">Vendor not found or failed to load.</p>
          <Link href="/procurement/vendors" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Vendors
          </Link>
        </div>
      </div>
    );
  }

  const vendor = data;
  const quotes = vendor.recent_quotes ?? [];
  const ratings: VendorRating[] = vendor.ratings ?? [];
  const avgRating = toNum(vendor.ratings_avg_rating);

  // Pre-populate own rating once data loads
  const preloadedMyRating = vendor.my_rating?.rating ?? 0;
  if (myRating === 0 && preloadedMyRating > 0 && myReview === "") {
    setMyRating(preloadedMyRating);
    setMyReview(vendor.my_rating?.review ?? "");
  }

  const handleSubmitRating = async () => {
    if (!myRating) return;
    setRatingSubmitting(true);
    try {
      await vendorsApi.rate(vendorId, myRating, myReview || undefined);
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      setRatingToast("Rating saved.");
      setTimeout(() => setRatingToast(null), 3000);
    } catch {
      setRatingToast("Failed to save rating.");
      setTimeout(() => setRatingToast(null), 3000);
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Distribution counts
  const dist = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: ratings.filter((r) => r.rating === s).length,
  }));

  const infoRow = (icon: string, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-[17px] text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-neutral-800 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Toast */}
        {ratingToast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {ratingToast}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-neutral-200">
          {([
            { key: "details",   label: "Details"  },
            { key: "ratings",   label: `Ratings${ratings.length > 0 ? ` (${ratings.length})` : ""}` },
            { key: "contracts", label: `Contracts${contractsData && contractsData.length > 0 ? ` (${contractsData.length})` : ""}` },
            { key: "documents",  label: `Documents${attachments.length > 0 ? ` (${attachments.length})` : ""}` },
            { key: "compliance", label: "Compliance" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Contracts Tab ─────────────────────────────────────────────────── */}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            {/* Summary card */}
            {contractsData && contractsData.length > 0 && (() => {
              const activeContracts = contractsData.filter(c => c.status === "active");
              const totalActive = activeContracts.reduce((s, c) => s + (c.value ?? 0), 0);
              const currency = activeContracts[0]?.currency ?? "USD";
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Contracts",  value: contractsData.length,                  icon: "description",   color: "text-primary",    bg: "bg-primary/10" },
                    { label: "Active",           value: activeContracts.length,                icon: "check_circle",  color: "text-green-600",  bg: "bg-green-50"   },
                    { label: "Terminated",       value: contractsData.filter(c => c.status === "terminated").length, icon: "cancel", color: "text-red-500", bg: "bg-red-50" },
                    { label: "Active Value",     value: formatCurrency(totalActive, currency), icon: "payments",      color: "text-amber-600",  bg: "bg-amber-50"   },
                  ].map(s => (
                    <div key={s.label} className="card p-4">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} mb-2`}>
                        <span className={`material-symbols-outlined text-[17px] ${s.color}`}>{s.icon}</span>
                      </div>
                      <p className="text-lg font-bold text-neutral-900">{s.value}</p>
                      <p className="text-xs text-neutral-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
                <SectionIcon icon="description" color="text-primary" bg="bg-primary/10" />
                <div>
                  <h2 className="text-sm font-semibold text-neutral-800">Contracts</h2>
                  <p className="text-xs text-neutral-400">All contracts linked to this vendor</p>
                </div>
              </div>
              {!contractsData || contractsData.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <span className="material-symbols-outlined text-3xl">description</span>
                  <p className="text-sm">No contracts found for this vendor.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Reference</th>
                        <th className="text-left">Title</th>
                        <th className="text-right">Value</th>
                        <th className="text-left">Start</th>
                        <th className="text-left">End</th>
                        <th className="text-left">Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {contractsData.map((c) => {
                        const contractStatusCfg: Record<string, { cls: string; label: string }> = {
                          active:     { cls: "badge-success", label: "Active"     },
                          draft:      { cls: "badge-muted",   label: "Draft"      },
                          completed:  { cls: "badge-primary", label: "Completed"  },
                          terminated: { cls: "badge-danger",  label: "Terminated" },
                        };
                        const st = contractStatusCfg[c.status] ?? { cls: "badge-muted", label: c.status };
                        // Expiry warning: ends within 30 days and is still active
                        const daysLeft = c.end_date
                          ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
                          : null;
                        const expiring = c.status === "active" && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                        return (
                          <tr key={c.id} className="group hover:bg-neutral-50/60">
                            <td className="font-mono text-xs text-neutral-600">{c.reference_number ?? "—"}</td>
                            <td className="font-medium text-neutral-800 max-w-[180px] truncate">
                              {c.title ?? "—"}
                              {expiring && (
                                <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                  <span className="material-symbols-outlined text-[11px]">warning</span>
                                  Exp. {daysLeft}d
                                </span>
                              )}
                            </td>
                            <td className="text-right font-mono text-sm font-semibold text-neutral-800">
                              {c.value != null ? formatCurrency(c.value, c.currency ?? "USD") : "—"}
                            </td>
                            <td className="text-sm text-neutral-500">{c.start_date ? formatDateShort(c.start_date) : "—"}</td>
                            <td className="text-sm text-neutral-500">{c.end_date ? formatDateShort(c.end_date) : "—"}</td>
                            <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                            <td>
                              <Link href={`/procurement/contracts/${c.id}`} className="text-xs text-primary hover:underline font-medium">
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-neutral-800 mb-5">Vendor Documents</h2>
            <GenericDocumentsPanel
              documents={attachments}
              documentTypes={VENDOR_DOC_TYPES as unknown as { value: string; label: string; icon: string }[]}
              defaultType="company_profile"
              loading={false}
              uploading={uploading}
              onUpload={async (file, type) => {
                setUploading(true);
                try { const r = await vendorAttachmentsApi.upload(vendorId, file, type); setAttachments((p) => [r.data.data, ...p]); }
                finally { setUploading(false); }
              }}
              onDelete={async (id) => { await vendorAttachmentsApi.delete(vendorId, id); setAttachments((p) => p.filter((a) => a.id !== id)); }}
              downloadUrl={(id) => vendorAttachmentsApi.downloadUrl(vendorId, id)}
            />
          </div>
        )}

        {/* ── Compliance Tab ────────────────────────────────────────────────── */}
        {activeTab === "compliance" && (() => {
          const evals = evaluationsData ?? [];
          const avgCompliance = evals.length > 0 ? evals.reduce((s, e) => s + e.compliance_score, 0) / evals.length : null;
          const avgDelivery   = evals.length > 0 ? evals.reduce((s, e) => s + e.delivery_score, 0) / evals.length : null;
          const avgQuality    = evals.length > 0 ? evals.reduce((s, e) => s + e.quality_score, 0) / evals.length : null;
          const avgPrice      = evals.length > 0 ? evals.reduce((s, e) => s + e.price_score, 0) / evals.length : null;
          const avgComms      = evals.length > 0 ? evals.reduce((s, e) => s + e.communication_score, 0) / evals.length : null;

          const scoreColor = (s: number | null) =>
            !s ? "text-neutral-400" : s >= 80 ? "text-green-600" : s >= 60 ? "text-amber-600" : "text-red-600";
          const ragDot = (s: number | null) =>
            !s ? "bg-neutral-200" : s >= 80 ? "bg-green-500" : s >= 60 ? "bg-amber-400" : "bg-red-500";

          const complianceDocs = attachments.filter((a) =>
            ["registration_certificate", "tax_clearance", "company_profile", "certificate", "insurance", "bee_certificate"].some((t) => a.document_type?.toLowerCase().includes(t)),
          );

          return (
            <div className="space-y-5">
              {/* Blacklist / debarment banner */}
              {vendor.is_blacklisted && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-600 text-[22px] mt-0.5">block</span>
                  <div>
                    <p className="text-sm font-bold text-red-800">Vendor is Blacklisted / Debarred</p>
                    {vendor.blacklist_reason && (
                      <p className="text-xs text-red-700 mt-0.5">{vendor.blacklist_reason}</p>
                    )}
                    {vendor.blacklist_reference && (
                      <p className="text-xs text-red-600 mt-0.5">Ref: {vendor.blacklist_reference}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Compliance score overview */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <SectionIcon icon="verified_user" color="text-green-600" bg="bg-green-50" />
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800">Compliance Score</h3>
                    <p className="text-xs text-neutral-400">Based on {evals.length} performance evaluation{evals.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                {evals.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">No evaluations recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { label: "Compliance",     value: avgCompliance },
                      { label: "Delivery",       value: avgDelivery },
                      { label: "Quality",        value: avgQuality },
                      { label: "Price",          value: avgPrice },
                      { label: "Communication",  value: avgComms },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <span className={`h-3 w-3 rounded-full ${ragDot(value)}`} />
                        </div>
                        <p className={`text-2xl font-bold ${scoreColor(value)}`}>
                          {value != null ? `${Math.round(value)}%` : "—"}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Registration details */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <SectionIcon icon="business" color="text-primary" bg="bg-primary/10" />
                  <h3 className="text-sm font-semibold text-neutral-800">Registration & Tax Status</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    { label: "Registration Number", value: vendor.registration_number, icon: "badge" },
                    { label: "Tax Number",          value: vendor.tax_number,          icon: "receipt" },
                    { label: "Country",             value: vendor.country,             icon: "location_on" },
                    { label: "Vendor Status",       value: vendor.is_blacklisted ? "Blacklisted" : !vendor.is_active ? "Inactive" : !vendor.is_approved ? "Pending Approval" : "Active & Approved", icon: "info" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-start gap-3 rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3">
                      <span className="material-symbols-outlined text-neutral-400 text-[18px] mt-0.5">{icon}</span>
                      <div>
                        <p className="text-xs text-neutral-400">{label}</p>
                        <p className={`text-sm font-medium mt-0.5 ${!value ? "text-neutral-300 italic" : "text-neutral-800"}`}>
                          {value ?? "Not provided"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance documents */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">folder_open</span>
                    <span className="text-sm font-semibold text-neutral-700">Compliance Documents</span>
                    {complianceDocs.length > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {complianceDocs.length} on file
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => setActiveTab("documents")} className="text-xs text-primary hover:underline">
                    Manage all documents
                  </button>
                </div>
                {complianceDocs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-neutral-300">
                    <span className="material-symbols-outlined text-[32px]">folder_open</span>
                    <p className="text-sm text-neutral-400">No compliance documents uploaded.</p>
                    <button type="button" onClick={() => setActiveTab("documents")}
                      className="text-xs text-primary hover:underline">
                      Upload documents in the Documents tab
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-50">
                    {complianceDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 transition-colors">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary text-[18px]">description</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{doc.original_filename}</p>
                          <p className="text-[11px] text-neutral-400 capitalize">
                            {doc.document_type?.replace(/_/g, " ") ?? "Document"} · Uploaded {formatDateShort(doc.created_at)}
                          </p>
                        </div>
                        <a href={vendorAttachmentsApi.downloadUrl(vendorId, doc.id)} target="_blank" rel="noreferrer"
                          className="text-neutral-400 hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">download</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Performance history RAG table */}
              {evals.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-neutral-400">analytics</span>
                      <span className="text-sm font-semibold text-neutral-700">Performance History</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Good ≥80%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Warning ≥60%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Critical</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>Contract Ref</th>
                          <th className="text-center">Delivery</th>
                          <th className="text-center">Quality</th>
                          <th className="text-center">Price</th>
                          <th className="text-center">Compliance</th>
                          <th className="text-center">Communication</th>
                          <th className="text-right">Overall</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evals.map((ev) => (
                          <tr key={ev.id}>
                            <td className="font-mono text-[11px] text-neutral-500">
                              {ev.contract?.reference_number ?? `EVL-${ev.id}`}
                            </td>
                            {[ev.delivery_score, ev.quality_score, ev.price_score, ev.compliance_score, ev.communication_score].map((s, i) => (
                              <td key={i} className="text-center">
                                <span className={`inline-block h-3 w-3 rounded-full ${ragDot(s)}`} title={`${s}%`} />
                              </td>
                            ))}
                            <td className="text-right">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                ev.overall_score >= 80 ? "bg-green-100 text-green-700" :
                                ev.overall_score >= 60 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {ev.overall_score}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Ratings Tab ───────────────────────────────────────────────────── */}
        {activeTab === "ratings" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <SectionIcon icon="star" color="text-amber-500" bg="bg-amber-50" />
                <h2 className="text-sm font-semibold text-neutral-800">Vendor Rating</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                {/* Big average */}
                <div className="flex flex-col items-center gap-2 min-w-[120px]">
                  <span className="text-5xl font-black text-neutral-900">
                    {avgRating ? avgRating.toFixed(1) : "—"}
                  </span>
                  <StarDisplay avg={avgRating} />
                  <span className="text-xs text-neutral-400">{ratings.length} {ratings.length === 1 ? "rating" : "ratings"}</span>
                </div>
                {/* Distribution bars */}
                {ratings.length > 0 && (
                  <div className="flex-1 space-y-1.5 min-w-[180px]">
                    {dist.map((d) => (
                      <RatingBar key={d.star} star={d.star} count={d.count} total={ratings.length} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit / Update own rating */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <SectionIcon icon="rate_review" color="text-primary" bg="bg-primary/10" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800">Your Rating</h3>
                  <p className="text-xs text-neutral-400">{vendor.my_rating ? "Update your existing rating" : "Share your experience with this vendor"}</p>
                </div>
              </div>
              <StarPicker value={myRating} onChange={setMyRating} />
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Review <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="form-input h-20 resize-none"
                  placeholder="Describe your experience with this vendor…"
                  value={myReview}
                  onChange={(e) => setMyReview(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!myRating || ratingSubmitting}
                  onClick={handleSubmitRating}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
                >
                  {ratingSubmitting && (
                    <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                  )}
                  {ratingSubmitting ? "Saving…" : vendor.my_rating ? "Update Rating" : "Submit Rating"}
                </button>
                {vendor.my_rating && (
                  <span className="text-xs text-neutral-400">
                    You rated {vendor.my_rating.rating} ★ previously
                  </span>
                )}
              </div>
            </div>

            {/* All ratings list */}
            {ratings.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100">
                  <h3 className="text-sm font-semibold text-neutral-800">All Reviews</h3>
                </div>
                <div className="divide-y divide-neutral-50">
                  {ratings.map((r) => (
                    <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {(r.rater?.name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-neutral-800">{r.rater?.name ?? "Staff member"}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <span key={i} className={`material-symbols-outlined text-[14px] leading-none ${i < r.rating ? "text-amber-400" : "text-neutral-200"}`} style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            ))}
                            <span className="text-xs text-neutral-400 ml-0.5">{formatDateShort(r.updated_at)}</span>
                          </div>
                        </div>
                        {r.review && <p className="text-sm text-neutral-600 mt-1">{r.review}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Performance Evaluations ─────────────────────────────────────── */}
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <SectionIcon icon="verified" color="text-purple-600" bg="bg-purple-50" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800">Performance Evaluations</h3>
                  <p className="text-xs text-neutral-400">Formal 5-dimension scored evaluations (linked to contracts)</p>
                </div>
              </div>

              {/* Submit evaluation form */}
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 space-y-4">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Submit Evaluation</p>
                {(["delivery", "quality", "price", "compliance", "communication"] as const).map((dim) => {
                  const labels: Record<typeof dim, { label: string; icon: string }> = {
                    delivery:      { label: "Delivery",      icon: "local_shipping" },
                    quality:       { label: "Quality",       icon: "high_quality"   },
                    price:         { label: "Price",         icon: "payments"       },
                    compliance:    { label: "Compliance",    icon: "gavel"          },
                    communication: { label: "Communication", icon: "forum"          },
                  };
                  return (
                    <div key={dim} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-36 flex-shrink-0">
                        <span className="material-symbols-outlined text-[15px] text-neutral-400">{labels[dim].icon}</span>
                        <span className="text-xs font-medium text-neutral-600">{labels[dim].label}</span>
                      </div>
                      <StarPicker value={evalScores[dim]} onChange={(v) => setEvalScores((p) => ({ ...p, [dim]: v }))} />
                    </div>
                  );
                })}
                {/* Contract selector */}
                {contractsData && contractsData.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">
                      Linked Contract <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <select
                      className="form-input"
                      value={evalContractId}
                      onChange={(e) => setEvalContractId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">— None —</option>
                      {contractsData.map((c) => (
                        <option key={c.id} value={c.id}>{c.reference_number ?? `Contract #${c.id}`}{c.title ? ` — ${c.title}` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    Notes <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="form-input h-16 resize-none"
                    placeholder="Additional evaluation notes…"
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  disabled={evalSubmitting || !Object.values(evalScores).every(s => s > 0)}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
                  onClick={async () => {
                    setEvalSubmitting(true);
                    try {
                      await vendorsApi.submitEvaluation(vendorId, {
                        delivery_score:      evalScores.delivery,
                        quality_score:       evalScores.quality,
                        price_score:         evalScores.price,
                        compliance_score:    evalScores.compliance,
                        communication_score: evalScores.communication,
                        contract_id: evalContractId || undefined,
                        notes: evalNotes || undefined,
                      });
                      setEvalScores({ delivery: 0, quality: 0, price: 0, compliance: 0, communication: 0 });
                      setEvalContractId("");
                      setEvalNotes("");
                      refetchEvaluations();
                    } finally {
                      setEvalSubmitting(false);
                    }
                  }}
                >
                  {evalSubmitting && <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>}
                  {evalSubmitting ? "Submitting…" : "Submit Evaluation"}
                </button>
              </div>

              {/* Evaluation history */}
              {evaluationsData && evaluationsData.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Evaluation History</p>
                  {evaluationsData.map((ev) => {
                    const overall = toNum(ev.overall_score) ??
                      ([ev.delivery_score, ev.quality_score, ev.price_score, ev.compliance_score, ev.communication_score]
                        .map(s => toNum(s) ?? 0)
                        .reduce((a, b) => a + b, 0) / 5);
                    return (
                      <div key={ev.id} className="rounded-xl border border-neutral-100 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-purple-50 flex items-center justify-center text-xs font-bold text-purple-600">
                              {(ev.evaluator?.name ?? "?")[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-neutral-800">{ev.evaluator?.name ?? "Staff member"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-purple-600">{overall != null ? overall.toFixed(1) : "—"} / 5</span>
                            {ev.created_at && <span className="text-xs text-neutral-400">{formatDateShort(ev.created_at)}</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {(["delivery", "quality", "price", "compliance", "communication"] as const).map((dim) => {
                            const score = ev[`${dim}_score` as keyof VendorPerformanceEvaluation] as number;
                            return (
                              <div key={dim} className="rounded-lg bg-neutral-50 px-3 py-2">
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide capitalize mb-1">{dim}</p>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                                    <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width: `${(score / 5) * 100}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-neutral-700">{score}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {ev.notes && <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2">{ev.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "details" && <>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/procurement" className="hover:text-neutral-600 transition-colors">Procurement</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/procurement/vendors" className="hover:text-neutral-600 transition-colors">Vendors</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">{vendor.name}</span>
        </nav>

        {/* Blacklisted banner */}
        {vendor.is_blacklisted && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="material-symbols-outlined text-[20px] text-red-600 mt-0.5 flex-shrink-0">gpp_bad</span>
            <div>
              <p className="text-sm font-semibold text-red-700">This vendor is blacklisted</p>
              {vendor.blacklist_reason && (
                <p className="text-xs text-red-600 mt-0.5">{vendor.blacklist_reason}</p>
              )}
              {vendor.blacklisted_at && (
                <p className="text-xs text-red-400 mt-0.5">Blacklisted on {formatDateShort(vendor.blacklisted_at)}</p>
              )}
            </div>
          </div>
        )}

        {/* Hero card */}
        <div className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: identity */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[28px]">storefront</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{vendor.name}</h1>
                {vendor.registration_number && (
                  <p className="font-mono text-xs text-neutral-500 mt-0.5">{vendor.registration_number}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {vendor.is_blacklisted ? (
                    <span className="badge badge-danger">Blacklisted</span>
                  ) : vendor.is_active ? (
                    vendor.is_approved ? (
                      <span className="badge badge-success">Approved</span>
                    ) : (
                      <span className="badge badge-warning">Pending Approval</span>
                    )
                  ) : (
                    <span className="badge badge-muted">Inactive</span>
                  )}
                  {vendor.is_sme && <span className="badge badge-primary">SME</span>}
                  {vendor.category && (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                      <span className="material-symbols-outlined text-[13px]">category</span>
                      {vendor.category}
                    </span>
                  )}
                  {vendor.country && (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                      <span className="material-symbols-outlined text-[13px]">public</span>
                      {vendor.country}
                    </span>
                  )}
                  <span className="badge badge-primary">{vendor.quotes_count ?? 0} quotes</span>
                  {avgRating && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {avgRating.toFixed(1)}
                    </span>
                  )}
                  {vendor.created_at && (
                    <span className="text-xs text-neutral-400">
                      Registered {formatDateShort(vendor.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* Approve / Reject — only for pending vendors with permission */}
              {!vendor.is_approved && vendor.is_active && canManageVendors() && (
                <>
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="btn-primary flex items-center gap-1.5 py-2 px-3 text-sm"
                  >
                    <span className="material-symbols-outlined text-[17px]">check_circle</span>
                    {approveMutation.isPending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px]">cancel</span>
                    Reject
                  </button>
                </>
              )}
              {canManageVendors() && (
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">edit</span>
                  Edit
                </button>
              )}
              {canManageVendors() && vendor.is_active && !vendor.is_blacklisted && (
                <button
                  type="button"
                  onClick={() => setShowDeactivate(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">block</span>
                  Deactivate
                </button>
              )}
              {canManageVendors() && !vendor.is_blacklisted && (
                <button
                  type="button"
                  onClick={() => setShowBlacklist(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">gpp_bad</span>
                  Blacklist
                </button>
              )}
              {canManageVendors() && vendor.is_blacklisted && (
                <button
                  type="button"
                  onClick={async () => {
                    await vendorsApi.unblacklist(vendorId);
                    queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
                    queryClient.invalidateQueries({ queryKey: ["vendors"] });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">verified_user</span>
                  Remove from Blacklist
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Contact info card */}
          <div className="lg:col-span-1 card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <SectionIcon icon="contacts" color="text-primary" bg="bg-primary/10" />
              <h2 className="text-sm font-semibold text-neutral-800">Contact Information</h2>
            </div>
            <div className="space-y-4">
              {vendor.contact_name && infoRow("person", "Contact Person", vendor.contact_name)}
              {infoRow(
                "mail",
                "Email",
                vendor.contact_email ? (
                  <a href={`mailto:${vendor.contact_email}`} className="text-primary hover:underline">
                    {vendor.contact_email}
                  </a>
                ) : <span className="text-neutral-400">Not provided</span>
              )}
              {infoRow("phone", "Phone", vendor.contact_phone ?? <span className="text-neutral-400">Not provided</span>)}
              {infoRow("location_on", "Address", vendor.address ?? <span className="text-neutral-400">Not provided</span>)}
              {vendor.website && infoRow(
                "language",
                "Website",
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                  {vendor.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {vendor.tax_number && infoRow("receipt_long", "VAT / Tax No.", vendor.tax_number)}
              {vendor.payment_terms && infoRow("schedule", "Payment Terms", vendor.payment_terms)}
              {vendor.bank_name && (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Banking Details</p>
                  {vendor.bank_name && <p className="text-xs text-neutral-700">{vendor.bank_name}</p>}
                  {vendor.bank_account && <p className="text-xs font-mono text-neutral-600">{vendor.bank_account}</p>}
                  {vendor.bank_branch && <p className="text-[10px] text-neutral-500">Branch: {vendor.bank_branch}</p>}
                </div>
              )}
              {vendor.notes && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Internal Notes</p>
                  <p className="text-xs text-neutral-700">{vendor.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Vendor stats card */}
          <div className="lg:col-span-2 card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <SectionIcon icon="analytics" color="text-purple-600" bg="bg-purple-50" />
              <h2 className="text-sm font-semibold text-neutral-800">Procurement Activity</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Total Quotes",
                  value: vendor.quotes_count ?? 0,
                  icon: "request_quote",
                  color: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  label: "Recommended",
                  value: quotes.filter((q) => q.is_recommended).length,
                  icon: "thumb_up",
                  color: "text-green-600",
                  bg: "bg-green-50",
                },
                {
                  label: "Unique RFQs",
                  value: new Set(quotes.map((q) => q.procurement_request?.id)).size,
                  icon: "description",
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg} mb-3`}>
                    <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Latest quote value breakdown */}
            {quotes.length > 0 && (() => {
              const recommended = quotes.filter((q) => q.is_recommended);
              const totalValue  = recommended.reduce((s, q) => s + q.quoted_amount, 0);
              const currency    = recommended[0]?.currency ?? "USD";
              return (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-amber-500">payments</span>
                    <span className="text-xs text-neutral-500">Total recommended quote value</span>
                  </div>
                  <span className="text-sm font-bold text-neutral-800">
                    {formatCurrency(totalValue, currency)}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Procurement requests linked */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
            <SectionIcon icon="shopping_bag" color="text-orange-600" bg="bg-orange-50" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Linked Procurement Requests</h2>
              <p className="text-xs text-neutral-400">Requests where this vendor has submitted a quote</p>
            </div>
          </div>

          {quotes.length === 0 ? (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-neutral-400">
                <span className="material-symbols-outlined text-3xl">request_quote</span>
                <p className="text-sm">No quotes submitted yet.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Reference</th>
                    <th className="text-left">Title</th>
                    <th className="text-left">Category</th>
                    <th className="text-right">Quoted Amount</th>
                    <th className="text-left">Quote Date</th>
                    <th className="text-left">Rec.</th>
                    <th className="text-left">RFQ Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const req = q.procurement_request;
                    const cat = req ? (categoryConfig[req.category] ?? categoryConfig.goods) : null;
                    const st  = req ? (statusConfig[req.status] ?? statusConfig.draft) : null;
                    return (
                      <tr key={q.id} className="group hover:bg-neutral-50/60">
                        <td>
                          {req ? (
                            <Link
                              href={`/procurement/${req.id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {req.reference_number}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="font-medium text-neutral-800 max-w-[200px] truncate">
                          {req?.title ?? "—"}
                        </td>
                        <td>
                          {cat && req ? (
                            <span className={`flex items-center gap-1 text-xs font-medium ${cat.color}`}>
                              <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                              <span className="capitalize">{req.category}</span>
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-sm font-semibold text-neutral-800">
                          {formatCurrency(q.quoted_amount, q.currency)}
                        </td>
                        <td className="text-sm text-neutral-500">
                          {q.quote_date ? formatDateShort(q.quote_date) : "—"}
                        </td>
                        <td>
                          {q.is_recommended ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                              <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                        <td>
                          {st ? (
                            <span className={`badge ${st.cls}`}>{st.label}</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes column - any quotes with notes */}
        {quotes.some((q) => q.notes) && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon="notes" color="text-teal-600" bg="bg-teal-50" />
              <h2 className="text-sm font-semibold text-neutral-800">Quote Notes</h2>
            </div>
            <div className="space-y-3">
              {quotes.filter((q) => q.notes).map((q) => (
                <div key={q.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-500">
                      {q.procurement_request?.reference_number ?? `Quote #${q.id}`}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {q.quote_date ? formatDateShort(q.quote_date) : ""}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700">{q.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </> /* end details tab */}
      </div>

      {/* Modals */}
      {showEdit && canManageVendors() && (
        <EditModal vendor={vendor} onClose={() => setShowEdit(false)} />
      )}
      {showDeactivate && canManageVendors() && (
        <DeactivateDialog vendor={vendor} onClose={() => setShowDeactivate(false)} />
      )}
      {showBlacklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowBlacklist(false)}>
          <div className="card w-full max-w-md p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-[20px] text-red-700">gpp_bad</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">Blacklist Vendor</h2>
                <p className="text-xs text-neutral-500">{vendor.name}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="form-input w-full h-24 resize-none"
                placeholder="Provide a formal reason for blacklisting this vendor…"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Reference / Case No. <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AUDIT/2026/001"
                value={blacklistRef}
                onChange={(e) => setBlacklistRef(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setShowBlacklist(false); setBlacklistReason(""); setBlacklistRef(""); }}>
                Cancel
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
                disabled={!blacklistReason.trim()}
                onClick={async () => {
                  await vendorsApi.blacklist(vendorId, blacklistReason, blacklistRef || undefined);
                  queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
                  queryClient.invalidateQueries({ queryKey: ["vendors"] });
                  setShowBlacklist(false);
                  setBlacklistReason("");
                  setBlacklistRef("");
                }}
              >
                <span className="material-symbols-outlined text-[14px]">gpp_bad</span>
                Confirm Blacklist
              </button>
            </div>
          </div>
        </div>
      )}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowReject(false)}>
          <div className="card w-full max-w-md p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-[20px] text-red-600">cancel</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">Reject Vendor</h2>
                <p className="text-xs text-neutral-500">{vendor.name}</p>
              </div>
            </div>
            {rejectError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{rejectError}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                className="form-input w-full h-24 resize-none"
                placeholder="Explain why this vendor is being rejected…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setShowReject(false); setRejectError(null); }}>Cancel</button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending
                  ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <span className="material-symbols-outlined text-[14px]">cancel</span>
                }
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
