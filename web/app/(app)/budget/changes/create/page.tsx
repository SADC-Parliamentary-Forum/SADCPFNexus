"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { budgetApi, type OrgBudgetLine } from "@/lib/api";

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

function unwrapBudgets(payload: unknown): Array<{ id: number; name: string; status?: string }> {
  // Reuse finance budgets list via lines' budget ids from org lines
  const lines = unwrapLines(payload);
  const map = new Map<number, { id: number; name: string }>();
  for (const line of lines) {
    if (line.budget?.id) {
      map.set(line.budget.id, { id: line.budget.id, name: line.budget.name });
    }
  }
  return Array.from(map.values());
}

export default function CreateBudgetChangePage() {
  const router = useRouter();
  const [type, setType] = useState("transfer");
  const [title, setTitle] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [justification, setJustification] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [isDecrease, setIsDecrease] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState("");

  const linesQuery = useQuery({
    queryKey: ["budget", "lines", "change-create"],
    queryFn: () => budgetApi.lines({ active_only: true, per_page: 200 }).then((r) => unwrapLines(r.data)),
  });

  const lines = linesQuery.data ?? [];
  const budgets = useMemo(() => unwrapBudgets({ data: lines }), [lines]);
  const filteredLines = useMemo(() => {
    if (!budgetId) return lines;
    return lines.filter((l) => String(l.budget?.id ?? "") === budgetId);
  }, [lines, budgetId]);

  const createMut = useMutation({
    mutationFn: () => {
      const items: Record<string, unknown>[] = [];
      if (type === "transfer" || type === "contingency") {
        items.push({
          source_budget_line_id: Number(sourceId),
          target_budget_line_id: Number(targetId),
          amount: Number(amount),
        });
      } else if (type === "revision") {
        items.push({
          target_budget_line_id: Number(targetId),
          amount: Number(amount),
          is_decrease: isDecrease,
        });
      } else {
        if (targetId) {
          items.push({ target_budget_line_id: Number(targetId), amount: Number(amount) });
        } else {
          items.push({
            new_line_code: newCode.trim() || undefined,
            new_line_name: newName.trim(),
            new_line_category: "operational",
            amount: Number(amount),
          });
        }
      }

      return budgetApi.createChange({
        budget_id: Number(budgetId),
        type,
        title: title.trim(),
        justification: justification.trim() || undefined,
        items,
      });
    },
    onSuccess: (res) => {
      router.push(`/budget/changes/${res.data.data.id}`);
    },
    onError: () => setError("Could not create change request."),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/budget/changes" className="text-sm text-[var(--primary)] hover:underline">
          ← Changes
        </Link>
        <h1 className="page-title mt-1">New budget change</h1>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <label className="block text-sm">
          Type
          <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="transfer">Transfer</option>
            <option value="revision">Revision</option>
            <option value="supplementary">Supplementary</option>
            <option value="contingency">Contingency draw</option>
          </select>
        </label>
        <label className="block text-sm">
          Budget
          <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
            <option value="">Select…</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Title
          <input className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm">
          Justification
          <textarea className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </label>

        {(type === "transfer" || type === "contingency") && (
          <>
            <label className="block text-sm">
              From line
              <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Select…</option>
                {filteredLines
                  .filter((l) => (type === "contingency" ? Boolean((l as OrgBudgetLine & { is_contingency?: boolean }).is_contingency) : true))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code || l.name} (#{l.id})
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              To line
              <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Select…</option>
                {filteredLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code || l.name} (#{l.id})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {type === "revision" && (
          <>
            <label className="block text-sm">
              Line
              <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Select…</option>
                {filteredLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code || l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDecrease} onChange={(e) => setIsDecrease(e.target.checked)} />
              Decrease (otherwise increase)
            </label>
          </>
        )}

        {type === "supplementary" && (
          <>
            <label className="block text-sm">
              Existing line (optional)
              <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Create new line…</option>
                {filteredLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code || l.name}
                  </option>
                ))}
              </select>
            </label>
            {!targetId && (
              <>
                <input className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" placeholder="New line code" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <input className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm" placeholder="New line name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </>
            )}
          </>
        )}

        <label className="block text-sm">
          Amount
          <input className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <button
          type="button"
          className="btn-primary text-sm"
          disabled={!title.trim() || !budgetId || !amount || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          Create
        </button>
      </div>
    </div>
  );
}
