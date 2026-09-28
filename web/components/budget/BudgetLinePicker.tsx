"use client";

import { useEffect, useState } from "react";
import {
  budgetApi,
  type BudgetAvailability,
  type OrgBudgetLine,
} from "@/lib/api";
import { NexusPicker } from "@/components/ui/NexusPicker";

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
  const [selected, setSelected] = useState<OrgBudgetLine | null>(null);
  const [availability, setAvailability] = useState<BudgetAvailability | null>(null);

  // Resolve the initial selected line object from its id (NexusPicker needs the
  // full object, not just the id the external contract passes).
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let cancelled = false;
    budgetApi.lines({ active_only: true, per_page: 200 }).then((res) => {
      if (cancelled) return;
      const match = unwrapLines(res.data).find((l) => l.id === value) ?? null;
      setSelected(match);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  return (
    <div className={`space-y-1.5 ${className}`}>
      <NexusPicker<OrgBudgetLine>
        id="budget-line-picker"
        label={label}
        required={required}
        disabled={disabled}
        value={selected}
        onSelect={(line) => {
          setSelected(line);
          onChange(line?.id ?? null, line);
        }}
        placeholder="Search code, name, category…"
        fetchOptions={async (search) => {
          const res = await budgetApi.lines({ active_only: true, per_page: 50, ...(search ? { q: search } : {}) });
          return unwrapLines(res.data);
        }}
        getId={(l) => l.id}
        getLabel={(l) => lineLabel(l)}
      />
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
