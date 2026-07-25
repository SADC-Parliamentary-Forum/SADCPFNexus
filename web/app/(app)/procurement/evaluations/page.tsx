"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";

export default function EvaluationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "evaluations"],
    queryFn: () => tendersApi.evaluations().then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Evaluations</h1>
        <p className="page-subtitle">
          Technical-first / two-envelope scoring for opened tenders. COI still required before assess/award. Financials stay sealed until open.
        </p>
      </div>
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>}
      <div className="space-y-3">
        {(data ?? []).map((t) => (
          <Link key={t.id} href={`/procurement/tenders/${t.id}`} className="card p-4 block hover:bg-neutral-50 space-y-2">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t.reference_number} — {t.title}</p>
                <p className="text-xs text-neutral-500">
                  Opened: {t.bids_opened_at ?? "—"} · Weights {t.technical_weight ?? 80}/{t.financial_weight ?? 20} · Min tech {t.min_technical_score ?? 70}
                </p>
              </div>
              <span className="text-xs uppercase">{t.status}</span>
            </div>
            {(t.scoring?.length ?? 0) > 0 && (
              <div className="text-xs text-neutral-600 space-y-1">
                {(t.scoring ?? []).slice(0, 3).map((s) => (
                  <p key={s.quote_id}>
                    {s.vendor_name}: tech {s.technical_score ?? "—"}
                    {s.financials_sealed ? " · financial sealed" : ` · fin ${s.financial_score ?? "—"} · combined ${s.combined_score ?? "—"}`}
                  </p>
                ))}
              </div>
            )}
          </Link>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card p-8 text-center text-sm text-neutral-400">No tenders in evaluation.</div>
        )}
      </div>
    </div>
  );
}
