"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetCycle, type BudgetSubmissionPack } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function BudgetCycleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);
  const isSg =
    isSystemAdmin(user) || Boolean(user?.roles?.includes("Secretary General"));

  const [assumptions, setAssumptions] = useState("");
  const [inflation, setInflation] = useState("5");
  const [deadline, setDeadline] = useState("");
  const [packTitle, setPackTitle] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const cycleQuery = useQuery({
    queryKey: ["budget", "cycles", id],
    queryFn: () => budgetApi.getCycle(id).then((r) => r.data.data as BudgetCycle),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget", "cycles", id] });

  const guidelinesMut = useMutation({
    mutationFn: () =>
      budgetApi.publishGuidelines(id, {
        assumptions: assumptions.trim() || undefined,
        inflation_rate: inflation ? Number(inflation) : undefined,
        department_deadline: deadline || undefined,
      }),
    onSuccess: () => {
      setMessage("Guidelines published.");
      setError("");
      invalidate();
    },
    onError: () => setError("Failed to publish guidelines."),
  });

  const advanceMut = useMutation({
    mutationFn: () => budgetApi.advanceCycle(id),
    onSuccess: () => {
      setMessage("Cycle advanced.");
      setError("");
      invalidate();
    },
    onError: () => setError("Could not advance (check open packs / stage)."),
  });

  const returnMut = useMutation({
    mutationFn: () => budgetApi.returnCycle(id, { reason: returnReason.trim() }),
    onSuccess: () => {
      setMessage("Returned to departments.");
      setReturnReason("");
      invalidate();
    },
    onError: () => setError("Return failed."),
  });

  const sgMut = useMutation({
    mutationFn: () => budgetApi.sgApproveCycle(id, { comments: "SG approved" }),
    onSuccess: () => {
      setMessage("SG approved.");
      invalidate();
    },
    onError: () => setError("SG approve failed."),
  });

  const lockMut = useMutation({
    mutationFn: () => budgetApi.lockCycle(id),
    onSuccess: () => {
      setMessage("Cycle locked — institutional lines activated.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["budget", "lines"] });
    },
    onError: () => setError("Lock failed."),
  });

  const createPackMut = useMutation({
    mutationFn: () =>
      budgetApi.createSubmission({
        budget_cycle_id: id,
        title: packTitle.trim(),
        items: [
          {
            code: itemCode.trim() || undefined,
            name: itemName.trim(),
            requested_amount: Number(itemAmount),
          },
        ],
      }),
    onSuccess: () => {
      setPackTitle("");
      setItemCode("");
      setItemName("");
      setItemAmount("");
      setMessage("Submission pack created.");
      invalidate();
    },
    onError: () => setError("Could not create submission pack."),
  });

  const cycle = cycleQuery.data;
  const submissions: BudgetSubmissionPack[] = useMemo(() => cycle?.submissions ?? [], [cycle]);

  if (cycleQuery.isLoading) {
    return <p className="p-6 text-sm text-[var(--muted)]">Loading cycle…</p>;
  }

  if (!cycle) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-700">Cycle not found.</p>
        <Link href="/budget/cycles" className="text-sm text-[var(--primary)]">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/budget/cycles" className="text-sm text-[var(--primary)] hover:underline">
            ← Cycles
          </Link>
          <h1 className="page-title mt-1">
            {cycle.financial_year?.label || cycle.financial_year?.code || `Cycle #${cycle.id}`}
          </h1>
          <p className="page-subtitle capitalize">Status: {statusLabel(cycle.status)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canFinance && cycle.status !== "active" && cycle.status !== "sg_approved" && (
            <button type="button" className="btn-secondary text-sm" onClick={() => advanceMut.mutate()} disabled={advanceMut.isPending}>
              Advance stage
            </button>
          )}
          {(isSg || canFinance) && cycle.status === "management_review" && (
            <button type="button" className="btn-primary text-sm" onClick={() => sgMut.mutate()} disabled={sgMut.isPending}>
              SG approve
            </button>
          )}
          {canFinance && cycle.status === "sg_approved" && (
            <button type="button" className="btn-primary text-sm" onClick={() => lockMut.mutate()} disabled={lockMut.isPending}>
              Lock & activate
            </button>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {canFinance && cycle.status !== "active" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Publish guidelines</h2>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            rows={3}
            placeholder="Assumptions"
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Inflation %
              <input
                className="ml-2 w-24 rounded-lg border border-[var(--border)] px-2 py-1"
                value={inflation}
                onChange={(e) => setInflation(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Department deadline
              <input
                type="date"
                className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <button type="button" className="btn-secondary text-sm" onClick={() => guidelinesMut.mutate()} disabled={guidelinesMut.isPending}>
              Publish
            </button>
          </div>
          {cycle.guideline?.assumptions && (
            <p className="text-xs text-[var(--muted)]">Current: {cycle.guideline.assumptions}</p>
          )}
        </div>
      )}

      {canFinance && cycle.status === "finance_review" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold">Return to departments</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Reason"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!returnReason.trim() || returnMut.isPending}
            onClick={() => returnMut.mutate()}
          >
            Return all packs
          </button>
        </div>
      )}

      {["planning", "department_preparation"].includes(cycle.status) && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">New department pack</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Pack title"
            value={packTitle}
            onChange={(e) => setPackTitle(e.target.value)}
          />
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Line code"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Line name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Requested amount"
              value={itemAmount}
              onChange={(e) => setItemAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!packTitle.trim() || !itemName.trim() || !itemAmount || createPackMut.isPending}
            onClick={() => createPackMut.mutate()}
          >
            Create pack
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">Submissions</div>
        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">No packs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2">{s.title}</td>
                  <td className="px-4 py-2 capitalize">{statusLabel(s.status)}</td>
                  <td className="px-4 py-2">{s.items?.length ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/budget/submissions/${s.id}`} className="text-[var(--primary)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(cycle.approvals?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Stage history</h2>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {cycle.approvals?.map((a) => (
              <li key={a.id}>
                <span className="capitalize text-[var(--foreground)]">{statusLabel(a.stage)}</span> — {a.decision}
                {a.comments ? `: ${a.comments}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
