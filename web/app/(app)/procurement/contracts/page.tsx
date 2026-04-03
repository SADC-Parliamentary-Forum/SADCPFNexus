"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, vendorsApi, procurementApi, type Contract, type Vendor } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "badge-muted",   icon: "edit_note"    },
  active:     { label: "Active",     cls: "badge-success", icon: "check_circle" },
  completed:  { label: "Completed",  cls: "badge-primary", icon: "task_alt"     },
  terminated: { label: "Terminated", cls: "badge-danger",  icon: "cancel"       },
};

const FILTERS = ["all", "draft", "active", "completed", "terminated"];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function ContractsPage() {
  const queryClient  = useQueryClient();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // Form state
  const [title, setTitle]               = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">(requestParam ? Number(requestParam) : "");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [value, setValue]               = useState("");
  const [currency, setCurrency]         = useState(DEFAULT_CURRENCY);
  const [description, setDescription]   = useState("");

  // Auto-open modal when navigated from awarded request
  useEffect(() => {
    if (requestParam) setShowModal(true);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", statusFilter],
    queryFn: () =>
      contractsApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  // Load vendors for selector
  const { data: vendorData } = useQuery({
    queryKey: ["vendors-approved"],
    queryFn: () => vendorsApi.list({ status: "approved" }).then((r) => r.data),
    enabled: showModal,
  });

  const availableVendors: Vendor[] = (vendorData as { data?: Vendor[] })?.data ?? [];

  // Load awarded procurement requests for optional linkage
  const { data: requestData } = useQuery({
    queryKey: ["procurement-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });

  type RequestOption = { id: number; reference_number: string; title: string };
  const awardedRequests: RequestOption[] = ((requestData as { data?: RequestOption[] })?.data ?? []);

  const openModal = () => {
    setTitle("");
    setSelectedVendorId("");
    setSelectedRequestId("");
    setStartDate("");
    setEndDate("");
    setValue("");
    setCurrency(DEFAULT_CURRENCY);
    setDescription("");
    setSubmitError(null);
    setShowModal(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      contractsApi.create({
        vendor_id: Number(selectedVendorId),
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        value: Number(value),
        currency,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(selectedRequestId ? { procurement_request_id: Number(selectedRequestId) } : {}),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setShowModal(false);
      window.location.href = `/procurement/contracts/${res.data.data.id}`;
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create contract."
      );
    },
  });

  const canSubmit = !!title.trim() && !!selectedVendorId && !!startDate && !!endDate && !!value && Number(value) > 0;

  const items: Contract[] = (data as { data?: Contract[] })?.data ?? [];
  const total        = items.length;
  const active       = items.filter((c) => c.status === "active" && !c.is_expired).length;
  const expiringSoon = items.filter((c) => c.is_expiring_soon).length;
  const expired      = items.filter((c) => c.is_expired).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">Manage vendor contracts and agreements</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Contract
          </button>
          <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Procurement
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total",         value: total,        icon: "description",  color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Active",        value: active,       icon: "check_circle", color: "text-green-600", bg: "bg-green-50"    },
          { label: "Expiring Soon", value: expiringSoon, icon: "schedule",     color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "Expired",       value: expired,      icon: "event_busy",   color: "text-red-600",   bg: "bg-red-50"      },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
              <p className="text-xs text-neutral-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-neutral-100 rounded" />
                <div className="h-4 w-56 bg-neutral-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-6 text-center text-sm text-red-600">Failed to load contracts.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
          <p className="text-sm text-neutral-500">No contracts found.</p>
          <p className="text-xs text-neutral-400">Click "New Contract" above to create a vendor contract.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract Reference</th>
                <th>Title</th>
                <th>Vendor</th>
                <th className="text-right">Value</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const s = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/procurement/contracts/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                        {c.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="text-sm text-neutral-600">{c.vendor?.name ?? "—"}</td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">
                      {c.currency} {Number(c.value).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500">
                          {c.end_date ? formatDateShort(c.end_date) : "—"}
                        </span>
                        {c.is_expired && (
                          <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Expired</span>
                        )}
                        {!c.is_expired && c.is_expiring_soon && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Soon</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Contract Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <span className="material-symbols-outlined text-[20px] text-blue-600">description</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">New Contract</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Contract Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Software Licence Agreement 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Vendor <span className="text-red-500">*</span></label>
                <select
                  className="form-input"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select vendor…</option>
                  {availableVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {availableVendors.length === 0 && (
                  <p className="text-xs text-amber-600">No approved vendors found. <Link href="/procurement/vendors" className="underline">Add a vendor</Link> first.</p>
                )}
              </div>

              {awardedRequests.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Linked Procurement Request (optional)</label>
                  <select
                    className="form-input"
                    value={selectedRequestId}
                    onChange={(e) => setSelectedRequestId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">None</option>
                    {awardedRequests.map((r) => (
                      <option key={r.id} value={r.id}>{r.reference_number} — {r.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Start Date <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">End Date <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Contract Value <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Currency</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Description (optional)</label>
                <textarea
                  className="form-input resize-none h-20"
                  placeholder="Brief description of the contract scope…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn-primary flex-1 disabled:opacity-60"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">description</span>
                )}
                {createMutation.isPending ? "Creating…" : "Create Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
