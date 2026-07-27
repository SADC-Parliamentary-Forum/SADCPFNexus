"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { budgetApi, type BudgetChangeRequest } from "@/lib/api";

function unwrap(payload: unknown): BudgetChangeRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as BudgetChangeRequest[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as BudgetChangeRequest[];
  }
  return [];
}

export default function BudgetChangesPage() {
  const query = useQuery({
    queryKey: ["budget", "changes"],
    queryFn: () => budgetApi.changes({ per_page: 100 }).then((r) => unwrap(r.data)),
  });

  const rows = query.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Budget Changes</h1>
          <p className="page-subtitle">Transfers, revisions, supplementary and contingency draws</p>
        </div>
        <div className="flex gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            Control
          </Link>
          <Link href="/budget/changes/create" className="btn-primary text-sm">
            New change
          </Link>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No change requests yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">SG?</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 capitalize">{r.status.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{r.requires_sg ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/budget/changes/${r.id}`} className="text-[var(--primary)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
