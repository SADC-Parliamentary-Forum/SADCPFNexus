"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetCycle } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function BudgetCyclesPage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);

  const [fyId, setFyId] = useState("");
  const [error, setError] = useState("");

  const cyclesQuery = useQuery({
    queryKey: ["budget", "cycles"],
    queryFn: () => budgetApi.cycles().then((r) => r.data.data as BudgetCycle[]),
  });

  const yearsQuery = useQuery({
    queryKey: ["budget", "financial-years"],
    queryFn: () => budgetApi.financialYears().then((r) => r.data.data as Array<{ id: number; code: string; label: string }>),
    enabled: canFinance,
  });

  const createMut = useMutation({
    mutationFn: () => budgetApi.createCycle({ financial_year_id: Number(fyId) }),
    onSuccess: () => {
      setFyId("");
      setError("");
      qc.invalidateQueries({ queryKey: ["budget", "cycles"] });
    },
    onError: () => setError("Could not open cycle. Check FY is unique and you have Finance rights."),
  });

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const cycles = cyclesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="Budget Cycles"
        subtitle="Annual planning through SG approval and lock into Budget Control lines"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Budget Cycles" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            Control
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            Variance
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {canFinance && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Open a cycle</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Financial year</span>
              <select
                className="min-w-[220px] rounded-lg border border-[var(--border)] px-3 py-2"
                value={fyId}
                onChange={(e) => setFyId(e.target.value)}
              >
                <option value="">Select FY…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label || y.code}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!fyId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Open cycle
            </button>
          </div>
        </div>
      )}

      {cyclesQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading cycles…</p>
      ) : cycles.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No budget cycles yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Financial year</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approved total</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{c.financial_year?.label || c.financial_year?.code || `#${c.financial_year_id}`}</td>
                  <td className="px-4 py-3 capitalize">{statusLabel(c.status)}</td>
                  <td className="px-4 py-3">
                    {c.approved_total != null
                      ? Number(c.approved_total).toLocaleString(undefined, { minimumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/budget/cycles/${c.id}`} className="text-[var(--primary)] hover:underline">
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
