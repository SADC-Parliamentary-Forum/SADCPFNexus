export type LeaveLedgerBalance = {
  leave_type: string;
  balance?: number;
  pending?: number;
  approved_future?: number;
  available?: number;
  source?: string;
};

export type LeaveTypeMeta = {
  code: string;
  name: string;
};

export type LeaveBalancesPayload = {
  annual_balance_days?: number;
  lil_hours_available?: number;
  sick_leave_used_days?: number;
  special_leave_days_used?: number;
  maternity_leave_days_used?: number;
  paternity_leave_days_used?: number;
  period_year?: number;
  data?: LeaveLedgerBalance[];
};

export type LeaveBalanceCard = {
  code: string;
  name: string;
  remaining: number;
  pending: number;
  used: number;
  headline: "remaining" | "used";
  unit: "days";
};

export const LEAVE_TYPE_ORDER = [
  "annual",
  "sick",
  "lil",
  "special",
  "compassionate",
  "study",
  "maternity",
  "paternity",
  "home",
  "unpaid",
] as const;

const FALLBACK_NAMES: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  lil: "Leave in Lieu",
  special: "Special",
  compassionate: "Compassionate",
  study: "Study",
  maternity: "Maternity",
  paternity: "Paternity",
  home: "Home",
  unpaid: "Unpaid",
};

const USED_BY_TYPE: Record<string, keyof LeaveBalancesPayload> = {
  sick: "sick_leave_used_days",
  special: "special_leave_days_used",
  maternity: "maternity_leave_days_used",
  paternity: "paternity_leave_days_used",
};

const CORE_TYPES = ["annual", "sick", "lil"] as const;

export function formatLeaveDays(n: number): string {
  const rounded = Math.round(Number(n) * 100) / 100;
  const pretty = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${pretty} ${Math.abs(rounded) === 1 ? "day" : "days"}`;
}

export function leaveTypeName(code: string, types: LeaveTypeMeta[] = []): string {
  return types.find((type) => type.code === code)?.name ?? FALLBACK_NAMES[code] ?? code.replace(/_/g, " ");
}

export function prefillLeaveEndDate(start: string, end: string): string {
  if (start && !end) return start;
  return end;
}

function usedDays(payload: LeaveBalancesPayload | null | undefined, code: string): number {
  const key = USED_BY_TYPE[code];
  if (!key || !payload) return 0;
  return Number(payload[key] ?? 0);
}

export function categorizeLeaveBalances(
  payload: LeaveBalancesPayload | null | undefined,
  types: LeaveTypeMeta[] = [],
): LeaveBalanceCard[] {
  const ledger = Array.isArray(payload?.data) ? payload.data : [];
  const byType = new Map(ledger.map((row) => [row.leave_type, row]));
  const catalog = types.map((type) => type.code);

  const codes: string[] = [];
  const seen = new Set<string>();
  const push = (code: string) => {
    if (!code || seen.has(code)) return;
    seen.add(code);
    codes.push(code);
  };

  for (const code of LEAVE_TYPE_ORDER) {
    if (catalog.length > 0) {
      if (catalog.includes(code)) push(code);
      continue;
    }
    if (
      CORE_TYPES.includes(code as (typeof CORE_TYPES)[number]) ||
      byType.has(code) ||
      usedDays(payload, code) > 0
    ) {
      push(code);
    }
  }
  for (const code of catalog) push(code);
  for (const row of ledger) push(row.leave_type);

  return codes.map((code) => {
    const row = byType.get(code);
    const remaining = row
      ? Number(row.available ?? 0)
      : code === "annual"
        ? Number(payload?.annual_balance_days ?? 0)
        : 0;
    const pending = row ? Number(row.pending ?? 0) : 0;
    const used = usedDays(payload, code);
    const headline: LeaveBalanceCard["headline"] =
      row || code === "annual" || code === "lil" || remaining > 0
        ? "remaining"
        : used > 0
          ? "used"
          : "remaining";

    return {
      code,
      name: leaveTypeName(code, types),
      remaining,
      pending,
      used,
      headline,
      unit: "days",
    };
  });
}
