"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenderId = Number(id);
  const qc = useQueryClient();

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
      qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["procurement", "evaluations"] });
    },
  });

  const summaryMut = useMutation({
    mutationFn: () => tendersApi.comparisonSummary(tenderId).then((r) => r.data.data),
  });

  if (isLoading || !tender) {
    return <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>;
  }

  const techW = tender.technical_weight ?? 80;
  const finW = tender.financial_weight ?? 20;
  const minTech = tender.min_technical_score ?? 70;
  const sealed = tender.sealed_mode && !tender.bids_opened_at;

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/procurement/tenders" className="text-sm text-neutral-500 hover:text-neutral-800">← Tenders</Link>
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
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("publish")}>Publish</button>
          )}
          {tender.status === "published" && (
            <button type="button" className="btn-secondary text-sm" onClick={() => act.mutate("close")}>Close submissions</button>
          )}
          {tender.status === "closed" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("openBids")}>Open bids</button>
          )}
          {tender.status === "opened" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("startEvaluation")}>Start evaluation</button>
          )}
        </div>
      </div>

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
                      {row.financials_sealed ? <span className="italic text-neutral-400">Sealed</span> : (row.financial_score ?? "—")}
                    </td>
                    <td className="py-2 pr-3">{row.combined_score ?? "—"}</td>
                    <td className="py-2">
                      {row.meets_min_tech == null ? "—" : row.meets_min_tech ? "Pass" : "Below"}
                    </td>
                  </tr>
                ))}
                {scoring.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-neutral-400 text-xs">No scored bids yet.</td>
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
