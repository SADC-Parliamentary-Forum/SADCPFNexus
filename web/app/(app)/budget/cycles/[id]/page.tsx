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
  const canRecordDecision =
    canFinance ||
    isSystemAdmin(user) ||
    Boolean(user?.roles?.includes("Governance Officer")) ||
    hasPermission(user, ["finance.admin"]);

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
  const [decisionBody, setDecisionBody] = useState<"fsc" | "exco" | "plenary">("fsc");
  const [decisionOutcome, setDecisionOutcome] = useState("approved");
  const [meetingOn, setMeetingOn] = useState("");
  const [minuteRef, setMinuteRef] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [decisionFile, setDecisionFile] = useState<File | null>(null);

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

  const decisionMut = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("body", decisionBody);
      form.append("decision", decisionOutcome);
      if (meetingOn) form.append("meeting_on", meetingOn);
      if (minuteRef.trim()) form.append("minute_reference", minuteRef.trim());
      if (decisionComments.trim()) form.append("comments", decisionComments.trim());
      if (decisionFile) form.append("attachment", decisionFile);
      return budgetApi.recordDecision(id, form);
    },
    onSuccess: () => {
      setMessage("Institutional decision recorded.");
      setError("");
      setDecisionComments("");
      setMinuteRef("");
      setDecisionFile(null);
      invalidate();
    },
    onError: () => setError("Could not record decision (check body matches current stage)."),
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
  const institutionalStatuses = ["fsc_review", "exco_review", "plenary_review", "plenary_approved"];
  const canAdvance =
    canFinance &&
    ["planning", "department_preparation", "submitted_to_finance", "finance_review"].includes(cycle?.status ?? "");

  if (cycleQuery.isLoading) {
    return <p className="p-6 text-sm text-[var(--muted)]">Loading cycle…</p>;
  }

  if (!cycle) {
    return (
    <div className="space-y-5">
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
          {canAdvance && (
            <button type="button" className="btn-secondary text-sm" onClick={() => advanceMut.mutate()} disabled={advanceMut.isPending}>
              Advance stage
            </button>
          )}
          {(isSg || canFinance) && cycle.status === "management_review" && (
            <button type="button" className="btn-primary text-sm" onClick={() => sgMut.mutate()} disabled={sgMut.isPending}>
              SG approve
            </button>
          )}
          {canFinance && cycle.status === "plenary_approved" && (
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

      {canRecordDecision && institutionalStatuses.includes(cycle.status) && cycle.status !== "plenary_approved" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Institutional decision (FSC → EXCO → Plenary)</h2>
          <p className="text-xs text-[var(--muted)]">
            Current stage: <span className="capitalize">{statusLabel(cycle.status)}</span>. Record the matching body outcome.
            Non-approved returns the cycle to Finance review.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">
              Body
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={decisionBody}
                onChange={(e) => setDecisionBody(e.target.value as "fsc" | "exco" | "plenary")}
              >
                <option value="fsc">Finance Sub-Committee</option>
                <option value="exco">Executive Committee</option>
                <option value="plenary">Plenary Assembly</option>
              </select>
            </label>
            <label className="text-sm">
              Decision
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={decisionOutcome}
                onChange={(e) => setDecisionOutcome(e.target.value)}
              >
                <option value="approved">Approved</option>
                <option value="approved_with_amendments">Approved with amendments</option>
                <option value="deferred">Deferred</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="text-sm">
              Meeting date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={meetingOn}
                onChange={(e) => setMeetingOn(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Minute / reference
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={minuteRef}
                onChange={(e) => setMinuteRef(e.target.value)}
                placeholder="e.g. FSC/2026/14"
              />
            </label>
          </div>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            rows={2}
            placeholder="Comments / summary"
            value={decisionComments}
            onChange={(e) => setDecisionComments(e.target.value)}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="block w-full text-sm"
            onChange={(e) => setDecisionFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={decisionMut.isPending}
            onClick={() => decisionMut.mutate()}
          >
            Record decision
          </button>
        </div>
      )}

      {(cycle.decisions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Institutional decisions</h2>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {cycle.decisions?.map((d) => (
              <li key={d.id}>
                <span className="uppercase text-[var(--foreground)]">{d.body}</span> — {statusLabel(d.decision)}
                {d.minute_reference ? ` (${d.minute_reference})` : ""}
                {d.comments ? `: ${d.comments}` : ""}
              </li>
            ))}
          </ul>
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
