"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function SupplierRfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const requestId = Number(id);
  const queryClient = useQueryClient();
  const [quotedAmount, setQuotedAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [quoteDate, setQuoteDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-rfq", requestId],
    queryFn: () => supplierPortalApi.rfq(requestId).then((response) => response.data.data),
    enabled: Number.isFinite(requestId),
  });

  useEffect(() => {
    if (!data) return;
    setCurrency(data.request.currency ?? DEFAULT_CURRENCY);
    if (data.invitation.quote) {
      setQuotedAmount(String(data.invitation.quote.quoted_amount ?? ""));
      setQuoteDate(data.invitation.quote.quote_date ? data.invitation.quote.quote_date.split("T")[0] : "");
      setNotes(data.invitation.quote.notes ?? "");
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: () =>
      supplierPortalApi.submitQuote(requestId, {
        quoted_amount: Number(quotedAmount),
        currency,
        quote_date: quoteDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-rfq", requestId] });
      queryClient.invalidateQueries({ queryKey: ["supplier-rfqs"] });
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to submit quote."),
  });

  if (isLoading) return <div className="card p-6">Loading RFQ...</div>;
  if (isError || !data) return <div className="card p-6">RFQ not found.</div>;

  const request = data.request;
  const invitation = data.invitation;
  const alreadySubmitted = Boolean(invitation.quote);
  const isAwarded = request.status === "awarded";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{request.title}</h1>
          <p className="page-subtitle">{request.reference_number}</p>
        </div>
        <span className="badge badge-primary">{invitation.status}</span>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div><p className="text-xs text-neutral-400">Deadline</p><p>{request.rfq_deadline ? formatDateShort(request.rfq_deadline) : "Open"}</p></div>
          <div><p className="text-xs text-neutral-400">Currency</p><p>{request.currency ?? DEFAULT_CURRENCY}</p></div>
          <div><p className="text-xs text-neutral-400">Status</p><p>{request.status}</p></div>
        </div>
        {request.description && <p className="text-sm text-neutral-600">{request.description}</p>}
        {(request.supplierCategories ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(request.supplierCategories ?? []).map((category) => (
              <span key={category.id} className="badge badge-primary">{category.name}</span>
            ))}
          </div>
        )}
        {request.rfq_notes && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {request.rfq_notes}
          </div>
        )}
      </div>

      {(request.items ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th className="text-right">Estimated Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {(request.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="text-right">{request.currency} {(item.estimated_unit_price ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-800">{alreadySubmitted ? "Submitted Quote" : "Submit Quote"}</h2>
          <p className="text-xs text-neutral-400">
            {isAwarded ? "This RFQ has already been awarded." : "Your quote will be visible to procurement after submission."}
          </p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          <input type="number" className="form-input" placeholder="Quoted amount" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} disabled={isAwarded} />
          <input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} disabled={isAwarded} />
          <input type="date" className="form-input" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} disabled={isAwarded} />
        </div>
        <textarea className="form-input h-24 resize-none" placeholder="Lead time, conditions, notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isAwarded} />
        <div className="flex gap-2">
          <Link href="/supplier/rfqs" className="btn-secondary">Back</Link>
          <button className="btn-primary disabled:opacity-60" disabled={submitMutation.isPending || isAwarded || !quotedAmount} onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? "Submitting..." : alreadySubmitted ? "Update Quote" : "Submit Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
