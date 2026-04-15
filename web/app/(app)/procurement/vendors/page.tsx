"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierCategoriesApi, vendorsApi, type SupplierCategory, type Vendor } from "@/lib/api";
import { canManageProcurementVendors, getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_TERMS = ["Immediate", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"] as const;

const COUNTRIES = [
  "Botswana", "Comoros", "Democratic Republic of Congo", "Eswatini", "Lesotho",
  "Madagascar", "Malawi", "Mauritius", "Mozambique", "Namibia", "Seychelles",
  "South Africa", "Tanzania", "Zambia", "Zimbabwe", "Other",
] as const;

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: "all",         label: "All",         icon: "format_list_bulleted" },
  { key: "approved",    label: "Approved",    icon: "verified"             },
  { key: "pending",     label: "Pending",     icon: "pending"              },
  { key: "inactive",    label: "Inactive",    icon: "block"                },
  { key: "blacklisted", label: "Blacklisted", icon: "gpp_bad"              },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function statusBadge(vendor: Vendor) {
  if (vendor.is_blacklisted) return <span className="badge badge-danger">Blacklisted</span>;
  if (!vendor.is_active)     return <span className="badge badge-muted">Inactive</span>;
  if (vendor.is_approved)    return <span className="badge badge-success">Approved</span>;
  return                            <span className="badge badge-warning">Pending</span>;
}

// ─── Star display ─────────────────────────────────────────────────────────────
function StarDisplay({ avg, count }: { avg?: number | null; count?: number }) {
  if (!avg) return <span className="text-xs text-neutral-300">—</span>;
  const full  = Math.floor(avg);
  const half  = avg - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5" title={`${avg.toFixed(1)} / 5 (${count ?? 0} ratings)`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-symbols-outlined text-[14px] leading-none ${
          i < full ? "text-amber-400" : i === full && half ? "text-amber-300" : "text-neutral-200"
        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {i < full ? "star" : i === full && half ? "star_half" : "star"}
        </span>
      ))}
      <span className="text-[10px] text-neutral-400 ml-1">{avg.toFixed(1)}</span>
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={7} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-600">No vendors found</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {canManage ? "Add your first vendor to the register." : "No vendors match your current filters."}
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={onAdd} className="btn-primary mt-1 py-1.5 px-4 text-xs">
              Add Vendor
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j}>
              <div className="h-3.5 rounded bg-neutral-100" style={{ width: j === 0 ? "60%" : j === 6 ? "40%" : "70%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Vendor Form Modal ────────────────────────────────────────────────────────
type FormTab = "basic" | "contact" | "banking" | "admin";

interface VendorFormValues {
  name: string;
  contact_name: string;
  registration_number: string;
  tax_number: string;
  category: string;
  category_ids: number[];
  country: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  payment_terms: string;
  bank_name: string;
  bank_account: string;
  bank_branch: string;
  is_sme: boolean;
  notes: string;
  is_approved: boolean;
  is_active: boolean;
}

function defaultForm(vendor?: Vendor | null): VendorFormValues {
  return {
    name:                vendor?.name                ?? "",
    contact_name:        vendor?.contact_name        ?? "",
    registration_number: vendor?.registration_number ?? "",
    tax_number:          vendor?.tax_number          ?? "",
    category:            vendor?.category            ?? "",
    category_ids:        vendor?.categories?.map((item) => item.id) ?? [],
    country:             vendor?.country             ?? "",
    website:             vendor?.website             ?? "",
    contact_email:       vendor?.contact_email       ?? "",
    contact_phone:       vendor?.contact_phone       ?? "",
    address:             vendor?.address             ?? "",
    payment_terms:       vendor?.payment_terms       ?? "",
    bank_name:           vendor?.bank_name           ?? "",
    bank_account:        vendor?.bank_account        ?? "",
    bank_branch:         vendor?.bank_branch         ?? "",
    is_sme:              vendor?.is_sme              ?? false,
    notes:               vendor?.notes               ?? "",
    is_approved:         vendor?.is_approved         ?? false,
    is_active:           vendor?.is_active           ?? true,
  };
}

const TAB_LABELS: { key: FormTab; label: string; icon: string }[] = [
  { key: "basic",   label: "Business",  icon: "business"         },
  { key: "contact", label: "Contact",   icon: "contacts"         },
  { key: "banking", label: "Banking",   icon: "account_balance"  },
  { key: "admin",   label: "Admin",     icon: "settings"         },
];

function VendorFormModal({ vendor, categories, onClose, onSaved }: {
  vendor?: Vendor | null;
  categories: SupplierCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!vendor;
  const queryClient = useQueryClient();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<FormTab>("basic");
  const [form, setForm] = useState<VendorFormValues>(defaultForm(vendor));
  const [formError, setFormError] = useState("");

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const mutation = useMutation({
    mutationFn: (data: VendorFormValues) => {
      const selectedNames = categories
        .filter((category) => data.category_ids.includes(category.id))
        .map((category) => category.name);
      const payload = {
        ...data,
        category: selectedNames.join(", "),
      };
      return isEdit ? vendorsApi.update(vendor!.id, payload) : vendorsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onSaved();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "Failed to save vendor.";
      setFormError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Vendor name is required."); setTab("basic"); return; }
    if (form.category_ids.length < 1 || form.category_ids.length > 3) {
      setFormError("Select between 1 and 3 supplier categories.");
      setTab("basic");
      return;
    }
    setFormError("");
    mutation.mutate(form);
  };

  const tf = (
    key: keyof VendorFormValues,
    label: string,
    opts?: { type?: string; placeholder?: string; required?: boolean; span2?: boolean }
  ) => (
    <div className={opts?.span2 ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-neutral-600 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        className="form-input"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  const sf = (key: keyof VendorFormValues, label: string, options: readonly string[]) => (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1">{label}</label>
      <select
        className="form-input"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      >
        <option value="">— Select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-[20px] text-primary">
                {isEdit ? "edit" : "add_business"}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">
                {isEdit ? "Edit Vendor" : "New Vendor"}
              </h2>
              <p className="text-xs text-neutral-500">
                {isEdit ? `Updating ${vendor!.name}` : "Add a supplier or service provider"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-neutral-200 px-6 mt-4 flex-shrink-0">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 flex-shrink-0">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {formError}
          </div>
        )}

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── Business ─────────────────────────────────────────────────────── */}
          {tab === "basic" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Vendor / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Supplies Ltd"
                />
              </div>
              {tf("registration_number", "Company Registration Number", { placeholder: "CC/2021/12345" })}
              {tf("tax_number", "VAT / Tax Number", { placeholder: "e.g. 2012345678" })}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold text-neutral-600">Supplier Categories</label>
                  <span className="text-[11px] text-neutral-400">Select 1 to 3</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className={`rounded-xl border p-3 text-sm ${
                        form.category_ids.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={form.category_ids.includes(category.id)}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            category_ids: current.category_ids.includes(category.id)
                              ? current.category_ids.filter((id) => id !== category.id)
                              : current.category_ids.length >= 3 ? current.category_ids : [...current.category_ids, category.id],
                          }))
                        }
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
              {sf("country", "Country of Registration", COUNTRIES)}
              {tf("website", "Website", { type: "url", placeholder: "https://", span2: true })}

              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    checked={form.is_sme}
                    onChange={(e) => setForm((f) => ({ ...f, is_sme: e.target.checked }))}
                  />
                  <span className="text-xs font-medium text-neutral-700">
                    Small or Medium Enterprise (SME)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ── Contact ───────────────────────────────────────────────────────── */}
          {tab === "contact" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tf("contact_name", "Primary Contact Person", { placeholder: "Full name", span2: true })}
              {tf("contact_email", "Contact Email", { type: "email", placeholder: "vendor@example.com" })}
              {tf("contact_phone", "Contact Phone", { placeholder: "+264 61 000 0000" })}
              {tf("address", "Physical Address", { placeholder: "Street, City, Country", span2: true })}
            </div>
          )}

          {/* ── Banking ───────────────────────────────────────────────────────── */}
          {tab === "banking" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <p className="sm:col-span-2 text-xs text-neutral-400 -mb-1">
                Banking details are stored securely for payment processing.
              </p>
              {tf("bank_name", "Bank Name", { placeholder: "e.g. First National Bank" })}
              {sf("payment_terms", "Payment Terms", PAYMENT_TERMS)}
              {tf("bank_account", "Account Number", { placeholder: "e.g. 62012345678" })}
              {tf("bank_branch", "Branch / SWIFT Code", { placeholder: "e.g. 250655 or FIRNNAMW" })}
            </div>
          )}

          {/* ── Admin ─────────────────────────────────────────────────────────── */}
          {tab === "admin" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Internal Notes</label>
                <textarea
                  className="form-input h-28 resize-none"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes visible only to procurement staff…"
                />
              </div>
              <div className="sm:col-span-2 flex gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    checked={form.is_approved}
                    onChange={(e) => setForm((f) => ({ ...f, is_approved: e.target.checked }))}
                  />
                  <span className="text-xs font-medium text-neutral-700">Mark as Approved</span>
                </label>
                {isEdit && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    />
                    <span className="text-xs font-medium text-neutral-700">Active</span>
                  </label>
                )}
              </div>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            {mutation.isPending && (
              <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
            )}
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────
function DeleteDialog({
  vendor,
  onClose,
  onDeleted,
}: {
  vendor: Vendor;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => vendorsApi.destroy(vendor.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onDeleted();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="card w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
            <span className="material-symbols-outlined text-[22px] text-red-600">warning</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Deactivate Vendor?</h3>
            <p className="mt-1 text-xs text-neutral-500">
              <strong className="text-neutral-700">{vendor.name}</strong> will be marked inactive
              and hidden from procurement forms. Existing quote history is preserved.
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const canManageVendors = canManageProcurementVendors(getStoredUser());
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm]       = useState(false);
  const [editVendor, setEditVendor]   = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendors", search, statusFilter],
    queryFn: () =>
      vendorsApi.list({ search: search || undefined, status: statusFilter }).then((r) => r.data.data),
  });
  const { data: supplierCategories = [] } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
  });

  const vendors = data ?? [];

  const approvedCount    = vendors.filter((v) => v.is_approved && v.is_active && !v.is_blacklisted).length;
  const pendingCount     = vendors.filter((v) => !v.is_approved && v.is_active && !v.is_blacklisted).length;
  const blacklistedCount = vendors.filter((v) => v.is_blacklisted).length;
  const avgRated         = vendors.filter((v) => v.ratings_avg_rating).length;

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Vendor Register</h1>
            <p className="page-subtitle">Approved suppliers and service providers for procurement.</p>
          </div>
          {canManageVendors && (
            <button
              type="button"
              onClick={() => { setEditVendor(null); setShowForm(true); }}
              className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Vendor
            </button>
          )}
        </div>

        {/* KPI strip */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Vendors",    value: vendors.length,    icon: "storefront", color: "text-primary",   bg: "bg-primary/10" },
              { label: "Approved",         value: approvedCount,     icon: "verified",   color: "text-green-600", bg: "bg-green-50"   },
              { label: "Pending Approval", value: pendingCount,      icon: "pending",    color: "text-amber-600", bg: "bg-amber-50"   },
              { label: "Blacklisted",      value: blacklistedCount,  icon: "gpp_bad",    color: "text-red-600",   bg: "bg-red-50"     },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <span className={`material-symbols-outlined text-[20px] ${kpi.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{kpi.icon}</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{kpi.value}</p>
                  <p className="text-xs text-neutral-500">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + search */}
        <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`filter-tab flex items-center gap-1.5 ${statusFilter === f.key ? "active" : ""}`}
              >
                <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative sm:w-64">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-neutral-400">
              search
            </span>
            <input
              type="text"
              className="form-input pl-9 py-2 text-sm"
              placeholder="Search vendors…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load vendors. Please refresh.
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-800">
              Vendor List
              {!isLoading && (
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  ({vendors.length} {vendors.length === 1 ? "vendor" : "vendors"})
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Vendor</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Contact</th>
                  <th className="text-left">Quotes</th>
                  <th className="text-left">Rating</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : vendors.length === 0 ? (
                  <EmptyState
                    canManage={canManageVendors}
                    onAdd={() => { setEditVendor(null); setShowForm(true); }}
                  />
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id} className="group hover:bg-neutral-50/60">
                      {/* Vendor name + reg + country */}
                      <td>
                        <Link href={`/procurement/vendors/${v.id}`} className="group/link block">
                          <span className="font-medium text-neutral-900 group-hover/link:text-primary transition-colors">
                            {v.name}
                          </span>
                          <span className="flex items-center gap-2 mt-0.5">
                            {v.registration_number && (
                              <span className="text-[10px] font-mono text-neutral-400">{v.registration_number}</span>
                            )}
                            {v.is_sme && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">SME</span>
                            )}
                          </span>
                        </Link>
                      </td>
                      {/* Category */}
                      <td className="text-xs text-neutral-600">
                        {(v.categories ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(v.categories ?? []).map((category) => (
                              <span key={category.id} className="badge badge-primary">
                                {category.name}
                              </span>
                            ))}
                          </div>
                        ) : v.category ? (
                          <span>{v.category}</span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      {/* Contact */}
                      <td className="text-sm text-neutral-600">
                        {v.contact_phone ? (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-neutral-400">phone</span>
                            {v.contact_phone}
                          </span>
                        ) : v.contact_email ? (
                          <span className="text-xs text-neutral-500">{v.contact_email}</span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      {/* Quotes count */}
                      <td>
                        {(v.quotes_count ?? 0) > 0 ? (
                          <span className="badge badge-primary">{v.quotes_count}</span>
                        ) : (
                          <span className="text-xs text-neutral-300">0</span>
                        )}
                      </td>
                      {/* Rating */}
                      <td>
                        <StarDisplay avg={v.ratings_avg_rating} count={v.ratings_count} />
                      </td>
                      {/* Status */}
                      <td>{statusBadge(v)}</td>
                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/procurement/vendors/${v.id}`}
                            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-primary transition-colors"
                            title="View details"
                          >
                            <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                          </Link>
                          {canManageVendors && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditVendor(v); setShowForm(true); }}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                                title="Edit vendor"
                              >
                                <span className="material-symbols-outlined text-[17px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteVendor(v)}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Deactivate vendor"
                              >
                                <span className="material-symbols-outlined text-[17px]">block</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showForm && canManageVendors && (
        <VendorFormModal
          vendor={editVendor}
          categories={supplierCategories}
          onClose={() => { setShowForm(false); setEditVendor(null); }}
          onSaved={() => { setShowForm(false); setEditVendor(null); }}
        />
      )}

      {deleteVendor && canManageVendors && (
        <DeleteDialog
          vendor={deleteVendor}
          onClose={() => setDeleteVendor(null)}
          onDeleted={() => setDeleteVendor(null)}
        />
      )}
    </>
  );
}
