"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function SupplierRfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const requestId = Number(id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
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
      toast.success(t("supplier.rfq.toast.submitted"));
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("supplier.rfq.submitFailed"));
      setError(message);
      toast.error(t("supplier.rfq.toast.notSubmitted"), message);
    },
  });

  if (isLoading) return <div className="card p-6">{t("supplier.rfq.loading")}</div>;
  if (isError || !data) return <div className="card p-6">{t("supplier.rfq.notFound")}</div>;

  const request = data.request;
  const invitation = data.invitation;
  const alreadySubmitted = Boolean(invitation.quote);
  const isAwarded = request.status === "awarded";

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={request.title}
        subtitle={request.reference_number}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("nav.supplier"), href: "/supplier" },
              { label: t("supplier.dashboard.rfqs"), href: "/supplier/rfqs" },
              { label: request.reference_number },
            ]}
          />
        }
        actions={<span className="badge badge-primary">{invitation.status}</span>}
      />

      <div className="card p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div><p className="text-xs text-neutral-400">{t("supplier.rfqs.col.deadline")}</p><p>{request.rfq_deadline ? formatDateShort(request.rfq_deadline) : t("supplier.rfqs.open")}</p></div>
          <div><p className="text-xs text-neutral-400">{t("settings.hr.allowance.currency")}</p><p>{request.currency ?? DEFAULT_CURRENCY}</p></div>
          <div><p className="text-xs text-neutral-400">{t("assignments.handover.colStatus")}</p><p>{request.status}</p></div>
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
                <th>{t("assignments.create.description")}</th>
                <th>{t("supplier.rfq.col.qty")}</th>
                <th>{t("supplier.rfq.col.unit")}</th>
                <th className="text-right">{t("supplier.rfq.col.unitPrice")}</th>
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
          <h2 className="text-sm font-bold text-neutral-800">{alreadySubmitted ? t("supplier.rfq.submittedQuote") : t("supplier.rfq.submitQuote")}</h2>
          <p className="text-xs text-neutral-400">
            {isAwarded ? t("supplier.rfq.awarded") : t("supplier.rfq.visibleHint")}
          </p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          <input type="number" min="0" className="form-input" placeholder={t("supplier.rfq.amountPlaceholder")} aria-label={t("supplier.rfq.amountPlaceholder")} value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} disabled={isAwarded} />
          <input className="form-input" aria-label={t("settings.hr.allowance.currency")} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} disabled={isAwarded} />
          <input type="date" className="form-input" aria-label={t("supplier.rfq.quoteDate")} value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} disabled={isAwarded} />
        </div>
        <textarea className="form-input h-24 resize-none" placeholder={t("supplier.rfq.notesPlaceholder")} aria-label={t("supplier.rfq.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isAwarded} />
        <div className="flex gap-2">
          <Link href="/supplier/rfqs" className="btn-secondary">{t("common.back")}</Link>
          <button className="btn-primary disabled:opacity-60" disabled={submitMutation.isPending || isAwarded || !quotedAmount} onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? t("supplier.submitting") : alreadySubmitted ? t("supplier.rfq.updateQuote") : t("supplier.rfq.submitQuote")}
          </button>
        </div>
      </div>
    </div>
  );
}
