"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierCategoriesApi, vendorsApi, type SupplierCategory, type Vendor } from "@/lib/api";
import { canManageProcurementVendors, getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { EmptyState as SharedEmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type TFn = ReturnType<typeof useI18n>["t"];

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_TERMS = ["Immediate", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"] as const;

function paymentTermLabel(t: TFn, term: string): string {
  if (term === "Immediate") return t("procurement.vendors.term.immediate");
  const m = /^Net (\d+)$/.exec(term);
  return m ? t("procurement.vendors.term.net", { days: m[1] }) : term;
}

const COUNTRIES = [
  "Botswana", "Comoros", "Democratic Republic of Congo", "Eswatini", "Lesotho",
  "Madagascar", "Malawi", "Mauritius", "Mozambique", "Namibia", "Seychelles",
  "South Africa", "Tanzania", "Zambia", "Zimbabwe", "Other",
] as const;

const COUNTRY_KEYS: Record<string, string> = {
  Botswana: "procurement.vendors.country.botswana",
  Comoros: "procurement.vendors.country.comoros",
  "Democratic Republic of Congo": "procurement.vendors.country.drc",
  Eswatini: "procurement.vendors.country.eswatini",
  Lesotho: "procurement.vendors.country.lesotho",
  Madagascar: "procurement.vendors.country.madagascar",
  Malawi: "procurement.vendors.country.malawi",
  Mauritius: "procurement.vendors.country.mauritius",
  Mozambique: "procurement.vendors.country.mozambique",
  Namibia: "procurement.vendors.country.namibia",
  Seychelles: "procurement.vendors.country.seychelles",
  "South Africa": "procurement.vendors.country.southAfrica",
  Tanzania: "procurement.vendors.country.tanzania",
  Zambia: "procurement.vendors.country.zambia",
  Zimbabwe: "procurement.vendors.country.zimbabwe",
  Other: "procurement.vendors.country.other",
};

function countryLabel(t: TFn, country: string): string {
  const key = COUNTRY_KEYS[country];
  return key ? t(key) : country;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: "all",         label: "procurement.vendors.status.all",         icon: "format_list_bulleted" },
  { key: "approved",    label: "procurement.vendors.status.approved",    icon: "verified"             },
  { key: "pending",     label: "procurement.vendors.status.pending",     icon: "pending"              },
  { key: "inactive",    label: "procurement.vendors.status.inactive",    icon: "block"                },
  { key: "blacklisted", label: "procurement.vendors.status.blacklisted", icon: "gpp_bad"              },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function statusBadge(vendor: Vendor, t: TFn) {
  if (vendor.is_blacklisted) return <span className="badge badge-danger">{t("procurement.vendors.status.blacklisted")}</span>;
  if (!vendor.is_active)     return <span className="badge badge-muted">{t("procurement.vendors.status.inactive")}</span>;
  if (vendor.is_approved)    return <span className="badge badge-success">{t("procurement.vendors.status.approved")}</span>;
  return                            <span className="badge badge-warning">{t("procurement.vendors.status.pending")}</span>;
}

// ─── Star display ─────────────────────────────────────────────────────────────
function StarDisplay({ avg, count }: { avg?: number | string | null; count?: number }) {
  const { t } = useI18n();
  const n = avg != null ? Number(avg) : null;
  if (!n) return <span className="text-xs text-neutral-300">—</span>;
  const full  = Math.floor(n);
  const half  = n - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5" title={t("procurement.vendors.ratingTitle", { avg: n.toFixed(1), count: count ?? 0 })}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-symbols-outlined text-[14px] leading-none ${
          i < full ? "text-amber-400" : i === full && half ? "text-amber-300" : "text-neutral-200"
        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {i < full ? "star" : i === full && half ? "star_half" : "star"}
        </span>
      ))}
      <span className="text-[10px] text-neutral-400 ml-1">{n.toFixed(1)}</span>
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ canManage, onAdd }: { canManage: boolean; onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <tr>
      <td colSpan={7}>
        <SharedEmptyState
          icon="storefront"
          title={t("procurement.vendors.emptyTitle")}
          description={canManage ? t("procurement.vendors.emptyAdd") : t("procurement.vendors.emptyFiltered")}
          action={
            canManage ? (
              <button type="button" onClick={onAdd} className="btn-primary mt-1 py-1.5 px-4 text-xs">
                {t("procurement.vendors.addVendor")}
              </button>
            ) : undefined
          }
        />
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
  { key: "basic",   label: "procurement.vendors.tab.basic",  icon: "business"         },
  { key: "contact", label: "procurement.vendors.tab.contact",   icon: "contacts"         },
  { key: "banking", label: "procurement.vendors.tab.banking",   icon: "account_balance"  },
  { key: "admin",   label: "procurement.vendors.tab.admin",     icon: "settings"         },
];

