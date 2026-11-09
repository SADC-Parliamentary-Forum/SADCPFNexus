"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { tendersApi } from "@/lib/api";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const TENDER_ACTION_DONE: Record<"publish" | "close" | "openBids" | "startEvaluation", string> = {
  publish: "procurement.tender.done.publish",
  close: "procurement.tender.done.close",
  openBids: "procurement.tender.done.openBids",
  startEvaluation: "procurement.tender.done.startEvaluation",
};

const TENDER_STATUS_KEYS: Record<string, string> = {
  draft: "status.draft",
  published: "procurement.status.published",
  closed: "procurement.status.closed",
  opened: "procurement.status.opened",
  evaluating: "procurement.status.evaluating",
  awarded: "procurement.status.awarded",
  cancelled: "status.cancelled",
};

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenderId = Number(id);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [awardQuoteId, setAwardQuoteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: tender, isLoading } = useQuery({
    queryKey: ["procurement", "tender", tenderId],
    queryFn: () => tendersApi.get(tenderId).then((r) => r.data.data),
    enabled: !!tenderId,
  });

  const evaluationsQuery = useQuery({
    queryKey: ["procurement", "evaluations"],
    queryFn: () => tendersApi.evaluations().then((r) => r.data.data),
    enabled: !!tender && ["opened", "evaluating"].includes(tender.status),
  });

  const scoring = (evaluationsQuery.data ?? []).find((row) => row.id === tenderId)?.scoring ?? [];

  const act = useMutation({
    mutationFn: (action: "publish" | "close" | "openBids" | "startEvaluation") => {
      if (action === "publish") return tendersApi.publish(tenderId);
      if (action === "close") return tendersApi.close(tenderId);
      if (action === "openBids") return tendersApi.openBids(tenderId);
      return tendersApi.startEvaluation(tenderId);
    },
    onSuccess: (_res, action) => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "evaluations"] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
      toast.success(t(TENDER_ACTION_DONE[action]));
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("procurement.actionFailed"));
      setError(message);
      toast.error(t("procurement.tender.actionFailedTitle"), message);
    },
  });

  const awardMut = useMutation({
    mutationFn: () =>
      tendersApi.award(tenderId, {
        quote_id: Number(awardQuoteId),
        start_date: startDate,
        end_date: endDate,
      }),
    onSuccess: (res) => {
      setMessage(t("procurement.tender.awardedMessage"));
      setError(null);
      toast.success(t("procurement.tender.awarded"), t("procurement.tender.draftContractCreated"));
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
      const contractId = (res.data.data as { contract?: { id?: number } }).contract?.id;
      if (contractId) {
        router.push(`/procurement/contracts/${contractId}`);
      }
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("procurement.tender.awardFailed"));
      setError(message);
      toast.error(t("procurement.tender.notAwarded"), message);
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => tendersApi.cancel(tenderId, cancelReason || "Cancelled by officer"),
    onSuccess: () => {
      setMessage(t("procurement.tender.cancelledMessage"));
      setError(null);
      toast.success(t("procurement.tender.cancelled"));
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("procurement.tender.cancelFailed"));
      setError(message);
      toast.error(t("procurement.tender.notCancelled"), message);
    },
  });

  const summaryMut = useMutation({
    mutationFn: () => tendersApi.comparisonSummary(tenderId).then((r) => r.data.data),
  });

  const confirmSummaryMut = useMutation({
    mutationFn: () =>
      tendersApi
        .confirmComparisonSummary(tenderId, {
          confirm: true,
          summary_fingerprint: String(summaryMut.data?.summary ?? "").slice(0, 64),
        })
        .then((r) => r.data.data),
    onSuccess: () => toast.success(t("procurement.tender.reviewConfirmedToast")),
    onError: (e: unknown) => {
      toast.error(t("procurement.tender.reviewNotConfirmed"), apiErrorMessage(e, t("procurement.tender.confirmFailed")));
    },
  });

  if (isLoading || !tender) {
    return <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>;
  }

  const techW = tender.technical_weight ?? 80;
  const finW = tender.financial_weight ?? 20;
  const minTech = tender.min_technical_score ?? 70;
  const sealed = tender.sealed_mode && !tender.bids_opened_at;
  const quotes =
    (tender as { procurement_request?: { quotes?: Array<{ id: number; vendor_name: string; quoted_amount?: number }> } })
      .procurement_request?.quotes ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ProcurementPageHeader
        title={tender.reference_number}
        subtitle={tender.title}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.tenders.title"), href: "/procurement/tenders" },
          { label: tender.reference_number },
        ]}
      />
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{tender.reference_number}</p>
            <p className="text-sm text-neutral-600">{tender.title}</p>
          </div>
          <span className="text-xs uppercase text-neutral-600">{TENDER_STATUS_KEYS[tender.status] ? t(TENDER_STATUS_KEYS[tender.status]) : tender.status}</span>
        </div>
        {tender.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{tender.notice}</p>}
        <p className="text-xs text-neutral-500">
          {t(sealed ? "procurement.tender.weightsSealed" : "procurement.tender.weights", { tech: techW, fin: finW, min: minTech })}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {tender.status === "draft" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("publish")}>
              {t("procurement.tender.publish")}
            </button>
          )}
          {tender.status === "published" && (
            <button type="button" className="btn-secondary text-sm" onClick={() => act.mutate("close")}>
              {t("procurement.tender.closeSubmissions")}
            </button>
          )}
          {tender.status === "closed" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("openBids")}>
              {t("procurement.tender.openBids")}
            </button>
          )}
          {tender.status === "opened" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("startEvaluation")}>
              {t("procurement.tender.startEvaluation")}
            </button>
          )}
        </div>
      </div>

      {tender.status === "evaluating" && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("procurement.tender.awardTitle")}</h2>
          <p className="text-xs text-neutral-500">
            {t("procurement.tender.awardHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="procurement-tenders-detail-winning-quote" className="mb-1 block text-xs font-semibold">{t("procurement.tender.winningQuote")}</label>
              <select id="procurement-tenders-detail-winning-quote"
                className="form-input"
                value={awardQuoteId}
                onChange={(e) => setAwardQuoteId(e.target.value)}
              >
                <option value="">{t("procurement.select")}</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.vendor_name}
                    {q.quoted_amount != null ? ` — ${q.quoted_amount}` : ""}
                  </option>
                ))}
                {scoring.map((row) => (
                  <option key={`score-${row.quote_id}`} value={row.quote_id}>
                    {row.vendor_name}
                    {row.quoted_amount != null ? ` — ${row.quoted_amount}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div />
            <div>
              <label htmlFor="procurement-tenders-detail-contract-start" className="mb-1 block text-xs font-semibold">{t("procurement.tender.contractStart")}</label>
              <input id="procurement-tenders-detail-contract-start" type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="procurement-tenders-detail-contract-end" className="mb-1 block text-xs font-semibold">{t("procurement.tender.contractEnd")}</label>
              <input id="procurement-tenders-detail-contract-end" type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!awardQuoteId || !startDate || !endDate || awardMut.isPending}
            onClick={() => awardMut.mutate()}
          >
            {awardMut.isPending ? t("procurement.tender.awarding") : t("procurement.tender.awardSubmit")}
          </button>
        </div>
      )}

      {!["awarded", "cancelled"].includes(tender.status) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("procurement.tender.cancelTender")}</h2>
          <input
            className="form-input"
            placeholder={t("procurement.tender.cancelReason")}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm text-red-700"
            disabled={!cancelReason.trim() || cancelMut.isPending}
            onClick={() => cancelMut.mutate()}
          >
            {t("procurement.tender.cancelTender")}
          </button>
        </div>
      )}

      {["opened", "evaluating"].includes(tender.status) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{t("procurement.tender.scoringTitle")}</h2>
              <p className="text-xs text-neutral-500">
                {t("procurement.tender.scoringHint")}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={summaryMut.isPending}
              onClick={() => summaryMut.mutate()}
            >
              {summaryMut.isPending ? t("procurement.tender.generating") : t("procurement.tender.aiComparison")}
            </button>
          </div>

          {summaryMut.isError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              {t("procurement.tender.comparisonUnavailable")}
            </div>
          )}
          {summaryMut.data && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 space-y-2">
              <p className="text-xs font-semibold text-neutral-800">{t("procurement.tender.assistiveSummary")}</p>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{String(summaryMut.data.summary ?? "")}</p>
              <p className="text-[11px] text-neutral-500">{String(summaryMut.data.disclaimer ?? "")}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={confirmSummaryMut.isPending || confirmSummaryMut.isSuccess}
                  onClick={() => confirmSummaryMut.mutate()}
                >
                  {confirmSummaryMut.isSuccess
                    ? t("procurement.tender.reviewConfirmed")
                    : confirmSummaryMut.isPending
                      ? t("procurement.tender.confirming")
                      : t("procurement.tender.confirmReview")}
                </button>
                <span className="text-[11px] text-neutral-500">
                  {t("procurement.tender.confirmNote")}
                </span>
              </div>
              {confirmSummaryMut.isError && (
                <p className="text-[11px] text-amber-800">
                  {t("procurement.tender.confirmFailed")}
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-3">{t("procurement.col.vendor")}</th>
                  <th className="py-2 pr-3">{t("procurement.tender.technical")}</th>
                  <th className="py-2 pr-3">{t("procurement.tender.financial")}</th>
                  <th className="py-2 pr-3">{t("procurement.tender.combined")}</th>
                  <th className="py-2">{t("procurement.tender.minTech")}</th>
                </tr>
              </thead>
              <tbody>
                {scoring.map((row) => (
                  <tr key={row.quote_id} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">{row.vendor_name}</td>
                    <td className="py-2 pr-3">{row.technical_score ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {row.financials_sealed ? (
                        <span className="italic text-neutral-400">{t("procurement.bidSubmissions.sealed")}</span>
                      ) : (
                        (row.financial_score ?? "—")
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.combined_score ?? "—"}</td>
                    <td className="py-2">
                      {row.meets_min_tech == null ? "—" : row.meets_min_tech ? t("procurement.tender.pass") : t("procurement.tender.below")}
                    </td>
                  </tr>
                ))}
                {scoring.length === 0 && (
                  <TableEmpty colSpan={5} title={t("procurement.tender.noScores")} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
