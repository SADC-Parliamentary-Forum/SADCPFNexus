"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetSubmissionPack } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetSubmissionDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);

  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["budget", "submissions", id],
    queryFn: () => budgetApi.getSubmission(id).then((r) => r.data.data as BudgetSubmissionPack),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget", "submissions", id] });
    if (query.data?.budget_cycle_id) {
      qc.invalidateQueries({ queryKey: ["budget", "cycles", query.data.budget_cycle_id] });
    }
  };

  const submitMut = useMutation({
    mutationFn: () => budgetApi.submitSubmission(id),
    onSuccess: () => {
      setMessage("Submitted to Finance / HOD.");
      setError("");
      invalidate();
    },
    onError: () => setError("Submit failed."),
  });

  const acceptMut = useMutation({
    mutationFn: () => budgetApi.acceptSubmission(id),
    onSuccess: () => {
      setMessage("Pack accepted.");
      invalidate();
    },
    onError: () => setError("Accept failed."),
  });

  const returnMut = useMutation({
    mutationFn: () => budgetApi.returnSubmission(id, { reason: reason.trim() }),
    onSuccess: () => {
      setMessage("Returned to preparer.");
      setReason("");
      invalidate();
    },
    onError: () => setError("Return failed."),
  });

  const pack = query.data;

  if (query.isLoading) {
    return <p className="p-6 text-sm text-[var(--muted)]">Loading submission…</p>;
  }

  if (!pack) {
    return (
    <div className="space-y-5">
        <p className="text-sm text-red-700">Submission not found.</p>
        <Link href="/budget/cycles" className="text-sm text-[var(--primary)]">
          Back to cycles
        </Link>
      </div>
    );
  }

  const total = (pack.items ?? []).reduce((sum, i) => sum + Number(i.requested_amount || 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/budget/cycles/${pack.budget_cycle_id}`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            ← Cycle
          </Link>
          <h1 className="page-title mt-1">{pack.title}</h1>
          <p className="page-subtitle capitalize">
            {pack.type} · {pack.status.replaceAll("_", " ")}
            {pack.preparer?.name ? ` · Prepared by ${pack.preparer.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["draft", "returned"].includes(pack.status) && (
            <button type="button" className="btn-primary text-sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              Submit
            </button>
          )}
          {canFinance && pack.status === "submitted" && (
            <button type="button" className="btn-primary text-sm" onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
              Accept
            </button>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {pack.returned_reason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Returned: {pack.returned_reason}
        </div>
      )}
      {pack.motivation && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          <div className="mb-1 font-semibold">Motivation</div>
          {pack.motivation}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-semibold">Line items</span>
          <span className="text-sm text-[var(--muted)]">Total {money(total)}</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium text-right">Requested</th>
            </tr>
          </thead>
          <tbody>
            {(pack.items ?? []).map((item, idx) => (
              <tr key={item.id ?? idx} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2">{item.code || "—"}</td>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-right">{money(Number(item.requested_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canFinance && ["submitted", "accepted", "pending_hod"].includes(pack.status) && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold">Return to preparer</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!reason.trim() || returnMut.isPending}
            onClick={() => returnMut.mutate()}
          >
            Return
          </button>
        </div>
      )}
    </div>
  );
}
