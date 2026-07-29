"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { tendersApi } from "@/lib/api";

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenderId = Number(id);
  const qc = useQueryClient();
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

  const scoring = (evaluationsQuery.data ?? []).find((t) => t.id === tenderId)?.scoring ?? [];

  const act = useMutation({
    mutationFn: (action: "publish" | "close" | "openBids" | "startEvaluation") => {
      if (action === "publish") return tendersApi.publish(tenderId);
      if (action === "close") return tendersApi.close(tenderId);
      if (action === "openBids") return tendersApi.openBids(tenderId);
      return tendersApi.startEvaluation(tenderId);
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "evaluations"] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Action failed.",
      );
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
      setMessage("Tender awarded — draft contract created.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
      const contractId = (res.data.data as { contract?: { id?: number } }).contract?.id;
      if (contractId) {
        window.location.href = `/procurement/contracts/${contractId}`;
      }
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Award failed.",
      );
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => tendersApi.cancel(tenderId, cancelReason || "Cancelled by officer"),
    onSuccess: () => {
      setMessage("Tender cancelled.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Cancel failed.",
      );
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
  });

  if (isLoading || !tender) {
    return <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>;
  }

  const techW = tender.technical_weight ?? 80;
  const finW = tender.financial_weight ?? 20;
  const minTech = tender.min_technical_score ?? 70;
  const sealed = tender.sealed_mode && !tender.bids_opened_at;
  const quotes =
    (tender as { procurement_request?: { quotes?: Array<{ id: number; vendor_name: string; quoted_amount?: number }> } })
      .procurement_request?.quotes ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/procurement/tenders" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Tenders
      </Link>
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
            <h1 className="text-lg font-semibold text-neutral-900">{tender.reference_number}</h1>
            <p className="text-sm text-neutral-600">{tender.title}</p>
          </div>
          <span className="text-xs uppercase text-neutral-600">{tender.status}</span>
        </div>
        {tender.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{tender.notice}</p>}
        <p className="text-xs text-neutral-500">
          Two-envelope weights: technical {techW}% / financial {finW}% · Min technical {minTech}
          {sealed ? " · Financial envelope sealed" : ""}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {tender.status === "draft" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("publish")}>
              Publish
            </button>
          )}
          {tender.status === "published" && (
            <button type="button" className="btn-secondary text-sm" onClick={() => act.mutate("close")}>
              Close submissions
            </button>
          )}
          {tender.status === "closed" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("openBids")}>
              Open bids
            </button>
          )}
          {tender.status === "opened" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("startEvaluation")}>
              Start evaluation
            </button>
          )}
        </div>
      </div>

      {tender.status === "evaluating" && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Award & create contract</h2>
          <p className="text-xs text-neutral-500">
            Award creates a draft contract from the selected quote value (no invented rates). Budget line is
            copied from the procurement request when present.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Winning quote</label>
              <select
                className="form-input"
                value={awardQuoteId}
                onChange={(e) => setAwardQuoteId(e.target.value)}
              >
                <option value="">Select…</option>
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
              <label className="mb-1 block text-xs font-semibold">Contract start</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Contract end</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!awardQuoteId || !startDate || !endDate || awardMut.isPending}
            onClick={() => awardMut.mutate()}
          >
            {awardMut.isPending ? "Awarding…" : "Award & create draft contract"}
          </button>
        </div>
      )}

      {!["awarded", "cancelled"].includes(tender.status) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Cancel tender</h2>
          <input
            className="form-input"
            placeholder="Cancellation reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm text-red-700"
            disabled={!cancelReason.trim() || cancelMut.isPending}
            onClick={() => cancelMut.mutate()}
          >
            Cancel tender
          </button>
        </div>
      )}

      {["opened", "evaluating"].includes(tender.status) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Technical-first scoring</h2>
              <p className="text-xs text-neutral-500">
                Record technical scores first. Financial scores appear only after bids are opened.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={summaryMut.isPending}
              onClick={() => summaryMut.mutate()}
            >
              {summaryMut.isPending ? "Generating…" : "AI comparison (assistive)"}
            </button>
          </div>

          {summaryMut.isError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              Comparison unavailable. Enable AI comparison in Procurement Settings, or open bids first.
            </div>
          )}
          {summaryMut.data && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 space-y-2">
              <p className="text-xs font-semibold text-neutral-800">Assistive summary (not an award)</p>
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
                    ? "Review confirmed"
                    : confirmSummaryMut.isPending
                      ? "Confirming…"
                      : "Confirm human review"}
                </button>
                <span className="text-[11px] text-neutral-500">
                  Confirmation is audit-only and never awards a supplier.
                </span>
              </div>
              {confirmSummaryMut.isError && (
                <p className="text-[11px] text-amber-800">
                  Confirm failed. Enable AI comparison and ensure bids are opened.
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Technical</th>
                  <th className="py-2 pr-3">Financial</th>
                  <th className="py-2 pr-3">Combined</th>
                  <th className="py-2">Min tech</th>
                </tr>
              </thead>
              <tbody>
                {scoring.map((row) => (
                  <tr key={row.quote_id} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">{row.vendor_name}</td>
                    <td className="py-2 pr-3">{row.technical_score ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {row.financials_sealed ? (
                        <span className="italic text-neutral-400">Sealed</span>
                      ) : (
                        (row.financial_score ?? "—")
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.combined_score ?? "—"}</td>
                    <td className="py-2">
                      {row.meets_min_tech == null ? "—" : row.meets_min_tech ? "Pass" : "Below"}
                    </td>
                  </tr>
                ))}
                {scoring.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-neutral-400 text-xs">
                      No scored bids yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
