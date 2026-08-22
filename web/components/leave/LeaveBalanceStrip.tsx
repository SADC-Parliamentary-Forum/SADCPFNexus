"use client";

import { formatLeaveDays, type LeaveBalanceCard } from "@/lib/leaveBalances";
import { LEAVE_TYPE_COLORS, LEAVE_TYPE_ICONS } from "@/lib/leaveHub";
import { cn } from "@/lib/utils";

export function LeaveBalanceStrip({
  cards,
  loading = false,
  year,
  selectedCode,
  onSelect,
  compact = false,
}: {
  cards: LeaveBalanceCard[];
  loading?: boolean;
  year?: number;
  selectedCode?: string;
  onSelect?: (code: string) => void;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div
        className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"}
        data-testid="leave-balance-strip"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={compact ? "h-9 w-28 animate-pulse rounded-full bg-neutral-100" : "h-24 animate-pulse rounded-xl bg-neutral-100"}
          />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-neutral-500" data-testid="leave-balance-strip">
        Leave balances for {year ?? "this year"} could not be loaded.
      </p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2" data-testid="leave-balance-strip">
        {cards.map((card) => {
          const color = LEAVE_TYPE_COLORS[card.code] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
          const selected = selectedCode === card.code;
          const value = card.headline === "used" ? card.used : card.remaining;
          const className = cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
            color,
            selected && "ring-2 ring-primary ring-offset-1",
            onSelect && "hover:border-primary/40",
            !onSelect && "cursor-default",
          );
          const inner = (
            <>
              {card.name}
              <span className="font-normal tabular-nums text-neutral-600">{formatLeaveDays(value)}</span>
            </>
          );
          return onSelect ? (
            <button
              key={card.code}
              type="button"
              data-testid={`leave-balance-${card.code}`}
              className={className}
              onClick={() => onSelect(card.code)}
            >
              {inner}
            </button>
          ) : (
            <div key={card.code} data-testid={`leave-balance-${card.code}`} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="leave-balance-strip">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Days by leave type{year ? ` · ${year}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const color = LEAVE_TYPE_COLORS[card.code] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
          const selected = selectedCode === card.code;
          const value = card.headline === "used" ? card.used : card.remaining;
          const caption = card.headline === "used" ? "used this year" : "remaining";
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-800">{card.name}</p>
                <span className={cn("material-symbols-outlined text-[18px]", color.split(" ")[0])}>
                  {LEAVE_TYPE_ICONS[card.code] ?? "event_available"}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">{formatLeaveDays(value)}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">{caption}</p>
              {card.pending > 0 && card.headline === "remaining" ? (
                <p className="mt-1 text-[11px] font-medium text-amber-800">
                  {formatLeaveDays(card.pending)} pending approval
                </p>
              ) : null}
            </>
          );

          const className = cn(
            "rounded-xl border px-4 py-3 text-left transition-colors",
            color,
            selected && "ring-2 ring-primary ring-offset-1",
            onSelect && "hover:border-primary/40",
          );

          return onSelect ? (
            <button
              key={card.code}
              type="button"
              data-testid={`leave-balance-${card.code}`}
              className={className}
              onClick={() => onSelect(card.code)}
            >
              {inner}
            </button>
          ) : (
            <div key={card.code} data-testid={`leave-balance-${card.code}`} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
