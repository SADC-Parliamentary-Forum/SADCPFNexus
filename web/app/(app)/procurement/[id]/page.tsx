"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { procurementApi, quotesApi, procurementRequestAttachmentsApi, PROCUREMENT_REQUEST_DOC_TYPES, type ProcurementRequest, type ProcurementAttachment, type ProcurementQuote } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { readStoredUser } from "@/lib/session";
import { useFormatDate } from "@/lib/useFormatDate";
import axios from "axios";

function getStoredUser(): { roles?: string[] } | null {
  return readStoredUser();
}

function canAward(user: { roles?: string[] } | null): boolean {
  const allowed = ["Procurement Officer", "Secretary General", "System Admin", "super-admin"];
  return (user?.roles ?? []).some((r) => allowed.includes(r));
}

function isHOD(user: { roles?: string[] } | null): boolean {
  return (user?.roles ?? []).some((r) => ["HOD", "System Admin", "super-admin"].includes(r));
}

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:       { label: "Approved",        cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"    },
  submitted:      { label: "Pending Review",  cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"         },
  hod_approved:   { label: "HOD Approved",    cls: "text-teal-700 bg-teal-50 border-teal-200",           icon: "supervisor_account" },
  hod_rejected:   { label: "HOD Rejected",    cls: "text-red-700 bg-red-50 border-red-200",              icon: "person_off"      },
  budget_reserved:{ label: "Budget Reserved", cls: "text-indigo-700 bg-indigo-50 border-indigo-200",     icon: "savings"         },
  rejected:       { label: "Rejected",        cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"          },
  draft:          { label: "Draft",           cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"       },
  awarded:        { label: "Awarded",         cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "emoji_events"    },
};

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  goods:    { icon: "inventory_2",    color: "text-primary",  bg: "bg-primary/10"  },
  services: { icon: "handyman",       color: "text-purple-600", bg: "bg-purple-50" },
  works:    { icon: "construction",   color: "text-orange-600", bg: "bg-orange-50" },
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

export default function ProcurementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = use(params);
  const { fmt } = useFormatDate();
  const [request, setRequest]     = useState<ProcurementRequest | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ roles?: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "documents">("details");
  const [attachments, setAttachments] = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Award modal state
  const [showAward, setShowAward]       = useState(false);
  const [awardQuoteId, setAwardQuoteId] = useState<number | "">("");
  const [awardNotes, setAwardNotes]     = useState("");
  const [awarding, setAwarding]         = useState(false);
  const [awardError, setAwardError]     = useState<string | null>(null);

  // Add Quote form state
  const [showAddQuote, setShowAddQuote]   = useState(false);
  const [quoteVendorName, setQuoteVendorName] = useState("");
  const [quoteAmount, setQuoteAmount]     = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("NAD");
  const [quoteNotes, setQuoteNotes]       = useState("");
  const [quoteDate, setQuoteDate]         = useState("");
  const [addingQuote, setAddingQuote]     = useState(false);
  const [quoteError, setQuoteError]       = useState<string | null>(null);

  // HOD action state
  const [hodAction, setHodAction]         = useState<"approve" | "reject" | null>(null);
  const [hodRejReason, setHodRejReason]   = useState("");
  const [hodWorking, setHodWorking]       = useState(false);
  const [hodError, setHodError]           = useState<string | null>(null);

  useEffect(() => { setCurrentUser(getStoredUser()); }, []);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) {
      setError("Invalid request ID");
      setLoading(false);
      return;
    }
    Promise.all([
      procurementApi.get(id).then((res) => setRequest(res.data)),
      procurementRequestAttachmentsApi.list(id).then((r) => setAttachments(r.data.data ?? [])).catch(() => {}),
    ])
      .catch(() => setError("Failed to load procurement request."))
      .finally(() => setLoading(false));
  }, [paramId]);

  async function handleAddQuote() {
    if (!request || !quoteVendorName || !quoteAmount) return;
    setAddingQuote(true);
    setQuoteError(null);
    try {
      const res = await quotesApi.create(request.id, {
        vendor_name: quoteVendorName,
        quoted_amount: parseFloat(quoteAmount),
        currency: quoteCurrency,
        notes: quoteNotes || undefined,
        quote_date: quoteDate || undefined,
      });
      // Append new quote to request.quotes
      setRequest((prev) => prev ? { ...prev, quotes: [...(prev.quotes ?? []), res.data.data] } : prev);
      setShowAddQuote(false);
      setQuoteVendorName("");
      setQuoteAmount("");
      setQuoteNotes("");
      setQuoteDate("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to add quote.";
      setQuoteError(msg);
    } finally {
      setAddingQuote(false);
    }
  }

  async function handleAward() {
    if (!request || !awardQuoteId) return;
    setAwarding(true);
    setAwardError(null);
    try {
      const res = await procurementApi.award(request.id, Number(awardQuoteId), awardNotes);
      setRequest(res.data.data);
      setShowAward(false);
      setAwardQuoteId("");
      setAwardNotes("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to award contract.";
      setAwardError(msg);
    } finally {
      setAwarding(false);
    }
  }

  async function handleHodAction() {
    if (!request) return;
    setHodWorking(true);
    setHodError(null);
    try {
      const res = hodAction === "approve"
        ? await procurementApi.hodApprove(request.id)
        : await procurementApi.hodReject(request.id, hodRejReason);
      setRequest(res.data.data);
      setHodAction(null);
      setHodRejReason("");
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? "Action failed." : "Action failed.";
      setHodError(msg);
    } finally {
      setHodWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Error loading request</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? "Request not found."}</p>
          </div>
        </div>
        <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Procurement
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const catInfo = categoryConfig[request.category] ?? { icon: "shopping_cart", color: "text-neutral-600", bg: "bg-neutral-100" };
  const items = request.items ?? [];
  const quotes = request.quotes ?? [];
  const totalItems = items.reduce((sum, i) => sum + (i.total_price ?? 0), 0);
  const currency = request.currency ?? "USD";

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "documents" ? `Documents${attachments.length > 0 ? ` (${attachments.length})` : ""}` : "Details"}
          </button>
        ))}
      </div>

      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">Procurement Documents</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={PROCUREMENT_REQUEST_DOC_TYPES as unknown as { value: string; label: string; icon: string }[]}
            defaultType="rfq_document"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try {
                const r = await procurementRequestAttachmentsApi.upload(request!.id, file, type);
                setAttachments((prev) => [r.data.data, ...prev]);
              } finally { setUploading(false); }
            }}
            onDelete={async (id) => {
              await procurementRequestAttachmentsApi.delete(request!.id, id);
              setAttachments((prev) => prev.filter((a) => a.id !== id));
            }}
            downloadUrl={(id) => procurementRequestAttachmentsApi.downloadUrl(request!.id, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>

      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
          <Link href="/procurement" className="hover:text-primary transition-colors font-medium">Procurement</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-mono text-neutral-500">{request.reference_number}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${catInfo.color} bg-${catInfo.bg} border-neutral-200`}>
                <span className={`material-symbols-outlined text-[12px] ${catInfo.color}`}>{catInfo.icon}</span>
                {request.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                <span className="material-symbols-outlined text-[12px]">gavel</span>
                {request.procurement_method ?? "—"}
              </span>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">{request.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {/* HOD action buttons — visible when submitted and current user is HOD */}
            {request.status === "submitted" && isHOD(currentUser) && (
              <>
                <button
                  onClick={() => { setHodAction("approve"); setHodError(null); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">supervisor_account</span>
                  HOD Approve
                </button>
                <button
                  onClick={() => { setHodAction("reject"); setHodError(null); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">person_off</span>
                  HOD Reject
                </button>
              </>
            )}
            {request.status === "approved" && canAward(currentUser) && quotes.length > 0 && (
              <button
                onClick={() => setShowAward(true)}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                Award Contract
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Requested By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requested By</h3>
            {request.submitted_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {fmt(request.submitted_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {String(request.requester.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2) || "—"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name}</p>
              <p className="text-xs text-neutral-400">
                {[request.requester.job_title, (request.requester as { employee_number?: string }).employee_number].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requisition Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="shopping_cart" color="text-purple-600" bg="bg-purple-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requisition Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">category</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Category</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{request.category}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">gavel</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Procurement Method</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{request.procurement_method ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">account_tree</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Budget Line</p>
            </div>
            <p className="font-mono text-xs text-neutral-900">{request.budget_line ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">calendar_today</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Required By</p>
            </div>
            <p className="font-medium text-neutral-900">{request.required_by_date ?? "—"}</p>
          </div>
        </div>
        {request.description && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Description</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.description}</p>
          </div>
        )}
        {request.justification && (
          <div className="mt-3 pt-3 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chat_bubble</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Justification</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <SectionIcon icon="list_alt" color="text-neutral-600" bg="bg-neutral-100" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Line Items</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Total</span>
            <span className="text-sm font-bold text-primary">{currency} {totalItems.toLocaleString()}</span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-neutral-400 py-8">No line items.</td>
              </tr>
            ) : items.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-medium text-neutral-900">{item.description}</p>
                  {item.unit && <p className="text-xs text-neutral-400">{item.unit}</p>}
                </td>
                <td className="text-center font-medium text-neutral-700">{item.quantity}</td>
                <td className="text-right text-neutral-600">{currency} {(item.estimated_unit_price ?? 0).toLocaleString()}</td>
                <td className="text-right font-bold text-neutral-900">{currency} {(item.total_price ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor Quotes */}
      {(quotes.length > 0 || request.rfq_issued_at) && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="storefront" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Vendor Quotes</h3>
            <span className="ml-auto text-xs text-neutral-400">{quotes.length} quote{quotes.length !== 1 ? "s" : ""}</span>
            {request.rfq_issued_at && request.status !== "awarded" && canAward(currentUser) && (
              <button
                type="button"
                onClick={() => setShowAddQuote((v) => !v)}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add Quote
              </button>
            )}
          </div>

          {/* Add Quote Form */}
          {showAddQuote && (
            <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-700">New Vendor Quote</p>
              {quoteError && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{quoteError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Vendor Name *</label>
                  <input
                    type="text"
                    className="form-input text-sm"
                    placeholder="e.g. ABC Supplies Ltd"
                    value={quoteVendorName}
                    onChange={(e) => setQuoteVendorName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-24 flex-shrink-0">
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Currency</label>
                    <select className="form-input text-sm" value={quoteCurrency} onChange={(e) => setQuoteCurrency(e.target.value)}>
                      {["NAD", "USD", "ZAR", "BWP", "ZMW", "MWK", "TZS", "EUR"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Amount *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input text-sm"
                      placeholder="0.00"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Quote Date</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Notes</label>
                  <input
                    type="text"
                    className="form-input text-sm"
                    placeholder="Optional notes"
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddQuote}
                  disabled={addingQuote || !quoteVendorName || !quoteAmount}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {addingQuote ? "hourglass_top" : "save"}
                  </span>
                  {addingQuote ? "Saving…" : "Save Quote"}
                </button>
                <button type="button" onClick={() => { setShowAddQuote(false); setQuoteError(null); }} className="btn-secondary text-xs py-1.5 px-3">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {quotes.length === 0 && !showAddQuote && (
            <p className="text-xs text-neutral-400 text-center py-3">
              No quotes added yet. Click &ldquo;Add Quote&rdquo; to record vendor quotes.
            </p>
          )}
          <div className="space-y-2.5">
            {[...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)).map((q, i) => (
              <div key={q.id} className={`rounded-xl border p-4 ${q.is_recommended ? "border-primary/30 bg-primary/5" : "border-neutral-100 bg-neutral-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${q.is_recommended ? "bg-primary/10" : "bg-white border border-neutral-200"}`}>
                      <span className={`material-symbols-outlined text-[18px] ${q.is_recommended ? "text-primary" : "text-neutral-400"}`}>storefront</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-neutral-900">{q.vendor_name}</p>
                        {q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">star</span>
                            Recommended
                          </span>
                        )}
                        {i === 0 && !q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">trending_down</span>
                            Lowest
                          </span>
                        )}
                      </div>
                      {q.notes && <p className="text-xs text-neutral-500">{q.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Quote</p>
                    <p className="text-base font-bold text-neutral-900">{q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awarded banner */}
      {request.status === "awarded" && request.awarded_quote_id && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-500 text-[22px] flex-shrink-0 mt-0.5">emoji_events</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Contract Awarded</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Awarded to <strong>{quotes.find(q => q.id === request.awarded_quote_id)?.vendor_name ?? "vendor"}</strong>
                {request.award_notes && ` — ${request.award_notes}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/procurement/purchase-orders?request=${request.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              Create Purchase Order
            </Link>
            <Link
              href={`/procurement/contracts?request=${request.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">description</span>
              Create Contract
            </Link>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Procurement
      </Link>

      </> /* end details tab */}

      {/* HOD Approve / Reject Modal */}
      {hodAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setHodAction(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${hodAction === "approve" ? "bg-teal-50" : "bg-red-50"}`}>
                <span className={`material-symbols-outlined text-[20px] ${hodAction === "approve" ? "text-teal-600" : "text-red-600"}`}>
                  {hodAction === "approve" ? "supervisor_account" : "person_off"}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  {hodAction === "approve" ? "HOD Approve Request" : "HOD Reject Request"}
                </h2>
                <p className="text-xs text-neutral-500">{request.reference_number}</p>
              </div>
            </div>

            {hodError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{hodError}</div>
            )}

            {hodAction === "reject" && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="form-input w-full h-24 resize-none"
                  placeholder="Explain why this request is being rejected…"
                  value={hodRejReason}
                  onChange={(e) => setHodRejReason(e.target.value)}
                />
              </div>
            )}

            {hodAction === "approve" && (
              <p className="text-sm text-neutral-600">
                You are confirming HOD approval of <strong>{request.title}</strong>. This will forward the request for procurement review.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setHodAction(null); setHodError(null); setHodRejReason(""); }}
                disabled={hodWorking}
              >
                Cancel
              </button>
              <button
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${hodAction === "approve" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-600 hover:bg-red-700"}`}
                onClick={handleHodAction}
                disabled={hodWorking || (hodAction === "reject" && !hodRejReason.trim())}
              >
                {hodWorking ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">{hodAction === "approve" ? "check" : "close"}</span>
                )}
                {hodWorking ? "Processing…" : hodAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award Contract Modal */}
      {showAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAward(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[20px]">emoji_events</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Award Contract</h2>
                <p className="text-xs text-neutral-500">{request.reference_number}</p>
              </div>
            </div>

            {awardError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{awardError}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Select Winning Quote <span className="text-red-500">*</span>
              </label>
              <select
                className="form-input w-full"
                value={awardQuoteId}
                onChange={(e) => setAwardQuoteId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Choose a vendor quote —</option>
                {[...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.vendor_name} — {q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}
                    {q.is_recommended ? " ★ Recommended" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Award Notes</label>
              <textarea
                className="form-input w-full h-20 resize-none"
                placeholder="Reason for selection, evaluation summary…"
                value={awardNotes}
                onChange={(e) => setAwardNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setShowAward(false); setAwardError(null); }}
                disabled={awarding}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5"
                onClick={handleAward}
                disabled={awarding || !awardQuoteId}
              >
                {awarding ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                )}
                {awarding ? "Awarding…" : "Confirm Award"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
