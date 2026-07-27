"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  budgetApi,
  type BudgetAvailability,
  type OrgBudgetLine,
} from "@/lib/api";

function unwrapLines(payload: unknown): OrgBudgetLine[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as OrgBudgetLine[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as OrgBudgetLine[];
  }
  return [];
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetControlPage() {
  const [lines, setLines] = useState<OrgBudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [availabilityById, setAvailabilityById] = useState<Record<number, BudgetAvailability>>({});

  useEffect(() => {
    setLoading(true);
    budgetApi
      .lines({ active_only: true, per_page: 200, ...(q.trim() ? { q: q.trim() } : {}) })
      .then(async (res) => {
        const list = unwrapLines(res.data);
        setLines(list);
        setError("");
        const checks = await Promise.all(
          list.slice(0, 40).map(async (line) => {
            try {
              const avail = await budgetApi.availability(line.id);
              return [line.id, avail.data.data] as const;
            } catch {
              return null;
            }
          }),
        );
        const map: Record<number, BudgetAvailability> = {};
        for (const row of checks) {
          if (row) map[row[0]] = row[1];
        }
        setAvailabilityById(map);
      })
      .catch(() => setError("Failed to load budget control data."))
      .finally(() => setLoading(false));
  }, [q]);

  const totals = useMemo(() => {
    const values = Object.values(availabilityById);
    return values.reduce(
      (acc, row) => {
        acc.approved += row.approved;
        acc.actual += row.actual;
        acc.commitments += row.commitments;
        acc.available += row.available;
        return acc;
      },
      { approved: 0, actual: 0, commitments: 0, available: 0 },
    );
  }, [availabilityById]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Budget Control</h1>
          <p className="page-subtitle">
            Authoritative available balances including commitments (approved − actual − committed)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/budget/cycles" className="btn-secondary text-sm">
            Annual cycles
          </Link>
          <Link href="/budget/changes" className="btn-secondary text-sm">
            Changes
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            Variance
          </Link>
          <Link href="/budget/reports" className="btn-secondary text-sm">
            Reports
          </Link>
          <Link href="/finance/budget" className="btn-secondary text-sm">
            Legacy portfolios
          </Link>
          <Link href="/procurement/budget" className="btn-primary text-sm">
            Procurement reserves
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Approved (sample)", value: totals.approved },
          { label: "Actual", value: totals.actual },
          { label: "Commitments", value: totals.commitments },
          { label: "Available", value: totals.available },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <div className="text-sm font-medium text-neutral-500 mb-1">{card.label}</div>
            <div className="text-xl font-bold text-neutral-900">NAD {money(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-800">Active budget lines</h2>
          <input
            className="form-input max-w-xs"
            placeholder="Search code or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">Code</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">Name</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">Category</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">Approved</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">Actual</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">Committed</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    <span className="material-symbols-outlined animate-spin text-primary">autorenew</span>
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center italic text-neutral-500">
                    No active budget lines. Seed DefaultBudgetSeeder or create lines under Finance portfolios.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const avail = availabilityById[line.id];
                  return (
                    <tr key={line.id} className="hover:bg-neutral-50/50">
                      <td className="font-mono text-sm">{line.code ?? `BL-${line.id}`}</td>
                      <td className="font-medium text-neutral-900">{line.name ?? line.category}</td>
                      <td className="capitalize text-neutral-600">{line.category}</td>
                      <td className="text-right">{avail ? money(avail.approved) : money(Number(line.amount_allocated ?? 0))}</td>
                      <td className="text-right">{avail ? money(avail.actual) : "—"}</td>
                      <td className="text-right">{avail ? money(avail.commitments) : "—"}</td>
                      <td className={`text-right font-semibold ${avail && avail.available < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {avail ? money(avail.available) : "…"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
