import type { AssetReportCatalogueItem } from "@/lib/api";

export const REPORT_FAMILIES = [
  "Custody",
  "Inventory",
  "Financial",
  "Verification",
  "Maintenance",
  "Disposal",
  "Risk",
  "Management",
  "Audit",
  "Data Quality",
] as const;

export type ReportFamily = (typeof REPORT_FAMILIES)[number];

export const REPORT_MODES = [
  "current",
  "history",
  "as_of",
  "temporary",
  "returned",
  "unresolved",
] as const;

export type ReportMode = (typeof REPORT_MODES)[number];

const FAMILY_KEYS: Record<string, string> = {
  Custody: "assets.reports.familyCustody",
  Inventory: "assets.reports.familyInventory",
  Financial: "assets.reports.familyFinancial",
  Verification: "assets.reports.familyVerification",
  Maintenance: "assets.reports.familyMaintenance",
  Disposal: "assets.reports.familyDisposal",
  Risk: "assets.reports.familyRisk",
  Management: "assets.reports.familyManagement",
  Audit: "assets.reports.familyAudit",
  "Data Quality": "assets.reports.familyDataQuality",
};

const MODE_KEYS: Record<ReportMode, string> = {
  current: "assets.reports.modeCurrent",
  history: "assets.reports.modeHistory",
  as_of: "assets.reports.modeAsOf",
  temporary: "assets.reports.modeTemporary",
  returned: "assets.reports.modeReturned",
  unresolved: "assets.reports.modeUnresolved",
};

export function familyI18nKey(family: string): string {
  return FAMILY_KEYS[family] ?? family;
}

export function modeI18nKey(mode: ReportMode): string {
  return MODE_KEYS[mode];
}

export function filterCatalogue(
  items: AssetReportCatalogueItem[],
  family: string,
): AssetReportCatalogueItem[] {
  if (family === "all") {
    return items;
  }
  return items.filter((item) => item.family === family);
}

export function presentFamilies(items: AssetReportCatalogueItem[]): ReportFamily[] {
  const present = new Set(items.map((item) => item.family));
  return REPORT_FAMILIES.filter((family) => present.has(family));
}

export const READY_REPORTS = ["R01", "R02", "R03", "R04", "R05", "R06", "R08", "R09"] as const;

export function reportNeedsStaff(id: string): boolean {
  return id === "R01" || id === "R02" || id === "R08" || id === "R09";
}

export function reportHref(id: string): string | null {
  if (READY_REPORTS.includes(id as (typeof READY_REPORTS)[number])) {
    return "#asset-report-r01";
  }
  return null;
}
