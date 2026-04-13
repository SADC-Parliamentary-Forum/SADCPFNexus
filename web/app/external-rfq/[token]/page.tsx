"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { externalRfqApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function ExternalRfqPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [vendorName, setVendorName] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [quoteDate, setQuoteDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["external-rfq", token],
    queryFn: () => externalRfqApi.preview(token).then((response) => response.data.data),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!data) return;
    setVendorName(data.invitation.invited_name ?? "");
    setCurrency(data.request.currency ?? DEFAULT_CURRENCY);
    if (data.invitation.quote) {
      setQuotedAmount(String(data.invitation.quote.quoted_amount ?? ""));
      setQuoteDate(data.invitation.quote.quote_date ? data.invitation.quote.quote_date.split("T")[0] : "");
      setNotes(data.invitation.quote.notes ?? "");
      setVendorName(data.invitation.quote.vendor_name);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      externalRfqApi.submitQuote(token, {
        vendor_name: vendorName,
        quoted_amount: Number(quotedAmount),
        currency,
        quote_date: quoteDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-rfq", token] });
      setError(null);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to submit quote."),
  });

  if (isLoading) return <div className="max-w-4xl mx-auto card p-6 mt-10">Loading invitation...</div>;
  if (isError || !data) return <div className="max-w-4xl mx-auto card p-6 mt-10">Invitation not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5 py-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{data.request.title}</h1>
        <p className="text-sm text-neutral-500">{data.request.reference_number}</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div><p className="text-xs text-neutral-400">Invited Supplier</p><p>{data.invitation.invited_name ?? data.invitation.invited_email}</p></div>
          <div><p className="text-xs text-neutral-400">Deadline</p><p>{data.request.rfq_deadline ? formatDateShort(data.request.rfq_deadline) : "Open"}</p></div>
          <div><p className="text-xs text-neutral-400">Status</p><p>{data.invitation.status}</p></div>
        </div>
        {data.request.description && <p className="text-sm text-neutral-600">{data.request.description}</p>}
        {data.request.rfq_notes && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {data.request.rfq_notes}
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-neutral-800">Submit Quote</h2>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {!data.can_submit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This invitation can no longer accept quotes.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <input className="form-input md:col-span-3" placeholder="Supplier name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} disabled={!data.can_submit} />
          <input type="number" className="form-input" placeholder="Quoted amount" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} disabled={!data.can_submit} />
          <input className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} disabled={!data.can_submit} />
          <input type="date" className="form-input" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} disabled={!data.can_submit} />
        </div>
        <textarea className="form-input h-24 resize-none" placeholder="Notes and conditions" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!data.can_submit} />
        <div className="flex gap-2">
          <Link href="/login" className="btn-secondary">Portal Login</Link>
          <button className="btn-primary disabled:opacity-60" disabled={mutation.isPending || !data.can_submit || !vendorName || !quotedAmount} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Submitting..." : "Submit Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
