"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function EvaluationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "evaluations"],
    queryFn: () => tendersApi.evaluations().then((r) => r.data.data),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Evaluations"
        subtitle="Technical-first / two-envelope scoring for opened tenders. COI still required before assess/award. Financials stay sealed until open."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Procurement", href: "/procurement" },
              { label: "Evaluations" },
            ]}
          />
        }
        actions={
          <Link href="/my-work/procurement-evaluations" className="btn-secondary text-sm">
            My assigned evaluations
          </Link>
        }
      />

      {isError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">Failed to load evaluations.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState icon="gavel" title="No tenders in evaluation" description="Opened tenders ready for scoring will appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((t) => (
            <Link key={t.id} href={`/procurement/tenders/${t.id}`} className="card block space-y-2 p-4 hover:bg-neutral-50">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{t.reference_number} — {t.title}</p>
                  <p className="text-xs text-neutral-500">
                    Opened: {t.bids_opened_at ?? "—"} · Weights {t.technical_weight ?? 80}/{t.financial_weight ?? 20} · Min tech {t.min_technical_score ?? 70}
                  </p>
                </div>
                <span className="badge badge-muted text-xs uppercase">{t.status}</span>
              </div>
              {(t.scoring?.length ?? 0) > 0 && (
                <div className="space-y-1 text-xs text-neutral-600">
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
        </div>
      )}
    </div>
  );
}
