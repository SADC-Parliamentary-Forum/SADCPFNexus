"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  procurementApi,
  quotesApi,
  supplierCategoriesApi,
  type CreateQuotePayload,
  type ProcurementQuote,
  type ProcurementRequest,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function canManage() {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("sadcpf_user") ?? "null");
    return (user?.roles ?? []).some((role: string) =>
      ["Procurement Officer", "Finance Controller", "System Admin", "super-admin", "Secretary General"].includes(role)
    );
  } catch {
    return false;
  }
}

type Assessment = "pending" | "pass" | "fail";

type QuoteForm = {
  vendor_name: string;
  quoted_amount: string;
  currency: string;
  quote_date: string;
  notes: string;
  compliance_passed: Assessment;
  compliance_notes: string;
  is_recommended: boolean;
};

const emptyQuoteForm = (currency: string): QuoteForm => ({
  vendor_name: "",
  quoted_amount: "",
  currency,
  quote_date: "",
  notes: "",
  compliance_passed: "pending",
  compliance_notes: "",
  is_recommended: false,
});

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const reqId = Number(id);
  const queryClient = useQueryClient();
  const manager = canManage();
  const [showIssue, setShowIssue] = useState(false);
  const [rfqDeadline, setRfqDeadline] = useState("");
  const [rfqNotes, setRfqNotes] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [externalInvites, setExternalInvites] = useState([{ name: "", email: "" }]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ProcurementQuote | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuoteForm(DEFAULT_CURRENCY));
  const [showAward, setShowAward] = useState(false);
  const [awardQuoteId, setAwardQuoteId] = useState<number | "">("");
  const [awardNotes, setAwardNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: ["rfq-request", reqId],
    queryFn: () => procurementApi.get(reqId).then((r) => r.data as unknown as ProcurementRequest),
    enabled: Number.isFinite(reqId),
  });
  const quotesQuery = useQuery({
    queryKey: ["rfq-quotes", reqId],
    queryFn: () => quotesApi.list(reqId).then((r) => r.data.data),
    enabled: Number.isFinite(reqId),
  });
  const categoriesQuery = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
    enabled: manager,
  });

  const req = requestQuery.data ?? null;
  const quotes = (quotesQuery.data ?? []) as ProcurementQuote[];
  const categories = categoriesQuery.data ?? [];
  const currency = req?.currency ?? DEFAULT_CURRENCY;

  useEffect(() => {
    if (!req) return;
    setRfqDeadline(req.rfq_deadline ? req.rfq_deadline.split("T")[0] : "");
    setRfqNotes(req.rfq_notes ?? "");
    setCategoryIds((req.supplierCategories ?? []).map((item) => item.id));
    setQuoteForm(emptyQuoteForm(req.currency ?? DEFAULT_CURRENCY));
  }, [req]);

  const eligibleQuotes = useMemo(
    () => quotes.filter((quote) => quote.assessed_at && quote.compliance_passed === true),
    [quotes]
  );
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)),
    [quotes]
  );

  const issueMutation = useMutation({
    mutationFn: () =>
      procurementApi.issueRfq(reqId, {
        rfq_deadline: rfqDeadline || undefined,
        rfq_notes: rfqNotes || undefined,
        category_ids: categoryIds,
        external_invites: externalInvites.filter((invite) => invite.email.trim()).map((invite) => ({
          name: invite.name.trim() || undefined,
          email: invite.email.trim(),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowIssue(false);
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to issue RFQ."),
  });

  const saveQuoteMutation = useMutation({
    mutationFn: () => {
      const payload: CreateQuotePayload = {
        vendor_name: quoteForm.vendor_name.trim(),
        quoted_amount: Number(quoteForm.quoted_amount),
        currency: quoteForm.currency || currency,
        quote_date: quoteForm.quote_date || undefined,
        notes: quoteForm.notes.trim() || undefined,
        compliance_passed: quoteForm.compliance_passed === "pending" ? null : quoteForm.compliance_passed === "pass",
        compliance_notes: quoteForm.compliance_notes.trim() || undefined,
        is_recommended: quoteForm.is_recommended,
      };
      return editingQuote ? quotesApi.update(reqId, editingQuote.id, payload) : quotesApi.create(reqId, payload);
    },
    onSuccess: () => {
      quotesQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowQuoteModal(false);
      setEditingQuote(null);
      setQuoteForm(emptyQuoteForm(currency));
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save quote."),
  });

  const awardMutation = useMutation({
    mutationFn: () => procurementApi.award(reqId, Number(awardQuoteId), awardNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowAward(false);
      setAwardQuoteId("");
      setAwardNotes("");
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to award quote."),
  });

  if (requestQuery.isLoading) return <div className="max-w-4xl mx-auto card p-6">Loading RFQ...</div>;
  if (requestQuery.isError || !req) return <div className="max-w-4xl mx-auto card p-6">RFQ not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/rfq" className="hover:text-primary">RFQs</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{req.reference_number}</span>
      </nav>

      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{req.title}</h1>
            <p className="font-mono text-xs text-neutral-400">{req.reference_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">{req.status}</span>
            {manager && req.status !== "awarded" && eligibleQuotes.length > 0 && (
              <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowAward(true)}>Award Contract</button>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4 text-sm">
          <div><p className="text-xs text-neutral-400">Category</p><p>{req.category}</p></div>
          <div><p className="text-xs text-neutral-400">Method</p><p>{req.procurement_method ?? "quotation"}</p></div>
          <div><p className="text-xs text-neutral-400">Estimated</p><p>{currency} {(req.estimated_value ?? 0).toLocaleString()}</p></div>
          <div><p className="text-xs text-neutral-400">Required By</p><p>{req.required_by_date ? formatDateShort(req.required_by_date) : "-"}</p></div>
        </div>
        {req.description && <p className="text-sm text-neutral-600">{req.description}</p>}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">RFQ Initiation</h2>
            <p className="text-xs text-neutral-400">
              {req.rfq_issued_at ? `Issued ${formatDateShort(req.rfq_issued_at)}` : "Target approved suppliers by category and email invitees."}
            </p>
          </div>
          {manager && req.status !== "awarded" && (
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setShowIssue((v) => !v)}>
              {req.rfq_issued_at ? "Update RFQ" : "Issue RFQ"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(req.supplierCategories ?? []).map((category) => (
            <span key={category.id} className="badge badge-primary">{category.name}</span>
          ))}
          {(req.supplierCategories ?? []).length === 0 && <span className="text-xs text-neutral-400">No supplier categories selected.</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">Portal suppliers</p>
            <p className="text-2xl font-bold">{(req.rfqInvitations ?? []).filter((i) => i.invitation_type === "system").length}</p>
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">Email invitees</p>
            <p className="text-2xl font-bold">{(req.rfqInvitations ?? []).filter((i) => i.invitation_type === "email").length}</p>
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">Deadline</p>
            <p className="text-sm font-semibold">{req.rfq_deadline ? formatDateShort(req.rfq_deadline) : "Not set"}</p>
          </div>
        </div>

        {showIssue && (
          <div className="space-y-4 border-t border-neutral-100 pt-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid gap-2 md:grid-cols-2">
              {categories.map((category) => (
                <label key={category.id} className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
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
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="form-input" value={rfqDeadline} onChange={(e) => setRfqDeadline(e.target.value)} />
              <textarea className="form-input h-[42px] resize-none" placeholder="RFQ notes" value={rfqNotes} onChange={(e) => setRfqNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              {externalInvites.map((invite, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                  <input className="form-input" placeholder="Supplier name" value={invite.name} onChange={(e) => setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                  <input className="form-input" placeholder="supplier@example.com" value={invite.email} onChange={(e) => setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} />
                  <button className="btn-secondary" onClick={() => setExternalInvites((current) => current.length === 1 ? [{ name: "", email: "" }] : current.filter((_, i) => i !== index))}>Remove</button>
                </div>
              ))}
              <button className="text-xs text-primary" onClick={() => setExternalInvites((current) => [...current, { name: "", email: "" }])}>Add email invite</button>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowIssue(false)}>Cancel</button>
              <button className="btn-primary disabled:opacity-60" disabled={issueMutation.isPending || categoryIds.length === 0} onClick={() => issueMutation.mutate()}>
                {issueMutation.isPending ? "Saving..." : req.rfq_issued_at ? "Update RFQ" : "Issue RFQ"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">Quote Assessment</h2>
            <p className="text-xs text-neutral-400">Only assessed, compliant quotes can be awarded.</p>
          </div>
          {manager && req.status !== "awarded" && <button className="btn-primary text-xs px-3 py-1.5" onClick={() => { setEditingQuote(null); setQuoteForm(emptyQuoteForm(currency)); setShowQuoteModal(true); }}>Record Quote</button>}
        </div>
        {sortedQuotes.length === 0 ? <p className="text-sm text-neutral-500">No quotes recorded yet.</p> : (
          <div className="space-y-3">
            {sortedQuotes.map((quote, index) => (
              <div key={quote.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="font-semibold text-neutral-900">{quote.vendor_name}</p>
                      {index === 0 && <span className="badge badge-success">Lowest</span>}
                      {quote.is_recommended && <span className="badge badge-primary">Recommended</span>}
                      {quote.compliance_passed === true && <span className="badge badge-success">Compliant</span>}
                      {quote.compliance_passed === false && <span className="badge badge-danger">Non-compliant</span>}
                    </div>
                    <p className="text-sm text-neutral-700">{quote.currency ?? currency} {(quote.quoted_amount ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-neutral-500">
                      {quote.quote_date ? `Quoted ${formatDateShort(quote.quote_date)}` : "No quote date"}
                      {quote.assessed_at ? ` | Assessed ${formatDateShort(quote.assessed_at)}` : ""}
                    </p>
                    {quote.notes && <p className="text-xs text-neutral-600">{quote.notes}</p>}
                    {quote.compliance_notes && <p className="text-xs text-neutral-600">{quote.compliance_notes}</p>}
                  </div>
                  {manager && req.status !== "awarded" && (
                    <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => {
                      setEditingQuote(quote);
                      setQuoteForm({
                        vendor_name: quote.vendor_name,
                        quoted_amount: String(quote.quoted_amount),
                        currency: quote.currency ?? currency,
                        quote_date: quote.quote_date ? quote.quote_date.split("T")[0] : "",
                        notes: quote.notes ?? "",
                        compliance_passed: quote.compliance_passed === true ? "pass" : quote.compliance_passed === false ? "fail" : "pending",
                        compliance_notes: quote.compliance_notes ?? "",
                        is_recommended: quote.is_recommended,
                      });
                      setShowQuoteModal(true);
                    }}>Assess</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/procurement/rfq" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to RFQs
      </Link>

      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowQuoteModal(false)}>
          <div className="card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">{editingQuote ? "Assess Quote" : "Record Quote"}</h2>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <input className="form-input" placeholder="Supplier name" value={quoteForm.vendor_name} onChange={(e) => setQuoteForm((current) => ({ ...current, vendor_name: e.target.value }))} />
            <div className="grid gap-3 md:grid-cols-3">
              <input type="number" className="form-input" placeholder="Amount" value={quoteForm.quoted_amount} onChange={(e) => setQuoteForm((current) => ({ ...current, quoted_amount: e.target.value }))} />
              <input className="form-input" placeholder="Currency" value={quoteForm.currency} onChange={(e) => setQuoteForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} />
              <input type="date" className="form-input" value={quoteForm.quote_date} onChange={(e) => setQuoteForm((current) => ({ ...current, quote_date: e.target.value }))} />
            </div>
            <textarea className="form-input h-20 resize-none" placeholder="Commercial notes" value={quoteForm.notes} onChange={(e) => setQuoteForm((current) => ({ ...current, notes: e.target.value }))} />
            <select className="form-input" value={quoteForm.compliance_passed} onChange={(e) => setQuoteForm((current) => ({ ...current, compliance_passed: e.target.value as Assessment }))}>
              <option value="pending">Pending assessment</option>
              <option value="pass">Compliant</option>
              <option value="fail">Non-compliant</option>
            </select>
            <textarea className="form-input h-24 resize-none" placeholder="Assessment notes" value={quoteForm.compliance_notes} onChange={(e) => setQuoteForm((current) => ({ ...current, compliance_notes: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={quoteForm.is_recommended} onChange={(e) => setQuoteForm((current) => ({ ...current, is_recommended: e.target.checked }))} />
              Recommend this quote for award
            </label>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setShowQuoteModal(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={saveQuoteMutation.isPending || !quoteForm.vendor_name.trim() || !quoteForm.quoted_amount} onClick={() => saveQuoteMutation.mutate()}>
                {saveQuoteMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAward(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">Award Contract</h2>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <select className="form-input" value={awardQuoteId} onChange={(e) => setAwardQuoteId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select compliant quote</option>
              {eligibleQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.vendor_name} - {quote.currency ?? currency} {(quote.quoted_amount ?? 0).toLocaleString()}</option>)}
            </select>
            <textarea className="form-input h-24 resize-none" placeholder="Award notes" value={awardNotes} onChange={(e) => setAwardNotes(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setShowAward(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={awardMutation.isPending || !awardQuoteId} onClick={() => awardMutation.mutate()}>
                {awardMutation.isPending ? "Awarding..." : "Confirm Award"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
