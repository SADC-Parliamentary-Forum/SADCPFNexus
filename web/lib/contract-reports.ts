export const REPORT_TABS = [
  { id: "register", icon: "menu_book", labelKey: "contracts.reports.tabRegister", hintKey: "contracts.reports.hintRegister" },
  { id: "financial", icon: "payments", labelKey: "contracts.reports.tabFinancial", hintKey: "contracts.reports.hintFinancial" },
  { id: "compliance", icon: "gavel", labelKey: "contracts.reports.tabCompliance", hintKey: "contracts.reports.hintCompliance" },
  { id: "operational", icon: "event_upcoming", labelKey: "contracts.reports.tabOperational", hintKey: "contracts.reports.hintOperational" },
  { id: "exceptions", icon: "report", labelKey: "contracts.reports.tabExceptions", hintKey: "contracts.reports.hintExceptions" },
] as const;

export type ReportTabId = (typeof REPORT_TABS)[number]["id"];
export type ReportType = Exclude<ReportTabId, "exceptions">;

export const REGISTER_STATUSES = ["all", "draft", "active", "completed", "terminated"] as const;
export const EXCEPTION_SEVERITIES = ["all", "critical", "high", "medium", "low"] as const;

export const HIDDEN_COLUMNS = new Set(["id"]);
export const MONEY_COLUMNS = new Set(["original_value", "current_value", "ceiling_value", "variance"]);
export const DATE_COLUMNS = new Set(["start_date", "end_date"]);
export const BOOLEAN_COLUMNS = new Set(["is_legacy", "unsigned", "retrospective", "expiring_soon", "expired"]);
export const BADGE_COLUMNS = new Set(["status", "signature_status", "health", "severity"]);
export const NUMERIC_COLUMNS = new Set(["days_to_expiry", "amendments"]);

export const COLUMN_LABEL_KEYS: Record<string, string> = {
  reference: "contracts.reports.col.reference",
  title: "contracts.reports.col.title",
  type: "contracts.reports.col.type",
  counterparty: "contracts.reports.col.counterparty",
  department: "contracts.reports.col.department",
  status: "contracts.reports.col.status",
  signature_status: "contracts.reports.col.signature_status",
  currency: "contracts.reports.col.currency",
  original_value: "contracts.reports.col.original_value",
  current_value: "contracts.reports.col.current_value",
  start_date: "contracts.reports.col.start_date",
  end_date: "contracts.reports.col.end_date",
  health: "contracts.reports.col.health",
  donor: "contracts.reports.col.donor",
  ceiling_value: "contracts.reports.col.ceiling_value",
  variance: "contracts.reports.col.variance",
  is_legacy: "contracts.reports.col.is_legacy",
  unsigned: "contracts.reports.col.unsigned",
  retrospective: "contracts.reports.col.retrospective",
  days_to_expiry: "contracts.reports.col.days_to_expiry",
  expiring_soon: "contracts.reports.col.expiring_soon",
  expired: "contracts.reports.col.expired",
  amendments: "contracts.reports.col.amendments",
};

export function isReportType(id: ReportTabId): id is ReportType {
  return id !== "exceptions";
}

export function reportColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) {
    return [];
  }
  return Object.keys(rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key));
}

export function columnLabelKey(column: string): string {
  return COLUMN_LABEL_KEYS[column] ?? `contracts.reports.col.${column}`;
}

export function rowMatchesQuery(row: Record<string, unknown>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return Object.entries(row).some(([key, value]) => {
    if (HIDDEN_COLUMNS.has(key) || value == null || typeof value === "object") {
      return false;
    }
    return String(value).toLowerCase().includes(needle);
  });
}

export function contractHref(id: unknown): string | null {
  if (typeof id === "number" && Number.isInteger(id) && id > 0) {
    return `/contracts/${id}`;
  }
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return `/contracts/${id}`;
  }
  return null;
}

export function nextReportTab(current: ReportTabId, delta: number): ReportTabId {
  const ids = REPORT_TABS.map((tab) => tab.id);
  const index = Math.max(0, ids.indexOf(current));
  return ids[(index + delta + ids.length) % ids.length];
}

export function badgeClass(column: string, raw: string): string {
  const value = raw.toLowerCase();
  if (column === "severity") {
    if (value === "critical") return "badge-danger";
    if (value === "high") return "badge-warning";
    if (value === "medium") return "badge-primary";
    return "badge-muted";
  }
  if (value === "active" || value === "signed" || value === "healthy" || value === "good") {
    return "badge-success";
  }
  if (value === "expired" || value === "terminated" || value === "critical" || value === "unsigned") {
    return "badge-danger";
  }
  if (value === "expiring" || value === "warning" || value === "at_risk" || value === "pending") {
    return "badge-warning";
  }
  if (value === "draft" || value === "completed" || value === "closed") {
    return "badge-muted";
  }
  return "badge-muted";
}

export function isMoneyColumn(column: string): boolean {
  return MONEY_COLUMNS.has(column);
}

export function isDateColumn(column: string): boolean {
  return DATE_COLUMNS.has(column);
}

export function isBooleanColumn(column: string): boolean {
  return BOOLEAN_COLUMNS.has(column);
}

export function isBadgeColumn(column: string): boolean {
  return BADGE_COLUMNS.has(column);
}

export function isNumericColumn(column: string): boolean {
  return NUMERIC_COLUMNS.has(column);
}
