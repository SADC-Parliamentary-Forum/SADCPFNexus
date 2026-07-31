"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { noticeBoardApi } from "@/lib/api";

export default function StaffNoticeBoardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "notice-board"],
    queryFn: () => noticeBoardApi.staff().then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title="Tender Notice Board"
        subtitle="Published tender/RFQ advertisements for this organisation. Competitor bid data is never shown here."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Tender Notice Board" }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Failed to load notices.</div>
      )}
      {isLoading && <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>}

      <div className="space-y-3">
        {(data ?? []).map((n) => (
          <article key={n.reference_number} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
                <p className="text-xs font-mono text-neutral-500">{n.reference_number}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">{n.status}</span>
            </div>
            {n.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.notice}</p>}
            <p className="text-xs text-neutral-500">
              Deadline: {n.submission_deadline ?? "—"} · Sealed: {n.sealed_mode ? "Yes" : "No"}
            </p>
          </article>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="card p-8 text-center text-sm text-neutral-400">No published notices.</div>
        )}
      </div>
    </div>
  );
}
