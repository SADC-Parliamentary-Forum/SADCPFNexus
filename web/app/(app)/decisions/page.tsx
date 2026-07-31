"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { decisionsApi, type MeetingDecision } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-muted" },
  adopted: { label: "Adopted", cls: "badge-success" },
  in_progress: { label: "In Progress", cls: "badge-primary" },
  implemented: { label: "Implemented", cls: "badge-success" },
  closed: { label: "Closed", cls: "badge-muted" },
  superseded: { label: "Superseded", cls: "badge-warning" },
};

const TYPE_LABEL: Record<string, string> = {
  resolution: "Resolution",
  management_decision: "Management decision",
};

const FILTERS = ["All", "Draft", "Adopted", "In Progress", "Implemented", "Closed"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined,
  Draft: "draft",
  Adopted: "adopted",
  "In Progress": "in_progress",
  Implemented: "implemented",
  Closed: "closed",
};

export default function DecisionsRegisterPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "list", statusFilter, q],
    queryFn: async () => {
      const params: Record<string, string | number> = { per_page: 100 };
      const s = filterMap[statusFilter];
      if (s) params.status = s;
      if (q.trim()) params.q = q.trim();
      const res = await decisionsApi.list(params);
      return (res.data as { data: MeetingDecision[] }).data ?? [];
    },
    staleTime: 20_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="Decision Register"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Decision Register" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/decisions/dashboard" className="btn-secondary">Dashboard</Link>
          <Link href="/decisions/create" className="btn-primary">New decision</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              statusFilter === f
                ? "bg-primary text-white border-primary"
                : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600"
            }`}
          >
            {f}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference or title…"
          className="ml-auto input max-w-xs"
        />
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading decisions…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load the decision register.</p>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No decisions yet. Create the first resolution or management decision.
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr key={d.id} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/decisions/${d.id}`} className="text-primary hover:underline">
                        {d.reference_number}
                      </Link>
                      {d.is_confidential && <span className="ml-2 text-[10px] uppercase text-amber-600">Confidential</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/decisions/${d.id}`} className="font-medium text-neutral-900 dark:text-neutral-100 hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{TYPE_LABEL[d.decision_type] ?? d.decision_type}</td>
                    <td className="px-4 py-3 text-neutral-600">{d.owner?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{d.due_date ? formatDateShort(d.due_date) : "—"}</td>
                    <td className="px-4 py-3"><span className={st.cls}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
