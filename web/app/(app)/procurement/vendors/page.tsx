"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorsApi, type Vendor } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: "all",      label: "All",      icon: "format_list_bulleted" },
  { key: "approved", label: "Approved", icon: "verified"             },
  { key: "pending",  label: "Pending",  icon: "pending"              },
  { key: "inactive", label: "Inactive", icon: "block"                },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function statusBadge(vendor: Vendor) {
  if (!vendor.is_active)  return <span className="badge badge-muted">Inactive</span>;
  if (vendor.is_approved) return <span className="badge badge-success">Approved</span>;
  return                         <span className="badge badge-warning">Pending</span>;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={6} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-600">No vendors found</p>
            <p className="text-xs text-neutral-400 mt-0.5">Add your first vendor to the register.</p>
          </div>
          <button type="button" onClick={onAdd} className="btn-primary mt-1 py-1.5 px-4 text-xs">
            Add Vendor
          </button>
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
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j}>
              <div className="h-3.5 rounded bg-neutral-100" style={{ width: j === 0 ? "60%" : j === 5 ? "40%" : "70%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Vendor Form Modal ────────────────────────────────────────────────────────
interface VendorFormModalProps {
  vendor?: Vendor | null;
  onClose: () => void;
  onSaved: () => void;
}

function VendorFormModal({ vendor, onClose, onSaved }: VendorFormModalProps) {
  const isEdit = !!vendor;
  const queryClient = useQueryClient();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:                vendor?.name                ?? "",
    registration_number: vendor?.registration_number ?? "",
    contact_email:       vendor?.contact_email       ?? "",
    contact_phone:       vendor?.contact_phone       ?? "",
    address:             vendor?.address             ?? "",
    is_approved:         vendor?.is_approved         ?? false,
    is_active:           vendor?.is_active           ?? true,
  });
  const [formError, setFormError] = useState("");

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      isEdit
        ? vendorsApi.update(vendor!.id, data)
        : vendorsApi.create(data),
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
    if (!form.name.trim()) { setFormError("Vendor name is required."); return; }
    setFormError("");
    mutation.mutate(form);
  };

  const field = (
    id: keyof typeof form,
    label: string,
    opts?: { type?: string; placeholder?: string; span2?: boolean }
  ) => (
    <div className={opts?.span2 ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-neutral-600 mb-1">
        {label}
        {id === "name" && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        className="form-input"
        value={form[id] as string}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
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

        {formError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">
              Vendor Name <span className="text-red-500">*</span>
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
          {field("registration_number", "Registration Number", { placeholder: "e.g. CC/2021/12345" })}
          {field("contact_email", "Contact Email", { type: "email", placeholder: "vendor@example.com" })}
          {field("contact_phone", "Contact Phone", { placeholder: "+264 61 000 0000" })}
          {field("address", "Address", { placeholder: "Street, City, Country" })}

          {/* Toggles */}
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

          {/* Actions */}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              {mutation.isPending && (
                <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
              )}
              {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </form>
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

  const vendors = data ?? [];

  const approvedCount = vendors.filter((v) => v.is_approved && v.is_active).length;
  const pendingCount  = vendors.filter((v) => !v.is_approved && v.is_active).length;

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Vendor Register</h1>
            <p className="page-subtitle">Approved suppliers and service providers for procurement.</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditVendor(null); setShowForm(true); }}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Vendor
          </button>
        </div>

        {/* KPI strip */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Vendors",    value: vendors.length,                                     icon: "storefront",  color: "text-primary",   bg: "bg-primary/10"  },
              { label: "Approved",         value: approvedCount,                                      icon: "verified",    color: "text-green-600", bg: "bg-green-50"    },
              { label: "Pending Approval", value: pendingCount,                                       icon: "pending",     color: "text-amber-600", bg: "bg-amber-50"    },
              { label: "Total Quotes",     value: vendors.reduce((s, v) => s + (v.quotes_count ?? 0), 0), icon: "request_quote", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
                  <span className={`material-symbols-outlined text-[20px] ${kpi.color}`}>{kpi.icon}</span>
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
                  <th className="text-left">Reg. Number</th>
                  <th className="text-left">Contact</th>
                  <th className="text-left">Address</th>
                  <th className="text-left">Quotes</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : vendors.length === 0 ? (
                  <EmptyState onAdd={() => { setEditVendor(null); setShowForm(true); }} />
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id} className="group hover:bg-neutral-50/60">
                      {/* Vendor name + email */}
                      <td>
                        <Link href={`/procurement/vendors/${v.id}`} className="group/link block">
                          <span className="font-medium text-neutral-900 group-hover/link:text-primary transition-colors">
                            {v.name}
                          </span>
                          {v.contact_email && (
                            <span className="block text-xs text-neutral-400 mt-0.5">{v.contact_email}</span>
                          )}
                        </Link>
                      </td>
                      {/* Reg number */}
                      <td>
                        <span className="font-mono text-xs text-neutral-500">
                          {v.registration_number ?? "—"}
                        </span>
                      </td>
                      {/* Phone */}
                      <td className="text-sm text-neutral-600">
                        {v.contact_phone ? (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-neutral-400">phone</span>
                            {v.contact_phone}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      {/* Address */}
                      <td className="text-sm text-neutral-600 max-w-[180px] truncate">
                        {v.address ?? <span className="text-neutral-300">—</span>}
                      </td>
                      {/* Quotes count */}
                      <td>
                        {(v.quotes_count ?? 0) > 0 ? (
                          <span className="badge badge-primary">{v.quotes_count}</span>
                        ) : (
                          <span className="text-xs text-neutral-300">0</span>
                        )}
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
      {showForm && (
        <VendorFormModal
          vendor={editVendor}
          onClose={() => { setShowForm(false); setEditVendor(null); }}
          onSaved={() => { setShowForm(false); setEditVendor(null); }}
        />
      )}

      {deleteVendor && (
        <DeleteDialog
          vendor={deleteVendor}
          onClose={() => setDeleteVendor(null)}
          onDeleted={() => setDeleteVendor(null)}
        />
      )}
    </>
  );
}
