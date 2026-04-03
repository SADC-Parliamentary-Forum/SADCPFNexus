"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  procurementApi, quotesApi,
  type ProcurementRequest, type ProcurementQuote, type CreateQuotePayload,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}
function canManage() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) =>
    ["Procurement Officer", "Finance Controller", "System Admin", "super-admin", "Secretary General"].includes(r)
  );
}

interface QuoteFormState {
  vendor_name: string;
  quoted_amount: string;
  currency: string;
  quote_date: string;
  notes: string;
  is_recommended: boolean;
}

const emptyForm = (currency: string): QuoteFormState => ({
  vendor_name: "", quoted_amount: "", currency, quote_date: "", notes: "", is_recommended: false,
});

export default function RfqDetailPage({ params }: { params: { id: string } }) {
  const reqId       = Number(params.id);
  const queryClient = useQueryClient();

  const [showAddQuote, setShowAddQuote]   = useState(false);
  const [editingQuote, setEditingQuote]   = useState<ProcurementQuote | null>(null);
  const [quoteForm, setQuoteForm]         = useState<QuoteFormState>(emptyForm(DEFAULT_CURRENCY));
  const [quoteError, setQuoteError]       = useState<string | null>(null);

  const [showRfqPanel, setShowRfqPanel]   = useState(false);
  const [rfqDeadline, setRfqDeadline]     = useState("");
  const [rfqNotes, setRfqNotes]           = useState("");
  const [rfqError, setRfqError]           = useState<string | null>(null);

  const [showAward, setShowAward]         = useState(false);
  const [awardQuoteId, setAwardQuoteId]   = useState<number | "">("");
  const [awardNotes, setAwardNotes]       = useState("");
  const [awardError, setAwardError]       = useState<string | null>(null);

  const [deletingId, setDeletingId]       = useState<number | null>(null);

  const { data: req, isLoading, isError } = useQuery({
    queryKey: ["rfq-request", reqId],
    queryFn:  () => procurementApi.get(reqId).then((r) => r.data as unknown as ProcurementRequest),
    enabled:  !!reqId,
  });

  const { data: quotesData, refetch: refetchQuotes } = useQuery({
    queryKey: ["rfq-quotes", reqId],
    queryFn:  () => quotesApi.list(reqId).then((r) => r.data.data),
    enabled:  !!reqId,
  });

  const quotes: ProcurementQuote[] = (quotesData ?? []) as ProcurementQuote[];

  // Pre-fill rfq panel when request loads
  useEffect(() => {
    if (req) {
      setRfqDeadline(req.rfq_deadline ? req.rfq_deadline.split("T")[0] : "");
      setRfqNotes(req.rfq_notes ?? "");
      setQuoteForm(emptyForm(req.currency ?? DEFAULT_CURRENCY));
    }
  }, [req]);

  // ─── Issue RFQ ───────────────────────────────────────────────────────────────
  const issueMutation = useMutation({
    mutationFn: () => procurementApi.issueRfq(reqId, {
      rfq_deadline: rfqDeadline || undefined,
      rfq_notes:    rfqNotes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowRfqPanel(false);
      setRfqError(null);
    },
    onError: (e: unknown) => {
      setRfqError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to issue RFQ.");
    },
  });

  // ─── Add / Edit Quote ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: CreateQuotePayload = {
        vendor_name:    quoteForm.vendor_name.trim(),
        quoted_amount:  Number(quoteForm.quoted_amount),
        currency:       quoteForm.currency || (req?.currency ?? DEFAULT_CURRENCY),
        is_recommended: quoteForm.is_recommended,
        notes:          quoteForm.notes.trim() || undefined,
        quote_date:     quoteForm.quote_date || undefined,
      };
      return editingQuote
        ? quotesApi.update(reqId, editingQuote.id, payload)
        : quotesApi.create(reqId, payload);
    },
    onSuccess: () => {
      refetchQuotes();
      setShowAddQuote(false);
      setEditingQuote(null);
      setQuoteForm(emptyForm(req?.currency ?? DEFAULT_CURRENCY));
      setQuoteError(null);
    },
    onError: (e: unknown) => {
      setQuoteError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save quote.");
    },
  });

  async function handleDeleteQuote(quoteId: number) {
    setDeletingId(quoteId);
    try { await quotesApi.delete(reqId, quoteId); refetchQuotes(); }
    finally { setDeletingId(null); }
  }

  function openEdit(q: ProcurementQuote) {
    setEditingQuote(q);
    setQuoteForm({
      vendor_name:    q.vendor_name,
      quoted_amount:  String(q.quoted_amount),
      currency:       q.currency ?? (req?.currency ?? DEFAULT_CURRENCY),
      quote_date:     q.quote_date ? q.quote_date.split("T")[0] : "",
      notes:          q.notes ?? "",
      is_recommended: q.is_recommended,
    });
    setQuoteError(null);
    setShowAddQuote(true);
  }

  // ─── Award ───────────────────────────────────────────────────────────────────
  const awardMutation = useMutation({
    mutationFn: () => procurementApi.award(reqId, Number(awardQuoteId), awardNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowAward(false);
      setAwardError(null);
    },
    onError: (e: unknown) => {
      setAwardError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to award.");
    },
  });

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const currency      = req?.currency ?? DEFAULT_CURRENCY;
  const isAwarded     = req?.status === "awarded";
  const canEdit       = canManage();
  const sortedQuotes  = [...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0));
  const lowestQuote   = sortedQuotes[0] ?? null;

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3">
        <div className="h-6 w-64 bg-neutral-100 rounded" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
    </div>
  );

  if (isError || !req) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Request not found.</p>
      <Link href="/procurement/rfq" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/rfq" className="hover:text-primary">RFQs</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{req.reference_number}</span>
      </nav>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{req.title}</h1>
            <p className="font-mono text-xs text-neutral-400 mt-0.5">{req.reference_number}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {isAwarded ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                Awarded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Approved
              </span>
            )}
            {!isAwarded && canEdit && quotes.length > 0 && (
              <button
                onClick={() => { setAwardQuoteId(""); setAwardNotes(""); setAwardError(null); setShowAward(true); }}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                Award Contract
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "Category",       icon: "category",       value: <span className="capitalize">{req.category}</span>                     },
            { label: "Method",         icon: "gavel",          value: <span className="capitalize">{req.procurement_method ?? "—"}</span>    },
            { label: "Estimated Value",icon: "payments",       value: `${currency} ${(req.estimated_value ?? 0).toLocaleString()}`           },
            { label: "Required By",    icon: "calendar_today", value: req.required_by_date ? formatDateShort(req.required_by_date) : "—"     },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[13px] text-neutral-300">{row.icon}</span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.label}</p>
              </div>
              <p className="font-medium text-neutral-900">{row.value}</p>
            </div>
          ))}
        </div>

        {req.description && (
          <p className="mt-4 pt-4 border-t border-neutral-50 text-sm text-neutral-600 leading-relaxed">{req.description}</p>
        )}
      </div>

      {/* RFQ Control */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">send</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">RFQ Issuance</h3>
              {req.rfq_issued_at ? (
                <p className="text-xs text-neutral-400">
                  Issued {formatDateShort(req.rfq_issued_at)}
                  {req.rfq_deadline ? ` · Deadline ${formatDateShort(req.rfq_deadline)}` : ""}
                </p>
              ) : (
                <p className="text-xs text-neutral-400">Not yet issued</p>
              )}
            </div>
          </div>
          {!isAwarded && canEdit && (
            <button
              onClick={() => setShowRfqPanel((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/5 transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">{req.rfq_issued_at ? "edit" : "send"}</span>
              {req.rfq_issued_at ? "Update RFQ" : "Issue RFQ"}
            </button>
          )}
        </div>

        {showRfqPanel && (
          <div className="border-t border-neutral-100 pt-4 space-y-4">
            {rfqError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rfqError}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Quote Deadline</label>
                <input type="date" className="form-input" value={rfqDeadline} onChange={(e) => setRfqDeadline(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">RFQ Notes / Instructions</label>
              <textarea
                className="form-input w-full h-20 resize-none"
                placeholder="Scope of work, evaluation criteria, submission requirements…"
                value={rfqNotes}
                onChange={(e) => setRfqNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-sm px-4" onClick={() => setShowRfqPanel(false)}>Cancel</button>
              <button
                className="btn-primary text-sm px-4 disabled:opacity-60 inline-flex items-center gap-1.5"
                disabled={issueMutation.isPending}
                onClick={() => issueMutation.mutate()}
              >
                {issueMutation.isPending
                  ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-[16px]">send</span>}
                {issueMutation.isPending ? "Saving…" : req.rfq_issued_at ? "Update RFQ" : "Issue RFQ"}
              </button>
            </div>
          </div>
        )}

        {req.rfq_notes && !showRfqPanel && (
          <div className="mt-3 rounded-lg bg-indigo-50/50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-700 leading-relaxed">
            {req.rfq_notes}
          </div>
        )}
      </div>

      {/* Line Items */}
      {(req.items ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">list_alt</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Items to Quote</h3>
            </div>
            <span className="text-sm font-bold text-primary">
              {currency} {(req.items ?? []).reduce((s, i) => s + (i.total_price ?? 0), 0).toLocaleString()}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-center">Qty</th>
                <th>Unit</th>
                <th className="text-right">Est. Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {(req.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-neutral-900">{item.description}</td>
                  <td className="text-center text-neutral-700">{item.quantity}</td>
                  <td className="text-xs text-neutral-400">{item.unit}</td>
                  <td className="text-right text-neutral-600">{currency} {(item.estimated_unit_price ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor Quotes */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-teal-600">storefront</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-800">Vendor Quotes</h3>
              <p className="text-xs text-neutral-400">{quotes.length} quote{quotes.length !== 1 ? "s" : ""} received</p>
            </div>
          </div>
          {!isAwarded && canEdit && (
            <button
              onClick={() => { setEditingQuote(null); setQuoteForm(emptyForm(currency)); setQuoteError(null); setShowAddQuote(true); }}
              className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Record Quote
            </button>
          )}
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 py-10 text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-neutral-300">storefront</span>
            <p className="text-sm text-neutral-500">No quotes recorded yet.</p>
            {!isAwarded && canEdit && (
              <button
                onClick={() => { setEditingQuote(null); setQuoteForm(emptyForm(currency)); setQuoteError(null); setShowAddQuote(true); }}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
                Add the first quote
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedQuotes.map((q, idx) => {
              const isLowest  = idx === 0;
              const isWinner  = isAwarded && q.id === req.awarded_quote_id;
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isWinner  ? "border-blue-300 bg-blue-50" :
                    q.is_recommended ? "border-primary/30 bg-primary/5" :
                    "border-neutral-100 bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                        isWinner ? "bg-blue-100" : q.is_recommended ? "bg-primary/10" : "bg-white border border-neutral-200"
                      }`}>
                        <span className={`material-symbols-outlined text-[18px] ${
                          isWinner ? "text-blue-600" : q.is_recommended ? "text-primary" : "text-neutral-400"
                        }`}>{isWinner ? "emoji_events" : "storefront"}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold text-neutral-900">{q.vendor_name}</p>
                          {isWinner && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[11px]">emoji_events</span>
                              Awarded
                            </span>
                          )}
                          {!isAwarded && q.is_recommended && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[11px]">star</span>
                              Recommended
                            </span>
                          )}
                          {!isAwarded && isLowest && !q.is_recommended && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[11px]">trending_down</span>
                              Lowest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {q.quote_date && (
                            <span className="text-xs text-neutral-400 inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                              {formatDateShort(q.quote_date)}
                            </span>
                          )}
                          {q.notes && <p className="text-xs text-neutral-500">{q.notes}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Quote</p>
                        <p className="text-base font-bold text-neutral-900">
                          {q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}
                        </p>
                      </div>
                      {!isAwarded && canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(q)}
                            className="flex items-center justify-center h-7 w-7 rounded-lg border border-neutral-200 text-neutral-400 hover:text-primary hover:border-primary/50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(q.id)}
                            disabled={deletingId === q.id}
                            className="flex items-center justify-center h-7 w-7 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {deletingId === q.id ? "progress_activity" : "delete"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Comparison summary */}
            {quotes.length > 1 && (
              <div className="mt-2 rounded-xl bg-neutral-50 border border-neutral-100 p-3 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="text-neutral-400 mb-0.5">Lowest</p>
                  <p className="font-bold text-green-700">
                    {sortedQuotes[0].currency ?? currency} {(sortedQuotes[0].quoted_amount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400 mb-0.5">Highest</p>
                  <p className="font-bold text-red-600">
                    {sortedQuotes[sortedQuotes.length - 1].currency ?? currency}{" "}
                    {(sortedQuotes[sortedQuotes.length - 1].quoted_amount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-400 mb-0.5">Savings vs Highest</p>
                  <p className="font-bold text-neutral-900">
                    {currency}{" "}
                    {((sortedQuotes[sortedQuotes.length - 1].quoted_amount ?? 0) - (sortedQuotes[0].quoted_amount ?? 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Awarded banner */}
      {isAwarded && req.awarded_quote_id && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="material-symbols-outlined text-blue-500 text-[22px] flex-shrink-0 mt-0.5">emoji_events</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Contract Awarded</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Awarded to <strong>{quotes.find((q) => q.id === req.awarded_quote_id)?.vendor_name ?? "vendor"}</strong>
                {req.award_notes ? ` — ${req.award_notes}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/procurement/purchase-orders?request=${req.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              Create Purchase Order
            </Link>
            <Link
              href={`/procurement/${req.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              View Request
            </Link>
          </div>
        </div>
      )}

      <Link href="/procurement/rfq" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to RFQs
      </Link>

      {/* ─── Add / Edit Quote Modal ─── */}
      {showAddQuote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { setShowAddQuote(false); setEditingQuote(null); }}
        >
          <div
            className="card w-full max-w-md p-6 space-y-4 scrollbar-hide overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50">
                <span className="material-symbols-outlined text-[20px] text-teal-600">storefront</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">
                {editingQuote ? "Edit Quote" : "Record Quote"}
              </h2>
            </div>

            {quoteError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{quoteError}</div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Vendor / Supplier Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ABC Supplies Ltd"
                  value={quoteForm.vendor_name}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, vendor_name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Quoted Amount <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={quoteForm.quoted_amount}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, quoted_amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    className="form-input"
                    value={quoteForm.currency}
                    onChange={(e) => setQuoteForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Quote Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={quoteForm.quote_date}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, quote_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Notes</label>
                <textarea
                  className="form-input w-full h-16 resize-none"
                  placeholder="Lead time, conditions, exclusions…"
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 text-primary"
                  checked={quoteForm.is_recommended}
                  onChange={(e) => setQuoteForm((p) => ({ ...p, is_recommended: e.target.checked }))}
                />
                <span className="text-sm text-neutral-700">Mark as recommended / preferred</span>
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setShowAddQuote(false); setEditingQuote(null); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                disabled={!quoteForm.vendor_name.trim() || !quoteForm.quoted_amount || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending
                  ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                {saveMutation.isPending ? "Saving…" : editingQuote ? "Update Quote" : "Save Quote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Award Modal ─── */}
      {showAward && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowAward(false)}
        >
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-[20px] text-primary">emoji_events</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Award Contract</h2>
                <p className="text-xs text-neutral-500">{req.reference_number}</p>
              </div>
            </div>

            {awardError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{awardError}</div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Select Winning Quote <span className="text-red-500">*</span></label>
              <select
                className="form-input"
                value={awardQuoteId}
                onChange={(e) => setAwardQuoteId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Choose a vendor —</option>
                {sortedQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.vendor_name} — {q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}
                    {q.is_recommended ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Award Notes</label>
              <textarea
                className="form-input w-full h-20 resize-none"
                placeholder="Evaluation summary, reason for selection…"
                value={awardNotes}
                onChange={(e) => setAwardNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setShowAward(false)}>Cancel</button>
              <button
                className="btn-primary flex-1 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                disabled={!awardQuoteId || awardMutation.isPending}
                onClick={() => awardMutation.mutate()}
              >
                {awardMutation.isPending
                  ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-[16px]">emoji_events</span>}
                {awardMutation.isPending ? "Awarding…" : "Confirm Award"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