function VendorFormModal({ vendor, categories, onClose, onSaved }: {
  vendor?: Vendor | null;
  categories: SupplierCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!vendor;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useToast();
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
      toast.success(isEdit ? t("procurement.vendors.toast.updated") : t("procurement.vendors.toast.created"));
      onSaved();
    },
    onError: (err: unknown) => {
      const msg = apiErrorMessage(err, t("procurement.vendors.saveFailed"));
      setFormError(msg);
      toast.error(isEdit ? t("procurement.vendors.toast.notUpdated") : t("procurement.vendors.toast.notCreated"), msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError(t("procurement.vendors.nameRequired")); setTab("basic"); return; }
    if (form.category_ids.length < 1 || form.category_ids.length > 3) {
      setFormError(t("procurement.vendors.categoriesRange"));
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
      <label htmlFor="procurement-vendors-field" className="block text-xs font-semibold text-neutral-600 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input id="procurement-vendors-field"
        type={opts?.type ?? "text"}
        className="form-input"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  const sf = (key: keyof VendorFormValues, label: string, options: readonly string[], optionLabel: (o: string) => string) => (
    <div>
      <label htmlFor="procurement-vendors-field-2" className="block text-xs font-semibold text-neutral-600 mb-1">{label}</label>
      <select id="procurement-vendors-field-2"
        className="form-input"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      >
        <option value="">{t("procurement.vendors.selectPlaceholder")}</option>
        {options.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
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
                {isEdit ? t("procurement.vendors.editVendor") : t("procurement.vendors.newVendor")}
              </h2>
              <p className="text-xs text-neutral-500">
                {isEdit ? t("procurement.vendors.updating", { name: vendor!.name }) : t("procurement.vendors.addSubtitle")}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("procurement.vendors.closeForm")} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-neutral-200 px-6 mt-4 flex-shrink-0">
          {TAB_LABELS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === tabItem.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tabItem.icon}</span>
              {t(tabItem.label)}
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
                <label htmlFor="procurement-vendors-vendor-company-name" className="block text-xs font-semibold text-neutral-600 mb-1">
                  {t("procurement.vendors.field.name")} <span className="text-red-500">*</span>
                </label>
                <input id="procurement-vendors-vendor-company-name"
                  ref={firstInputRef}
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("procurement.vendors.namePlaceholder")}
                />
              </div>
              {tf("registration_number", t("procurement.vendors.field.registration"), { placeholder: "CC/2021/12345" })}
              {tf("tax_number", t("procurement.vendors.field.tax"), { placeholder: t("procurement.vendors.taxPlaceholder") })}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="block text-xs font-semibold text-neutral-600">{t("procurement.vendors.field.categories")}</p>
                  <span className="text-[11px] text-neutral-400">{t("procurement.vendors.selectOneToThree")}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className={`rounded-xl border p-3 text-sm ${
                        form.category_ids.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"
                      }`}
                    >
                      <input id="procurement-vendors-setform-current"
                        type="checkbox"
                        className="mr-2"
                        checked={form.category_ids.includes(category.id)}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            category_ids: current.category_ids.includes(category.id)
                              ? current.category_ids.filter((id) => id !== category.id)
                              : [...current.category_ids, category.id],
                          }))
                        }
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
              {sf("country", t("procurement.vendors.field.country"), COUNTRIES, (o) => countryLabel(t, o))}
              {tf("website", t("procurement.vendors.field.website"), { type: "url", placeholder: "https://", span2: true })}

              <div className="sm:col-span-2">
                <label htmlFor="procurement-vendors-setform-f-small-or-medium-enterprise-sme" className="flex cursor-pointer items-center gap-2">
                  <input id="procurement-vendors-setform-f-small-or-medium-enterprise-sme"
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    checked={form.is_sme}
                    onChange={(e) => setForm((f) => ({ ...f, is_sme: e.target.checked }))}
                  />
                  <span className="text-xs font-medium text-neutral-700">
                    {t("procurement.vendors.smeLabel")}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ── Contact ───────────────────────────────────────────────────────── */}
          {tab === "contact" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tf("contact_name", t("procurement.vendors.field.contactName"), { placeholder: t("procurement.vendors.fullName"), span2: true })}
              {tf("contact_email", t("procurement.vendors.field.contactEmail"), { type: "email", placeholder: "vendor@example.com" })}
              {tf("contact_phone", t("procurement.vendors.field.contactPhone"), { placeholder: "+264 61 000 0000" })}
              {tf("address", t("procurement.vendors.field.address"), { placeholder: t("procurement.vendors.addressPlaceholder"), span2: true })}
            </div>
          )}

          {/* ── Banking ───────────────────────────────────────────────────────── */}
          {tab === "banking" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <p className="sm:col-span-2 text-xs text-neutral-400 -mb-1">
                {t("procurement.vendors.bankingNote")}
              </p>
              {tf("bank_name", t("procurement.vendors.field.bankName"), { placeholder: t("procurement.vendors.bankNamePlaceholder") })}
              {sf("payment_terms", t("procurement.vendors.field.paymentTerms"), PAYMENT_TERMS, (o) => paymentTermLabel(t, o))}
              {tf("bank_account", t("procurement.vendors.field.accountNumber"), { placeholder: t("procurement.vendors.accountPlaceholder") })}
              {tf("bank_branch", t("procurement.vendors.field.branch"), { placeholder: t("procurement.vendors.branchPlaceholder") })}
            </div>
          )}

          {/* ── Admin ─────────────────────────────────────────────────────────── */}
          {tab === "admin" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="procurement-vendors-internal-notes" className="block text-xs font-semibold text-neutral-600 mb-1">{t("procurement.vendors.field.notes")}</label>
                <textarea id="procurement-vendors-internal-notes"
                  className="form-input h-28 resize-none"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("procurement.vendors.notesPlaceholder")}
                />
              </div>
              <div className="sm:col-span-2 flex gap-6">
                <label htmlFor="procurement-vendors-setform-f-mark-as-approved" className="flex cursor-pointer items-center gap-2">
                  <input id="procurement-vendors-setform-f-mark-as-approved"
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    checked={form.is_approved}
                    onChange={(e) => setForm((f) => ({ ...f, is_approved: e.target.checked }))}
                  />
                  <span className="text-xs font-medium text-neutral-700">{t("procurement.vendors.markApproved")}</span>
                </label>
                {isEdit && (
                  <label htmlFor="procurement-vendors-setform-f-active" className="flex cursor-pointer items-center gap-2">
                    <input id="procurement-vendors-setform-f-active"
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    />
                    <span className="text-xs font-medium text-neutral-700">{t("procurement.vendors.active")}</span>
                  </label>
                )}
              </div>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
            {t("common.cancel")}
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
            {mutation.isPending ? t("procurement.vendors.saving") : isEdit ? t("procurement.vendors.saveChanges") : t("procurement.vendors.addVendor")}
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => vendorsApi.destroy(vendor.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(t("procurement.vendors.toast.deactivated"));
      onDeleted();
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.vendors.toast.notDeactivated"), apiErrorMessage(err, t("procurement.vendors.deactivateFailed")));
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
            <h3 className="text-sm font-semibold text-neutral-800">{t("procurement.vendors.deactivateTitle")}</h3>
            <p className="mt-1 text-xs text-neutral-500">
              {(() => {
                const [before, after = ""] = t("procurement.vendors.deactivateBody").split("{name}");
                return <>{before}<strong className="text-neutral-700">{vendor.name}</strong>{after}</>;
              })()}
            </p>
          </div>
        </div>
        {mutation.isError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {t("procurement.vendors.deactivateFailed")}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
            {t("common.cancel")}
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
            {mutation.isPending ? t("procurement.vendors.deactivating") : t("procurement.vendors.deactivate")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [canManageVendors, setCanManageVendors] = useState(false);
  useEffect(() => {
    setCanManageVendors(canManageProcurementVendors(getStoredUser()));
  }, []);
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm]       = useState(false);
  const [editVendor, setEditVendor]   = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);
  const [pwVendorId, setPwVendorId]   = useState<number | null>(null);
  const [pwVendorName, setPwVendorName] = useState("");
  const [pwPortalUsers, setPwPortalUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [pwSelectedUser, setPwSelectedUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [pwLoading, setPwLoading]     = useState(false);
  const [pw, setPw]                   = useState("");
  const [pwConfirm, setPwConfirm]     = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwError, setPwError]         = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]     = useState(false);

  const openPwModal = async (v: Vendor) => {
    setPwVendorId(v.id);
    setPwVendorName(v.name);
    setPwPortalUsers([]);
    setPwSelectedUser(null);
    setPw(""); setPwConfirm(""); setPwError(null); setPwSuccess(false);
    setPwLoading(true);
    try {
      const detail = await vendorsApi.get(v.id).then((r) => r.data.data);
      const users = (detail.portal_users ?? []).map((u: { id: number; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email }));
      setPwPortalUsers(users);
      if (users.length === 1) setPwSelectedUser(users[0]);
    } catch {
      setPwError(t("procurement.vendors.pw.loadFailed"));
    } finally {
      setPwLoading(false);
    }
  };

  const closePwModal = () => { setPwVendorId(null); setPwError(null); setPwSuccess(false); };

  const submitPwReset = async () => {
    if (!pwVendorId || !pwSelectedUser) return;
    if (pw.length < 8) { setPwError(t("procurement.vendors.pw.tooShort")); return; }
    if (pw !== pwConfirm) { setPwError(t("procurement.vendors.pw.mismatch")); return; }
    setPwSaving(true); setPwError(null);
    try {
      await vendorsApi.changePortalUserPassword(pwVendorId, pwSelectedUser.id, pw, pwConfirm, true);
      setPwSuccess(true);
      setPw(""); setPwConfirm("");
      toast.success(t("procurement.vendors.toast.pwReset"));
    } catch (e: unknown) {
      const message = apiErrorMessage(e, t("procurement.vendors.pw.resetFailed"));
      setPwError(message);
      toast.error(t("procurement.vendors.toast.pwNotReset"), message);
    } finally {
      setPwSaving(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: payload, isLoading, isError } = useQuery({
    queryKey: ["vendors", search, statusFilter, page],
    queryFn: () =>
      vendorsApi.list({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        per_page: DEFAULT_PAGE_SIZE,
      }).then((r) => r.data),
  });
  const { data: supplierCategories = [] } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
  });

  const vendors = getListData<Vendor>(payload);
  const lastPage = getLastPage(payload);
  const pagedVendors = vendors;
  const totalVendors = getTotal(payload, vendors.length);

  const approvedCount    = payload?.summary?.approved ?? vendors.filter((v) => v.is_approved && v.is_active && !v.is_blacklisted).length;
  const pendingCount     = payload?.summary?.pending ?? vendors.filter((v) => !v.is_approved && v.is_active && !v.is_blacklisted).length;
  const blacklistedCount = payload?.summary?.blacklisted ?? vendors.filter((v) => v.is_blacklisted).length;

  const handleExport = async () => {
    const rows: Vendor[] = [];
    let exportPage = 1;
    let exportLast = 1;
    do {
      const res = await vendorsApi.list({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: exportPage,
        per_page: 100,
      });
      rows.push(...(res.data.data ?? []));
      exportLast = res.data.last_page ?? 1;
      exportPage += 1;
    } while (exportPage <= exportLast);
    if (rows.length === 0) return;
    exportToCsv(
      `vendors-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((v) => ({
        name: v.name,
        country: v.country ?? "",
        email: v.contact_email ?? "",
        phone: v.contact_phone ?? "",
        approved: v.is_approved ? t("procurement.vendors.csv.yes") : t("procurement.vendors.csv.no"),
        active: v.is_active ? t("procurement.vendors.csv.yes") : t("procurement.vendors.csv.no"),
        blacklisted: v.is_blacklisted ? t("procurement.vendors.csv.yes") : t("procurement.vendors.csv.no"),
        rating: v.ratings_avg_rating ?? "",
      })),
      [
        { key: "name", header: t("procurement.vendors.csv.name") },
        { key: "country", header: t("procurement.vendors.csv.country") },
        { key: "email", header: t("procurement.vendors.csv.email") },
        { key: "phone", header: t("procurement.vendors.csv.phone") },
        { key: "approved", header: t("procurement.vendors.status.approved") },
        { key: "active", header: t("procurement.vendors.active") },
        { key: "blacklisted", header: t("procurement.vendors.status.blacklisted") },
        { key: "rating", header: t("procurement.vendors.col.rating") },
      ],
    );
  };

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
        {/* Page header */}
        <ProcurementPageHeader
          title="procurement.vendors.title"
          subtitle="procurement.vendors.subtitle"
          crumbs={[
            { label: "nav.procurement", href: "/procurement" },
            { label: "procurement.vendors.crumb" },
          ]}
          actions={
            <>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              disabled={totalVendors === 0}
              onClick={handleExport}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("procurement.vendors.exportCsv")}
            </button>
            {canManageVendors && (
              <button
                type="button"
                onClick={() => { setEditVendor(null); setShowForm(true); }}
                className="btn-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t("procurement.vendors.newVendor")}
              </button>
            )}
            </>
          }
        />

        {/* KPI strip */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "procurement.vendors.kpi.total",    value: totalVendors,    icon: "storefront", color: "text-primary",   bg: "bg-primary/10" },
              { label: "procurement.vendors.status.approved",         value: approvedCount,     icon: "verified",   color: "text-green-600", bg: "bg-green-50"   },
              { label: "procurement.vendors.kpi.pending", value: pendingCount,      icon: "pending",    color: "text-amber-600", bg: "bg-amber-50"   },
              { label: "procurement.vendors.status.blacklisted",      value: blacklistedCount,  icon: "gpp_bad",    color: "text-red-600",   bg: "bg-red-50"     },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <span className={`material-symbols-outlined text-[20px] ${kpi.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{kpi.icon}</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{kpi.value}</p>
                  <p className="text-xs text-neutral-500">{t(kpi.label)}</p>
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
                onClick={() => {
                  setStatusFilter(f.key);
                  setPage(1);
                }}
                className={`filter-tab flex items-center gap-1.5 ${statusFilter === f.key ? "active" : ""}`}
              >
                <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                {t(f.label)}
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
              placeholder={t("procurement.vendors.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); }}
                aria-label={t("procurement.vendors.clearSearch")}
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
            {t("procurement.vendors.loadFailed")}
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-800">
              {t("procurement.vendors.listTitle")}
              {!isLoading && (
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  {t(vendors.length === 1 ? "procurement.vendors.countOne" : "procurement.vendors.countMany", { count: vendors.length })}
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">{t("procurement.col.vendor")}</th>
                  <th className="text-left">{t("procurement.vendors.col.category")}</th>
                  <th className="text-left">{t("procurement.vendors.col.contact")}</th>
                  <th className="text-left">{t("procurement.vendors.col.quotes")}</th>
                  <th className="text-left">{t("procurement.vendors.col.rating")}</th>
                  <th className="text-left">{t("procurement.col.status")}</th>
                  <th className="text-right">{t("procurement.col.actions")}</th>
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
                  pagedVendors.map((v) => (
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
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 uppercase tracking-wide">{t("procurement.vendors.sme")}</span>
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
                      <td>{statusBadge(v, t)}</td>
                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/procurement/vendors/${v.id}`}
                            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-primary transition-colors"
                            title={t("procurement.vendors.viewDetails")}
                          >
                            <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                          </Link>
                          {canManageVendors && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditVendor(v); setShowForm(true); }}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                                title={t("procurement.vendors.editTitle")}
                              >
                                <span className="material-symbols-outlined text-[17px]">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openPwModal(v)}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                title={t("procurement.vendors.resetPwTitle")}
                              >
                                <span className="material-symbols-outlined text-[17px]">lock_reset</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteVendor(v)}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title={t("procurement.vendors.deactivateBtnTitle")}
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
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={totalVendors}
            onPageChange={setPage}
          />
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

      {pwVendorId !== null && canManageVendors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closePwModal}>
          <div className="card w-full max-w-md p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                <span className="material-symbols-outlined text-[20px] text-amber-600">lock_reset</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">{t("procurement.vendors.pw.title")}</h2>
                <p className="text-xs text-neutral-500">{pwVendorName}</p>
              </div>
            </div>

            {pwLoading && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 py-4">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                {t("procurement.vendors.pw.loading")}
              </div>
            )}

            {!pwLoading && pwPortalUsers.length === 0 && !pwError && (
              <p className="text-sm text-neutral-500 py-2">{t("procurement.vendors.pw.none")}</p>
            )}

            {!pwLoading && pwPortalUsers.length > 1 && !pwSelectedUser && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-600">{t("procurement.vendors.pw.select")}</p>
                {pwPortalUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    onClick={() => setPwSelectedUser(u)}
                  >
                    <p className="text-xs font-semibold text-neutral-800">{u.name}</p>
                    <p className="text-[11px] text-neutral-500">{u.email}</p>
                  </button>
                ))}
              </div>
            )}

            {!pwLoading && pwSelectedUser && !pwSuccess && (
              <>
                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-neutral-400">person</span>
                  <div>
                    <p className="text-xs font-semibold text-neutral-700">{pwSelectedUser.name}</p>
                    <p className="text-[11px] text-neutral-500">{pwSelectedUser.email}</p>
                  </div>
                  {pwPortalUsers.length > 1 && (
                    <button type="button" className="ml-auto btn-secondary text-[11px]" onClick={() => setPwSelectedUser(null)}>{t("procurement.vendors.pw.change")}</button>
                  )}
                </div>
                {pwError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pwError}</div>
                )}
                <div>
                  <label htmlFor="procurement-vendors-new-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("procurement.vendors.pw.new")}</label>
                  <input id="procurement-vendors-new-password" type="password" className="form-input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("procurement.vendors.pw.minPlaceholder")} />
                </div>
                <div>
                  <label htmlFor="procurement-vendors-confirm-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("procurement.vendors.pw.confirm")}</label>
                  <input id="procurement-vendors-confirm-password" type="password" className="form-input" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder={t("procurement.vendors.pw.repeat")} />
                </div>
                <p className="text-[11px] text-neutral-400">{t("procurement.vendors.pw.forceNote")}</p>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={closePwModal}>{t("common.cancel")}</button>
                  <button
                    className="btn-primary flex-1 disabled:opacity-60"
                    disabled={pwSaving || !pw || !pwConfirm}
                    onClick={submitPwReset}
                  >
                    {pwSaving ? t("procurement.vendors.saving") : t("procurement.vendors.pw.reset")}
                  </button>
                </div>
              </>
            )}

            {pwSuccess && (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <span className="material-symbols-outlined text-[26px] text-green-600">check_circle</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-800">{t("procurement.vendors.pw.success")}</p>
                  <p className="text-xs text-neutral-500 text-center">{t("procurement.vendors.pw.successNote")}</p>
                </div>
                <button className="btn-primary w-full" onClick={closePwModal}>{t("procurement.vendors.done")}</button>
              </>
            )}

            {pwError && !pwSelectedUser && !pwLoading && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pwError}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
