"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  procurementApi,
  supplierCategoriesApi,
  type ProcurementRequest,
  type SupplierCategory,
} from "@/lib/api";
import { canIssueProcurementRfq, canViewProcurementRfq, getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

type RfqFilter = "all" | "open" | "in_progress" | "ready";
type ExternalInvite = { name: string; email: string };

function rfqFilter(req: ProcurementRequest): RfqFilter {
  const quotes = req.quotes ?? [];
  if (quotes.length === 0) return "open";
  return "in_progress";
}

function rfqBadge(filter: RfqFilter) {
  if (filter === "open")        return { label: "Open",      cls: "badge-warning", icon: "hourglass_empty" };
  if (filter === "in_progress") return { label: "Quotes In", cls: "badge-primary", icon: "rate_review" };
  return                              { label: "Open",      cls: "badge-warning", icon: "hourglass_empty" };
}

const FILTERS: { key: RfqFilter | "awarded"; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "open",        label: "Open" },
  { key: "in_progress", label: "Quotes In" },
  { key: "awarded",     label: "Awarded" },
];

export default function RfqListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const canViewRfq = canViewProcurementRfq(user);
  const canIssueRfq = canIssueProcurementRfq(user);

  const [tab, setTab] = useState<RfqFilter | "awarded">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">("");
  const [rfqDeadline, setRfqDeadline] = useState("");
  const [rfqNotes, setRfqNotes] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [externalInvites, setExternalInvites] = useState<ExternalInvite[]>([{ name: "", email: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: approvedData, isLoading: loadingApproved } = useQuery({
    queryKey: ["rfq-approved"],
    queryFn: () => procurementApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: canViewRfq,
  });

  const { data: awardedData, isLoading: loadingAwarded } = useQuery({
    queryKey: ["rfq-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: canViewRfq,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data as SupplierCategory[]),
    enabled: canIssueRfq && showCreate,
  });

  const approved: ProcurementRequest[] = (approvedData as { data?: ProcurementRequest[] })?.data ?? [];
  const awarded: ProcurementRequest[] = (awardedData as { data?: ProcurementRequest[] })?.data ?? [];
  const eligibleRequests = useMemo(
    () => approved.filter((request) => !request.rfq_issued_at && request.status === "approved"),
    [approved]
  );
  const selectedRequest = eligibleRequests.find((request) => request.id === selectedRequestId) ?? null;

  useEffect(() => {
    if (!showCreate || selectedRequestId || eligibleRequests.length !== 1) return;
    setSelectedRequestId(eligibleRequests[0].id);
  }, [eligibleRequests, selectedRequestId, showCreate]);

  const open = approved.filter((r) => (r.quotes ?? []).length === 0);
  const inProgress = approved.filter((r) => (r.quotes ?? []).length > 0);

  const displayed = (() => {
    if (tab === "awarded") return awarded;
    if (tab === "open") return open;
    if (tab === "in_progress") return inProgress;
    return [...approved, ...awarded];
  })();

  const issueMutation = useMutation({
    mutationFn: async () => {
      const filledExternalInvites = externalInvites
        .filter((invite) => invite.email.trim())
        .map((invite) => ({
          name: invite.name.trim() || undefined,
          email: invite.email.trim(),
        }));

      if (!selectedRequestId) throw new Error("Select an approved procurement request.");
      if (categoryIds.length < 1 || categoryIds.length > 3) {
        throw new Error("Select between 1 and 3 supplier categories.");
      }

      const invalidEmail = filledExternalInvites.find((invite) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email));
      if (invalidEmail) throw new Error(`Invalid email address: ${invalidEmail.email}`);

      return procurementApi.issueRfq(selectedRequestId, {
        rfq_deadline: rfqDeadline || undefined,
        rfq_notes: rfqNotes.trim() || undefined,
        category_ids: categoryIds,
        external_invites: filledExternalInvites,
      });
    },
    onSuccess: async () => {
      const requestId = Number(selectedRequestId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rfq-approved"] }),
        queryClient.invalidateQueries({ queryKey: ["rfq-awarded"] }),
        queryClient.invalidateQueries({ queryKey: ["rfq-request", requestId] }),
      ]);
      setFormError(null);
      setShowCreate(false);
      setSelectedRequestId("");
      setCategoryIds([]);
      setRfqDeadline("");
      setRfqNotes("");
      setExternalInvites([{ name: "", email: "" }]);
      router.push(`/procurement/rfq/${requestId}`);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to issue RFQ.";
      setFormError(message);
    },
  });

  const isLoading = loadingApproved || loadingAwarded;

  if (!canViewRfq) {
    return <div className="card p-6">You do not have permission to view RFQs.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Requests for Quotation</h1>
          <p className="page-subtitle">Issue RFQs from approved procurement requests and track supplier responses.</p>
        </div>
        {canIssueRfq && (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5 text-sm"
            onClick={() => {
              setFormError(null);
              setShowCreate(true);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create RFQ
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total RFQs", value: approved.length + awarded.length, icon: "request_quote", color: "text-primary", bg: "bg-primary/10" },
          { label: "Open", value: open.length, icon: "hourglass_empty", color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Quotes In", value: inProgress.length, icon: "rate_review", color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Awarded", value: awarded.length, icon: "emoji_events", color: "text-green-600", bg: "bg-green-50" },
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

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTab(f.key)}
            className={`filter-tab ${tab === f.key ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {canIssueRfq && eligibleRequests.length === 0 && (
        <div className="card p-4 text-sm text-amber-700 bg-amber-50 border-amber-200">
          No approved procurement requests are ready for a new RFQ. Approve a procurement request first, or update an existing RFQ from its detail page.
        </div>
      )}

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
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">request_quote</span>
          <p className="text-sm text-neutral-500">No RFQs found for this filter.</p>
          <p className="text-xs text-neutral-400">
            RFQs are issued from approved procurement requests.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th className="text-right">Est. Value</th>
                  <th className="text-center">Quotes</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((req) => {
                  const quotes = req.quotes ?? [];
                  const isAwarded = req.status === "awarded";
                  const filter = isAwarded ? ("awarded" as const) : rfqFilter(req);
                  const badge = isAwarded
                    ? { label: "Awarded", cls: "badge-success", icon: "emoji_events" }
                    : rfqBadge(filter as RfqFilter);
                  const lowest = quotes.length > 0 ? Math.min(...quotes.map((q) => q.quoted_amount)) : null;

                  return (
                    <tr key={req.id}>
                      <td>
                        <Link href={`/procurement/rfq/${req.id}`} className="font-mono text-xs text-primary hover:underline">
                          {req.reference_number}
                        </Link>
                      </td>
                      <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{req.title}</td>
                      <td><span className="text-xs capitalize text-neutral-600">{req.category}</span></td>
                      <td className="text-right text-sm font-semibold text-neutral-900">
                        {req.currency ?? DEFAULT_CURRENCY} {(req.estimated_value ?? 0).toLocaleString()}
                      </td>
                      <td className="text-center">
                        {quotes.length === 0 ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-bold text-neutral-900">{quotes.length}</span>
                            {lowest != null && (
                              <span className="text-[10px] text-green-600 font-medium">
                                Low: {req.currency ?? DEFAULT_CURRENCY} {lowest.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-sm text-neutral-500">
                        {req.rfq_deadline ? formatDateShort(req.rfq_deadline) : "—"}
                      </td>
                      <td>
                        <span className={`badge ${badge.cls} inline-flex items-center gap-1`}>
                          <span className="material-symbols-outlined text-[11px]">{badge.icon}</span>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/procurement/rfq/${req.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors font-medium"
                        >
                          Manage
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && canIssueRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Create RFQ</h2>
                <p className="text-sm text-neutral-500">Select an approved procurement request, configure supplier targeting, and issue the RFQ.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Close</button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-600">Approved Procurement Request</label>
              <select
                className="form-input"
                value={selectedRequestId}
                onChange={(e) => setSelectedRequestId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select an approved request</option>
                {eligibleRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.reference_number} - {request.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedRequest && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Reference</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.reference_number}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Title</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.title}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Category</p>
                  <p className="text-sm font-medium text-neutral-800 capitalize">{selectedRequest.category}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Estimated Value</p>
                  <p className="text-sm font-medium text-neutral-800">
                    {selectedRequest.currency ?? DEFAULT_CURRENCY} {(selectedRequest.estimated_value ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-600">Supplier Categories</label>
                <span className="text-[11px] text-neutral-400">Select 1 to 3 categories</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={categoryIds.includes(category.id)}
                      onChange={() =>
                        setCategoryIds((current) =>
                          current.includes(category.id)
                            ? current.filter((id) => id !== category.id)
                            : current.length >= 3 ? current : [...current, category.id]
                        )
                      }
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Deadline</label>
                <input type="date" className="form-input" value={rfqDeadline} onChange={(e) => setRfqDeadline(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">RFQ Notes</label>
                <textarea
                  className="form-input h-[42px] resize-none"
                  placeholder="Special instructions, delivery expectations, or submission notes"
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-neutral-700">
              Registered suppliers matching the selected categories will receive system notifications and email. Additional email invitees will get a secure external quote link, plus a prompt to register on SADC-PF Nexus so they can view the full RFQ in the supplier portal.
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-600">Additional Email Invitees</label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setExternalInvites((current) => [...current, { name: "", email: "" }])}
                >
                  Add email address
                </button>
              </div>

              {externalInvites.map((invite, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                  <input
                    className="form-input"
                    placeholder="Supplier name"
                    value={invite.name}
                    onChange={(e) =>
                      setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))
                    }
                  />
                  <input
                    className="form-input"
                    placeholder="supplier@example.com"
                    value={invite.email}
                    onChange={(e) =>
                      setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setExternalInvites((current) =>
                        current.length === 1 ? [{ name: "", email: "" }] : current.filter((_, i) => i !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-60"
                disabled={issueMutation.isPending || !selectedRequestId || categoryIds.length === 0}
                onClick={() => issueMutation.mutate()}
              >
                {issueMutation.isPending ? "Issuing..." : "Issue RFQ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
