"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetChangeRequest } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

export default function BudgetChangeDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);
  const isSg = isSystemAdmin(user) || Boolean(user?.roles?.includes("Secretary General"));
  const canApply =
    isSystemAdmin(user) ||
    hasPermission(user, ["finance.admin"]) ||
    Boolean(user?.roles?.includes("Finance Controller"));

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["budget", "changes", id],
    queryFn: () => budgetApi.getChange(id).then((r) => r.data.data as BudgetChangeRequest),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget", "changes", id] });

  const submitMut = useMutation({
    mutationFn: () => budgetApi.submitChange(id),
    onSuccess: () => {
      setMessage("Submitted to Finance.");
      invalidate();
    },
    onError: () => setError("Submit failed."),
  });
  const financeMut = useMutation({
    mutationFn: (decision: "approve" | "return" | "reject") =>
      budgetApi.financeDecideChange(id, { decision }),
    onSuccess: () => {
      setMessage("Finance decision recorded.");
      invalidate();
    },
    onError: () => setError("Finance decision failed."),
  });
  const sgMut = useMutation({
    mutationFn: (decision: "approve" | "return" | "reject") => budgetApi.sgDecideChange(id, { decision }),
    onSuccess: () => {
      setMessage("SG decision recorded.");
      invalidate();
    },
    onError: () => setError("SG decision failed."),
  });
  const applyMut = useMutation({
    mutationFn: () => budgetApi.applyChange(id),
    onSuccess: () => {
      setMessage("Applied to budget lines.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["budget", "lines"] });
    },
    onError: () => setError("Apply failed (check availability)."),
  });

  const row = query.data;

  if (query.isLoading) return <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>;
  if (!row) {
    return (
    <div className="space-y-5">
        <p className="text-sm text-red-700">Not found.</p>
        <Link href="/budget/changes">Back</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/budget/changes" className="text-sm text-[var(--primary)] hover:underline">
            ← Changes
          </Link>
          <h1 className="page-title mt-1">{row.title}</h1>
          <p className="page-subtitle capitalize">
            {row.type} · {row.status.replaceAll("_", " ")}
            {row.requires_sg ? " · requires SG" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["draft", "returned"].includes(row.status) && (
            <button type="button" className="btn-primary text-sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              Submit
            </button>
          )}
          {canFinance && row.status === "pending_finance" && (
            <>
              <button type="button" className="btn-primary text-sm" onClick={() => financeMut.mutate("approve")}>
                Finance approve
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => financeMut.mutate("return")}>
                Return
              </button>
            </>
          )}
          {(isSg || canFinance) && row.status === "pending_sg" && (
            <button type="button" className="btn-primary text-sm" onClick={() => sgMut.mutate("approve")}>
              SG approve
            </button>
          )}
          {canApply && row.status === "approved" && (
            <button type="button" className="btn-primary text-sm" onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              Apply
            </button>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {row.justification && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          <div className="mb-1 font-semibold">Justification</div>
          {row.justification}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">Items</div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">From</th>
              <th className="px-4 py-2 font-medium">To / new</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(row.items ?? []).map((item, idx) => (
              <tr key={item.id ?? idx} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2">{item.source_line?.code || item.source_budget_line_id || "—"}</td>
                <td className="px-4 py-2">
                  {item.target_line?.code ||
                    item.target_budget_line_id ||
                    item.new_line_name ||
                    item.new_line_code ||
                    "—"}
                  {item.is_decrease ? " (decrease)" : ""}
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
