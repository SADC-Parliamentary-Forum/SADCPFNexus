"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { vendorsApi, type Vendor } from "@/lib/api";
import { formatDateShort, formatCurrency } from "@/lib/utils";

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
interface EditModalProps {
  vendor: Vendor;
  onClose: () => void;
}

function EditModal({ vendor, onClose }: EditModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name:                vendor.name                ?? "",
    registration_number: vendor.registration_number ?? "",
    contact_email:       vendor.contact_email       ?? "",
    contact_phone:       vendor.contact_phone       ?? "",
    address:             vendor.address             ?? "",
    is_approved:         vendor.is_approved         ?? false,
    is_active:           vendor.is_active           ?? true,
  });
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: typeof form) => vendorsApi.update(vendor.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor", vendor.id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? "Failed to update vendor.";
      setFormError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Vendor name is required."); return; }
    setFormError("");
    mutation.mutate(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-[20px] text-primary">edit</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Edit Vendor</h2>
              <p className="text-xs text-neutral-500">Update vendor information</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
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
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Supplies Ltd"
              autoFocus
            />
          </div>

          {(
            [
              { key: "registration_number" as const, label: "Registration Number", type: "text",  ph: "CC/2021/12345"      },
              { key: "contact_email"        as const, label: "Contact Email",       type: "email", ph: "vendor@example.com" },
              { key: "contact_phone"        as const, label: "Contact Phone",       type: "text",  ph: "+264 61 000 0000"   },
              { key: "address"              as const, label: "Address",             type: "text",  ph: "Street, City, Country" },
            ] as const
          ).map(({ key, label, type, ph }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">{label}</label>
              <input
                type={type}
                className="form-input"
                value={form[key] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={ph}
              />
            </div>
          ))}

          {/* Toggles */}
          <div className="sm:col-span-2 flex gap-6">
            {(
              [
                { key: "is_approved" as const, label: "Approved" },
                { key: "is_active"   as const, label: "Active"   },
              ] as const
            ).map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  checked={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                />
                <span className="text-xs font-medium text-neutral-700">{label}</span>
              </label>
            ))}
          </div>

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
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
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
export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendorId = Number(params.id);
  const [showEdit, setShowEdit]         = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn:  () => vendorsApi.get(vendorId).then((r) => r.data.data),
    enabled:  !!vendorId,
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
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/procurement" className="hover:text-neutral-600 transition-colors">Procurement</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/procurement/vendors" className="hover:text-neutral-600 transition-colors">Vendors</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">{vendor.name}</span>
        </nav>

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
                  {vendor.is_active ? (
                    vendor.is_approved ? (
                      <span className="badge badge-success">Approved</span>
                    ) : (
                      <span className="badge badge-warning">Pending Approval</span>
                    )
                  ) : (
                    <span className="badge badge-muted">Inactive</span>
                  )}
                  <span className="badge badge-primary">{vendor.quotes_count ?? 0} quotes</span>
                  {vendor.created_at && (
                    <span className="text-xs text-neutral-400">
                      Registered {formatDateShort(vendor.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-sm"
              >
                <span className="material-symbols-outlined text-[17px]">edit</span>
                Edit
              </button>
              {vendor.is_active && (
                <button
                  type="button"
                  onClick={() => setShowDeactivate(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">block</span>
                  Deactivate
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
              {infoRow(
                "mail",
                "Email",
                vendor.contact_email ? (
                  <a
                    href={`mailto:${vendor.contact_email}`}
                    className="text-primary hover:underline"
                  >
                    {vendor.contact_email}
                  </a>
                ) : (
                  <span className="text-neutral-400">Not provided</span>
                )
              )}
              {infoRow(
                "phone",
                "Phone",
                vendor.contact_phone ?? <span className="text-neutral-400">Not provided</span>
              )}
              {infoRow(
                "location_on",
                "Address",
                vendor.address ?? <span className="text-neutral-400">Not provided</span>
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
      </div>

      {/* Modals */}
      {showEdit && (
        <EditModal vendor={vendor} onClose={() => setShowEdit(false)} />
      )}
      {showDeactivate && (
        <DeactivateDialog vendor={vendor} onClose={() => setShowDeactivate(false)} />
      )}
    </>
  );
}
