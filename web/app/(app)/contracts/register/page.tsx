"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, vendorsApi, procurementApi, type Contract, type Vendor } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "badge-muted",   icon: "edit_note"    },
  active:     { label: "Active",     cls: "badge-success", icon: "check_circle" },
  completed:  { label: "Completed",  cls: "badge-primary", icon: "task_alt"     },
  terminated: { label: "Terminated", cls: "badge-danger",  icon: "cancel"       },
};

const FILTERS = ["all", "draft", "active", "completed", "terminated"];
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function unwrapList(payload: unknown): Contract[] {
  const data = (payload as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Contract[]) : [];
}

function ContractRegisterInner() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  const [title, setTitle]               = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<number | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">(requestParam ? Number(requestParam) : "");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [value, setValue]               = useState("");
  const [currency, setCurrency]         = useState(DEFAULT_CURRENCY);
  const [description, setDescription]   = useState("");

  useEffect(() => {
    if (requestParam || searchParams.get("new")) setShowModal(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", "register", statusFilter],
    queryFn: () =>
      contractsApi.register(statusFilter !== "all" ? { status: statusFilter } : undefined).then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: vendorData } = useQuery({
    queryKey: ["vendors-approved"],
    queryFn: () => vendorsApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });
  const availableVendors: Vendor[] = (vendorData as { data?: Vendor[] })?.data ?? [];

  const { data: requestData } = useQuery({
    queryKey: ["procurement-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });
  type RequestOption = { id: number; reference_number: string; title: string };
  const awardedRequests: RequestOption[] = ((requestData as { data?: RequestOption[] })?.data ?? []);

  const openModal = () => {
    setTitle(""); setSelectedVendorId(""); setSelectedRequestId("");
    setStartDate(""); setEndDate(""); setValue(""); setCurrency(DEFAULT_CURRENCY);
    setDescription(""); setSubmitError(null); setShowModal(true);
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
      router.push(`/contracts/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create contract."
      );
    },
  });

  const canSubmit = !!title.trim() && !!selectedVendorId && !!startDate && !!endDate && !!value && Number(value) > 0;

  const allItems = unwrapList(data);
  const items = search.trim()
    ? allItems.filter((c) =>
        `${c.reference_number} ${c.title} ${c.vendor?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title="Contract Register"
          subtitle="The authoritative register of institutional contracts"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Register" }]} />}
        />
        <div className="flex items-center gap-2">
          <button onClick={openModal} className="btn-primary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Contract
          </button>
          <Link href="/contracts" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Dashboard
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, title, counterparty…"
          className="form-input max-w-xs text-sm"
          aria-label="Search contracts"
        />
      </div>

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
        <div className="card">
          <EmptyState icon="description" title="No contracts found." description='Click "New Contract" to create a contract.' />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract Reference</th>
                <th>Title</th>
                <th>Type</th>
                <th>Counterparty</th>
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
                      <Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link>
                      {c.is_legacy && (<span className="ml-1.5 text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">Legacy</span>)}
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="text-xs text-neutral-500">{c.type?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{c.display_counterparty ?? c.vendor?.name ?? "—"}</td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">{c.currency} {Number(c.value).toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500">{c.end_date ? formatDateShort(c.end_date) : "—"}</span>
                        {c.is_expired && (<span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Expired</span>)}
                        {!c.is_expired && c.is_expiring_soon && (<span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Soon</span>)}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
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
                <label htmlFor="contract-title" className="text-xs font-semibold text-neutral-600">Contract Title <span className="text-red-500">*</span></label>
                <input id="contract-title" type="text" className="form-input" placeholder="e.g. French Interpretation — Legal Drafters Meeting" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label htmlFor="contract-vendor" className="text-xs font-semibold text-neutral-600">Counterparty <span className="text-red-500">*</span></label>
                <select id="contract-vendor" className="form-input" value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select counterparty…</option>
                  {availableVendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
                {availableVendors.length === 0 && (
                  <p className="text-xs text-amber-600">No approved suppliers found. <Link href="/procurement/vendors" className="btn-secondary text-xs py-0.5 px-2 inline-flex">Add a supplier</Link> first.</p>
                )}
              </div>

              {awardedRequests.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="contract-request" className="text-xs font-semibold text-neutral-600">Linked Procurement Award (optional)</label>
                  <select id="contract-request" className="form-input" value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">None</option>
                    {awardedRequests.map((r) => (<option key={r.id} value={r.id}>{r.reference_number} — {r.title}</option>))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="contract-start" className="text-xs font-semibold text-neutral-600">Start Date <span className="text-red-500">*</span></label>
                  <input id="contract-start" type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="contract-end" className="text-xs font-semibold text-neutral-600">End Date <span className="text-red-500">*</span></label>
                  <input id="contract-end" type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="contract-value" className="text-xs font-semibold text-neutral-600">Contract Value <span className="text-red-500">*</span></label>
                  <input id="contract-value" type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="contract-currency" className="text-xs font-semibold text-neutral-600">Currency</label>
                  <input id="contract-currency" type="text" className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="contract-description" className="text-xs font-semibold text-neutral-600">Description (optional)</label>
                <textarea id="contract-description" className="form-input resize-none h-20" placeholder="Brief description of the contract scope…" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
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

export default function ContractRegisterPage() {
  return (
    <Suspense fallback={null}>
      <ContractRegisterInner />
    </Suspense>
  );
}
