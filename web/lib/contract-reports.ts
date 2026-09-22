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

export const OPERATIONAL_HORIZONS = ["all", "expiring", "expired"] as const;
export type OperationalHorizon = (typeof OPERATIONAL_HORIZONS)[number];
export type SortDirection = "asc" | "desc";
export type ReportSort = { column: string; direction: SortDirection };
export type ReportKpi = {
  id: string;
  labelKey: string;
  value: number;
  tone?: "neutral" | "warning" | "danger" | "success";
  money?: boolean;
};

export function parseReportTab(value: string | null | undefined): ReportTabId {
  return REPORT_TABS.some((tab) => tab.id === value) ? (value as ReportTabId) : "register";
}

export function reportDownloadHref(
  type: string,
  format: "csv" | "xlsx" | "pdf",
  params?: { status?: string },
): string {
  const query = new URLSearchParams({ type, format });
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }
  return `/api/contracts/reports?${query.toString()}`;
}

export function humanizeToken(value: string): string {
  return value.replace(/_/g, " ");
}

export function badgeLabelKey(column: string, raw: string): string {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (column === "severity") {
    return `contracts.reports.severity.${value}`;
  }
  if (column === "status") {
    return `contracts.reports.status.${value}`;
  }
  if (column === "signature_status") {
    return `contracts.reports.signature.${value}`;
  }
  if (column === "health") {
    return `contracts.reports.health.${value}`;
  }
  return raw;
}

export function compareReportValues(column: string, left: unknown, right: unknown): number {
  const empty = (value: unknown) => value == null || value === "";
  if (empty(left) && empty(right)) {
    return 0;
  }
  if (empty(left)) {
    return 1;
  }
  if (empty(right)) {
    return -1;
  }
  if (isBooleanColumn(column)) {
    return Number(Boolean(left)) - Number(Boolean(right));
  }
  if (isMoneyColumn(column) || isNumericColumn(column)) {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function sortReportRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: ReportSort | null,
): T[] {
  if (!sort) {
    return rows;
  }
  return [...rows].sort((left, right) => {
    const comparison = compareReportValues(sort.column, left[sort.column], right[sort.column]);
    return sort.direction === "desc" ? -comparison : comparison;
  });
}

export function nextSort(current: ReportSort | null, column: string): ReportSort {
  if (current?.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return {
    column,
    direction: isMoneyColumn(column) || isNumericColumn(column) ? "desc" : "asc",
  };
}

export function matchesOperationalHorizon(
  row: Record<string, unknown>,
  horizon: OperationalHorizon,
): boolean {
  if (horizon === "expiring") {
    return Boolean(row.expiring_soon);
  }
  if (horizon === "expired") {
    return Boolean(row.expired);
  }
  return true;
}

export function reportCurrency(rows: Record<string, unknown>[]): string | null {
  const currencies = [
    ...new Set(
      rows
        .map((row) => (typeof row.currency === "string" ? row.currency.trim() : ""))
        .filter(Boolean),
    ),
  ];
  return currencies.length === 1 ? currencies[0] : null;
}

export function reportKpis(
  tab: ReportTabId,
  rows: Record<string, unknown>[],
  exceptions: { severity?: string }[] = [],
): ReportKpi[] {
  if (tab === "exceptions") {
    return [
      { id: "open", labelKey: "contracts.reports.kpi.openExceptions", value: exceptions.length },
      {
        id: "critical",
        labelKey: "contracts.reports.kpi.critical",
        value: exceptions.filter((row) => row.severity === "critical").length,
        tone: "danger",
      },
      {
        id: "high",
        labelKey: "contracts.reports.kpi.high",
        value: exceptions.filter((row) => row.severity === "high").length,
        tone: "warning",
      },
    ];
  }

  const count = rows.length;
  const sum = (key: string) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const flagged = (key: string) => rows.filter((row) => Boolean(row[key])).length;

  if (tab === "financial") {
    const variance = sum("variance");
    return [
      { id: "rows", labelKey: "contracts.reports.kpi.contracts", value: count },
      { id: "current", labelKey: "contracts.reports.kpi.currentValue", value: sum("current_value"), money: true },
      { id: "ceiling", labelKey: "contracts.reports.kpi.ceiling", value: sum("ceiling_value"), money: true },
      {
        id: "variance",
        labelKey: "contracts.reports.kpi.variance",
        value: variance,
        money: true,
        tone: variance > 0 ? "warning" : "success",
      },
    ];
  }

  if (tab === "compliance") {
    return [
      { id: "rows", labelKey: "contracts.reports.kpi.contracts", value: count },
      { id: "unsigned", labelKey: "contracts.reports.kpi.unsigned", value: flagged("unsigned"), tone: "danger" },
      { id: "retrospective", labelKey: "contracts.reports.kpi.retrospective", value: flagged("retrospective"), tone: "warning" },
      { id: "legacy", labelKey: "contracts.reports.kpi.legacy", value: flagged("is_legacy") },
    ];
  }

  if (tab === "operational") {
    return [
      { id: "rows", labelKey: "contracts.reports.kpi.contracts", value: count },
      { id: "expiring", labelKey: "contracts.reports.kpi.expiring", value: flagged("expiring_soon"), tone: "warning" },
      { id: "expired", labelKey: "contracts.reports.kpi.expired", value: flagged("expired"), tone: "danger" },
      { id: "amendments", labelKey: "contracts.reports.kpi.amendments", value: sum("amendments") },
    ];
  }

  const atRisk = rows.filter((row) =>
    ["expiring", "warning", "at_risk", "critical"].includes(String(row.health ?? "").toLowerCase()),
  ).length;
  const unsigned = rows.filter((row) => String(row.signature_status ?? "").toLowerCase() !== "signed").length;

  return [
    { id: "rows", labelKey: "contracts.reports.kpi.contracts", value: count },
    { id: "current", labelKey: "contracts.reports.kpi.currentValue", value: sum("current_value"), money: true },
    { id: "unsigned", labelKey: "contracts.reports.kpi.unsigned", value: unsigned, tone: "warning" },
    { id: "risk", labelKey: "contracts.reports.kpi.atRisk", value: atRisk, tone: "danger" },
  ];
}
