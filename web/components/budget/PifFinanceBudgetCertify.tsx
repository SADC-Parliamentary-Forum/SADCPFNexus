"use client";

import { useState } from "react";
import { programmeApi, type Programme } from "@/lib/api";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

const STATUS_OPTIONS = [
  { value: "not_checked", label: "Not checked" },
  { value: "available", label: "Available (certify / commit)" },
  { value: "partially_available", label: "Partially available" },
  { value: "unavailable", label: "Unavailable (release)" },
  { value: "confirmed_with_conditions", label: "Confirmed with conditions (commit)" },
];

export default function PifFinanceBudgetCertify({
  programme,
  onUpdated,
}: {
  programme: Programme;
  onUpdated: (programme: Programme) => void;
}) {
  const user = getStoredUser();
  const canCertify =
    isSystemAdmin(user) ||
    hasPermission(user, ["programme.finance-review", "finance.approve", "finance.admin"]);

  const [status, setStatus] = useState(programme.budget_availability_status || "not_checked");
  const [comments, setComments] = useState(programme.finance_comments || "");
  const [budgetLineId, setBudgetLineId] = useState<number | null>(null);
  const [amount, setAmount] = useState(String(programme.total_budget ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canCertify) return null;

  const needsLine = status === "available" || status === "confirmed_with_conditions";

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await programmeApi.updateFinanceReview(programme.id, {
        budget_availability_status: status,
        finance_comments: comments.trim() || undefined,
        budget_line_id: needsLine ? budgetLineId ?? undefined : undefined,
        commitment_amount: needsLine && amount ? Number(amount) : undefined,
      });
      onUpdated(res.data.data ?? res.data);
      setMessage(
        needsLine && budgetLineId
          ? "Finance review saved and budget commitment updated."
          : "Finance review saved.",
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      setError(
        err.response?.data?.message
          ?? err.response?.data?.errors?.amount?.[0]
          ?? err.response?.data?.errors?.budget_line_id?.[0]
          ?? "Failed to save finance review.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 space-y-4 border-l-4 border-l-indigo-500">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Finance budget certification</h3>
        <p className="text-xs text-neutral-400 mt-1">
          Certifying as available creates an institutional commitment. Marking unavailable releases it.
        </p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Availability status</label>
          <select className="form-input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Commitment amount</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-input w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!needsLine}
          />
        </div>
      </div>
      {needsLine && (
        <BudgetLinePicker
          value={budgetLineId}
          amount={amount ? Number(amount) : null}
          required
          onChange={(id) => setBudgetLineId(id)}
        />
      )}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">Finance comments</label>
        <textarea
          className="form-input w-full h-20 resize-none"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>
      <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={saving || (needsLine && !budgetLineId)} onClick={save}>
        {saving ? "Saving…" : "Save finance certification"}
      </button>
    </div>
  );
}
