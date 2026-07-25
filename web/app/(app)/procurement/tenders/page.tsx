"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";

export default function TendersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "tenders"],
    queryFn: () => tendersApi.list().then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Tenders</h1>
        <p className="page-subtitle">Open tender notices, sealed submissions, and evaluation lifecycle.</p>
      </div>
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>}
      {isError && <div className="card p-4 text-sm text-red-700">Failed to load tenders.</div>}
      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-sm text-neutral-400">No tenders yet. Create from an approved tender-method request via API or next intake flow.</div>
      )}
      <div className="space-y-2">
        {(data ?? []).map((t) => (
          <Link key={t.id} href={`/procurement/tenders/${t.id}`} className="card p-4 flex items-center justify-between hover:bg-neutral-50">
            <div>
              <p className="text-sm font-semibold text-neutral-900">{t.reference_number} — {t.title}</p>
              <p className="text-xs text-neutral-500">Deadline: {t.submission_deadline ?? "—"} · Sealed: {t.sealed_mode ? "Yes" : "No"}</p>
            </div>
            <span className="text-xs uppercase tracking-wide text-neutral-600">{t.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
