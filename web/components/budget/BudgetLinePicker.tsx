"use client";

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

function lineLabel(line: OrgBudgetLine): string {
  const code = line.code || `#${line.id}`;
  const name = line.name || line.category;
  return `${code} — ${name}`;
}

export type BudgetLinePickerProps = {
  value: number | null;
  onChange: (lineId: number | null, line: OrgBudgetLine | null) => void;
  amount?: number | null;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showAvailability?: boolean;
};

export default function BudgetLinePicker({
  value,
  onChange,
  amount,
  label = "Budget line",
  required = false,
  disabled = false,
  className = "",
  showAvailability = true,
}: BudgetLinePickerProps) {
  const [lines, setLines] = useState<OrgBudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<BudgetAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    budgetApi
      .lines({ active_only: true, per_page: 200 })
      .then((res) => {
        if (cancelled) return;
        setLines(unwrapLines(res.data));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load budget lines.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value || !showAvailability) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    budgetApi
      .availability(value, amount != null && amount > 0 ? amount : undefined)
      .then((res) => {
        if (!cancelled) setAvailability(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, amount, showAvailability]);

  const selected = useMemo(() => lines.find((l) => l.id === value) ?? null, [lines, value]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-semibold text-neutral-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <select
        className="form-input w-full"
        disabled={disabled || loading}
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          const line = lines.find((l) => l.id === id) ?? null;
          onChange(id, line);
        }}
      >
        <option value="">{loading ? "Loading lines…" : "Select budget line"}</option>
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {lineLabel(line)}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {showAvailability && availability && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            availability.sufficient === false
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <div className="font-semibold mb-1">
            {selected ? lineLabel(selected) : "Availability"}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>Approved</span>
            <span className="text-right font-medium">{availability.approved.toLocaleString()}</span>
            <span>Actual</span>
            <span className="text-right font-medium">{availability.actual.toLocaleString()}</span>
            <span>Committed</span>
            <span className="text-right font-medium">{availability.commitments.toLocaleString()}</span>
            <span>Available</span>
            <span className="text-right font-bold">{availability.available.toLocaleString()}</span>
          </div>
          {availability.warnings?.includes("insufficient_funds") && (
            <p className="mt-1 font-medium">Requested amount exceeds available budget.</p>
          )}
        </div>
      )}
    </div>
  );
}
