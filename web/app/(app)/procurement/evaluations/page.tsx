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
        <p className="page-subtitle">Tenders in opened / evaluating status. COI still required before assess/award.</p>
      </div>
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>}
      <div className="space-y-2">
        {(data ?? []).map((t) => (
          <Link key={t.id} href={`/procurement/tenders/${t.id}`} className="card p-4 flex justify-between hover:bg-neutral-50">
            <div>
              <p className="text-sm font-semibold">{t.reference_number} — {t.title}</p>
              <p className="text-xs text-neutral-500">Opened: {t.bids_opened_at ?? "—"}</p>
            </div>
            <span className="text-xs uppercase">{t.status}</span>
          </Link>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card p-8 text-center text-sm text-neutral-400">No tenders in evaluation.</div>
        )}
      </div>
    </div>
  );
}
