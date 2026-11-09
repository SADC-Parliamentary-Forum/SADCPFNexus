"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  reportsApi,
  assetCategoriesApi,
  type Asset,
  type AssetCategory,
  type ReportUser,
  type ReportDepartment,
} from "@/lib/api";
import { getStoredUser, hasPermission } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { formatDateTable } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Filters {
  period_from: string;
  period_to: string;
  user_id: string;
  department_id: string;
  status: string;
  committee: string;
  category: string;
}

type ModuleKey =
  | "travel" | "leave" | "dsa" | "imprest"
  | "procurement" | "salary-advances" | "budget"
  | "hr-timesheets" | "risk" | "governance" | "assets";

interface Module {
  key: ModuleKey;
  label: string;
  icon: string;
  color: string;
  group: string;
  statusOptions: string[];
  columns: string[];
}

// ─── Module Definitions ───────────────────────────────────────────────────────

const MODULES: Module[] = [
  // Operational
  { key: "travel",          label: "reports.module.travel",           icon: "flight_takeoff",   color: "text-primary",    group: "reports.group.operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["reports.col.reference","reports.col.employee","reports.col.destination","reports.col.departure","reports.col.return","reports.col.dsa","reports.col.status"] },
  { key: "leave",           label: "reports.module.leave",            icon: "event_available",  color: "text-green-600",  group: "reports.group.operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["reports.col.reference","reports.col.employee","reports.col.type","reports.col.from","reports.col.to","reports.col.days","reports.col.status"] },
  { key: "dsa",             label: "reports.module.dsa",   icon: "paid",             color: "text-teal-600",   group: "reports.group.operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["reports.col.reference","reports.col.employee","reports.col.country","reports.col.departure","reports.col.return","reports.col.days","reports.col.dsa","reports.col.status"] },
  { key: "imprest",         label: "reports.module.imprest",          icon: "account_balance_wallet", color: "text-orange-600", group: "reports.group.operational", statusOptions: ["draft","submitted","approved","rejected","liquidated"], columns: ["reports.col.reference","reports.col.employee","reports.col.purpose","reports.col.requested","reports.col.approved","reports.col.status","reports.col.liquidationDate"] },
  // Financial
  { key: "procurement",     label: "reports.module.procurement",      icon: "shopping_cart",    color: "text-blue-600",   group: "reports.group.financial",        statusOptions: ["draft","submitted","hod_approved","budget_reserved","approved","awarded","rejected"], columns: ["reports.col.reference","reports.col.employee","reports.col.title","reports.col.category","reports.col.method","reports.col.value","reports.col.status"] },
  { key: "salary-advances", label: "reports.module.salaryAdvances",  icon: "savings",          color: "text-primary", group: "reports.group.financial",        statusOptions: ["draft","submitted","approved","rejected"],            columns: ["reports.col.reference","reports.col.employee","reports.col.type","reports.col.amount","reports.col.months","reports.col.status"] },
  { key: "budget",          label: "reports.module.budget", icon: "account_balance", color: "text-amber-600", group: "reports.group.financial",       statusOptions: [],                                                     columns: ["reports.col.programme","reports.col.title","reports.col.status","reports.col.funding","reports.col.budget","reports.col.currency","reports.col.endDate"] },
  // HR
  { key: "hr-timesheets",   label: "reports.module.hrTimesheets",    icon: "schedule",         color: "text-indigo-600", group: "reports.group.hr",               statusOptions: ["draft","submitted","approved","rejected"],            columns: ["reports.col.employee","reports.col.weekStart","reports.col.weekEnd","reports.col.totalHrs","reports.col.overtime","reports.col.status"] },
  // Governance & Risk
  { key: "governance",      label: "reports.module.governance",       icon: "gavel",            color: "text-rose-600",   group: "reports.group.governanceRisk", statusOptions: ["draft","open","adopted","archived"],                columns: ["reports.col.reference","reports.col.title","reports.col.type","reports.col.committee","reports.col.status","reports.col.adopted"] },
  { key: "risk",            label: "reports.module.risk",    icon: "warning_amber",    color: "text-red-600",    group: "reports.group.governanceRisk", statusOptions: ["draft","submitted","reviewed","approved","monitoring","escalated","closed"], columns: ["reports.col.code","reports.col.title","reports.col.category","reports.col.department","reports.col.likelihood","reports.col.impact","reports.col.level","reports.col.owner","reports.col.status"] },
  // Assets
  { key: "assets",          label: "reports.module.assets",           icon: "inventory_2",      color: "text-teal-700",   group: "reports.group.assets",           statusOptions: ["active","under_maintenance","retired","disposed"],   columns: ["reports.col.code","reports.col.name","reports.col.category","reports.col.status","reports.col.age","reports.col.value"] },
];

const GROUPS = ["reports.group.operational", "reports.group.financial", "reports.group.hr", "reports.group.governanceRisk", "reports.group.assets"];

// FY pills (SADC PF: April – March)
const FY_OPTIONS = [
  { label: "FY2022/23", fy: 2022 },
  { label: "FY2023/24", fy: 2023 },
  { label: "FY2024/25", fy: 2024 },
  { label: "FY2025/26", fy: 2025 },
];

function fyPeriod(fy: number): { period_from: string; period_to: string } {
  return { period_from: `${fy}-04-01`, period_to: `${fy + 1}-03-31` };
}

// ─── CSV download helper ──────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function openPrintPreview(html: string, target = "_blank", features?: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, target, features);
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }

  const cleanup = () => URL.revokeObjectURL(url);
  win.addEventListener("load", () => {
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }, { once: true });
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
}

function buildApiParams(filters: Filters, extra?: Record<string, string>) {
  const p: Record<string, string> = {};
  if (filters.period_from)  p.period_from  = filters.period_from;
  if (filters.period_to)    p.period_to    = filters.period_to;
  if (filters.user_id)      p.user_id      = filters.user_id;
  if (filters.department_id) p.department_id = filters.department_id;
  if (filters.status)       p.status       = filters.status;
  if (filters.committee)    p.committee    = filters.committee;
  if (filters.category)     p.category     = filters.category;
  return { ...p, ...extra, per_page: 50 };
}

// ─── Row renderers (preview tables) ──────────────────────────────────────────

function TravelRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? row.employee ?? "—")}</td>
      <td>{String(row.destination_city ?? "")} {String(row.destination_country ?? "")}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.departure_date ?? ""))}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.return_date ?? ""))}</td>
      <td>{String(row.currency ?? "NAD")} {Number(row.estimated_dsa ?? 0).toLocaleString()}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function LeaveRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td className="capitalize">{String(row.leave_type ?? "")}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.start_date ?? ""))}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.end_date ?? ""))}</td>
      <td>{String(row.days_requested ?? "")}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function DsaRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td>{String(row.destination_country ?? "")}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.departure_date ?? ""))}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.return_date ?? ""))}</td>
      <td>{String(row.number_of_days ?? "—")}</td>
      <td>{String(row.currency ?? "NAD")} {Number(row.estimated_dsa ?? 0).toLocaleString()}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function ImprestRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td className="max-w-[120px] truncate">{String(row.purpose ?? "")}</td>
      <td className="tabular-nums">{String(row.currency ?? "NAD")} {Number(row.amount_requested ?? 0).toLocaleString()}</td>
      <td className="tabular-nums">{row.amount_approved != null ? Number(row.amount_approved).toLocaleString() : "—"}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.expected_liquidation_date ?? ""))}</td>
    </tr>
  );
}

function ProcurementRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td className="max-w-[120px] truncate">{String(row.title ?? "")}</td>
      <td className="capitalize">{String(row.category ?? "")}</td>
      <td className="capitalize text-[11px]">{String(row.procurement_method ?? "").replace(/_/g, " ")}</td>
      <td className="tabular-nums">{String(row.currency ?? "NAD")} {Number(row.estimated_value ?? 0).toLocaleString()}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "").replace(/_/g, " ")}</span></td>
    </tr>
  );
}

function SalaryAdvRow({ row }: { row: Record<string, unknown> }) {
  const { t } = useI18n();
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td className="capitalize">{String(row.advance_type ?? "").replace(/_/g, " ")}</td>
      <td className="tabular-nums">{String(row.currency ?? "NAD")} {Number(row.amount ?? 0).toLocaleString()}</td>
      <td>{t("reports.monthsShort", { count: String(row.repayment_months ?? "—") })}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function TimesheetRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td>{String((row.user as Record<string,string>)?.name ?? "—")}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.week_start ?? ""))}</td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.week_end ?? ""))}</td>
      <td className="tabular-nums">{String(row.total_hours ?? "—")}</td>
      <td className="tabular-nums">{String(row.overtime_hours ?? "—")}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function RiskRow({ row }: { row: Record<string, unknown> }) {
  const level = String(row.risk_level ?? "low");
  const levelClass = level === "critical" ? "badge-danger" : level === "high" ? "badge-warning" : level === "medium" ? "badge-primary" : "badge-muted";
  return (
    <tr>
      <td className="font-mono">{String(row.risk_code ?? "")}</td>
      <td className="max-w-[120px] truncate">{String(row.title ?? "")}</td>
      <td className="capitalize">{String(row.category ?? "")}</td>
      <td>{String((row.department as Record<string,string>)?.name ?? "—")}</td>
      <td className="tabular-nums">{String(row.likelihood ?? "")}</td>
      <td className="tabular-nums">{String(row.impact ?? "")}</td>
      <td><span className={`badge ${levelClass} capitalize`}>{level}</span></td>
      <td>{String((row.risk_owner as Record<string,string>)?.name ?? "—")}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
    </tr>
  );
}

function GovernanceRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td className="max-w-[140px] truncate">{String(row.title ?? "")}</td>
      <td className="capitalize">{String(row.type ?? "").replace(/_/g, " ")}</td>
      <td>{String(row.committee ?? "—")}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
      <td className="tabular-nums text-[11px]">{formatDateTable(String(row.adopted_at ?? ""))}</td>
    </tr>
  );
}

function AssetRow({ row }: { row: Record<string, unknown> }) {
  return (
    <tr>
      <td className="font-mono">{String(row.asset_code ?? row.asset_tag ?? "")}</td>
      <td className="max-w-[120px] truncate">{String(row.name ?? "")}</td>
      <td className="capitalize">{String(row.category ?? "")}</td>
      <td><span className="badge badge-muted capitalize">{String(row.status ?? "")}</span></td>
      <td className="text-neutral-500">{String((row as unknown as Asset).age_display ?? "—")}</td>
      <td className="tabular-nums">{(row as unknown as Asset).current_value != null ? Number((row as unknown as Asset).current_value).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [activeModule, setActiveModule] = useState<ModuleKey>("travel");
  const [filters, setFilters] = useState<Filters>({
    period_from: "",
    period_to: "",
    user_id: "",
    department_id: "",
    status: "",
    committee: "",
    category: "",
  });
  const [activeFy, setActiveFy] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportUsers, setReportUsers] = useState<ReportUser[]>([]);
  const [departments, setDepartments] = useState<ReportDepartment[]>([]);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [canExport, setCanExport] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canSchedule, setCanSchedule] = useState(false);
  const [schedules, setSchedules] = useState<Array<Record<string, unknown>>>([]);
  const [exportEvents, setExportEvents] = useState<Array<Record<string, unknown>>>([]);
  const [scheduleForm, setScheduleForm] = useState({ label: "", frequency: "monthly", format: "csv", recipients: "" });
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  // Auth guard + load filter data
  useEffect(() => {
    const user = getStoredUser();
    if (!user || !hasPermission(user, "reports.view")) {
      setAccessDenied(true);
      return;
    }
    setCanExport(hasPermission(user, "reports.export"));
    setIsManager(hasPermission(user, "reports.export"));
    setCanSchedule(hasPermission(user, "reports.schedule"));

    reportsApi.users().then((r) => setReportUsers(r.data.data ?? [])).catch(() => {});
    reportsApi.departments().then((r) => setDepartments(r.data.data ?? [])).catch(() => {});
    assetCategoriesApi.list().then((r) => setAssetCategories(r.data.data ?? [])).catch(() => {});
    reportsApi.schedules().then((r) => setSchedules(r.data.data ?? [])).catch(() => {});
    reportsApi.exportEvents().then((r) => setExportEvents(r.data.data ?? [])).catch(() => {});
  }, [router]);

  const submitSchedule = async () => {
    if (!scheduleForm.label.trim() || !scheduleForm.recipients.trim()) return;
    setScheduleNotice(null);
    try {
      await reportsApi.createSchedule({
        report_key: activeModule,
        label: scheduleForm.label,
        frequency: scheduleForm.frequency,
        format: scheduleForm.format,
        recipients: scheduleForm.recipients.split(",").map((email) => email.trim()).filter(Boolean),
        filters: buildApiParams(filters),
      });
      setScheduleNotice(t("reports.schedule.submittedNotice"));
      toast.success(t("reports.schedule.submitted"), t("reports.schedule.submittedDetail"));
      setScheduleForm({ label: "", frequency: "monthly", format: "csv", recipients: "" });
      const response = await reportsApi.schedules();
      setSchedules(response.data.data ?? []);
      const exports = await reportsApi.exportEvents();
      setExportEvents(exports.data.data ?? []);
    } catch (err) {
      const message = apiErrorMessage(err, t("reports.schedule.createFailed"));
      setScheduleNotice(message);
      toast.error(t("reports.schedule.notCreated"), message);
    }
  };

  const changeScheduleStatus = async (id: number, action: "approve" | "pause") => {
    try {
      if (action === "approve") await reportsApi.approveSchedule(id);
      else await reportsApi.pauseSchedule(id);
      toast.success(action === "approve" ? t("reports.schedule.approved") : t("reports.schedule.paused"));
    } catch (err) {
      toast.error(
        action === "approve" ? t("reports.schedule.approveFailed") : t("reports.schedule.pauseFailed"),
        apiErrorMessage(err, t("reports.tryAgain")),
      );
      return;
    }
    try {
      const response = await reportsApi.schedules();
      setSchedules(response.data.data ?? []);
    } catch {
      // list refresh failure is non-fatal
    }
  };

  // Reset rows when module changes
  useEffect(() => {
    setRows(null);
    setError(null);
    setFilters(f => ({ ...f, status: "", committee: "", category: "" }));
  }, [activeModule]);

  const module = MODULES.find((m) => m.key === activeModule)!;

  const setFiscalYear = (fy: number) => {
    const { period_from, period_to } = fyPeriod(fy);
    setActiveFy(fy);
    setFilters((f) => ({ ...f, period_from, period_to }));
  };

  const clearFy = () => {
    setActiveFy(null);
    setFilters((f) => ({ ...f, period_from: "", period_to: "" }));
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const params = buildApiParams(filters);
      let res;
      switch (activeModule) {
        case "travel":          res = await reportsApi.travel(params); break;
        case "leave":           res = await reportsApi.leave(params); break;
        case "dsa":             res = await reportsApi.dsa(params); break;
        case "imprest":         res = await reportsApi.imprest(params); break;
        case "procurement":     res = await reportsApi.procurement(params); break;
        case "salary-advances": res = await reportsApi.salaryAdvances(params); break;
        case "hr-timesheets":   res = await reportsApi.hrTimesheets(params); break;
        case "risk":            res = await reportsApi.risk(params); break;
        case "governance":      res = await reportsApi.governance(params); break;
        case "assets":          res = await reportsApi.assets(params); break;
        case "budget": {
          const { programmeApi } = await import("@/lib/api");
          res = await programmeApi.list({ per_page: 50 });
          break;
        }
      }
      const data = (res.data as { data?: unknown[] }).data ?? [];
      setRows(data as Record<string, unknown>[]);
      setTotal((res.data as { total?: number }).total ?? data.length);
    } catch {
      setError(t("reports.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeModule, filters, t]);

  const exportGenerated = useCallback(async (format: "csv" | "xlsx" | "pdf") => {
    if (!canExport) return;
    setExporting(true);
    setError(null);
    try {
      const params = buildApiParams(filters, { format });
      let res;
      switch (activeModule) {
        case "travel":          res = await api.get("/reports/travel", { params, responseType: "blob" }); break;
        case "leave":           res = await api.get("/reports/leave", { params, responseType: "blob" }); break;
        case "dsa":             res = await api.get("/reports/dsa", { params, responseType: "blob" }); break;
        case "imprest":         res = await api.get("/reports/imprest", { params, responseType: "blob" }); break;
        case "procurement":     res = await api.get("/reports/procurement", { params, responseType: "blob" }); break;
        case "salary-advances": res = await api.get("/reports/salary-advances", { params, responseType: "blob" }); break;
        case "hr-timesheets":   res = await api.get("/reports/hr-timesheets", { params, responseType: "blob" }); break;
        case "risk":            res = await api.get("/reports/risk", { params, responseType: "blob" }); break;
        case "governance":      res = await api.get("/reports/governance", { params, responseType: "blob" }); break;
        case "assets":          res = await api.get("/reports/assets", { params, responseType: "blob" }); break;
        default: setExporting(false); return;
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `${activeModule}-report-${date}.${format}`);
    } catch {
      setError(t("reports.exportFailed"));
    } finally {
      setExporting(false);
    }
  }, [activeModule, filters, canExport, t]);

  const exportCsv = useCallback(() => exportGenerated("csv"), [exportGenerated]);
  const exportXlsx = useCallback(() => exportGenerated("xlsx"), [exportGenerated]);
  const exportPdfFile = useCallback(() => exportGenerated("pdf"), [exportGenerated]);

  const exportPdf = useCallback(() => {
    if (!rows || rows.length === 0 || !module) return;
    const date = new Date().toLocaleDateString("en-GB");
    const headers = module.columns.map((c) => t(c));
    const moduleLabel = t(module.label);
    const buildCells = (row: Record<string, unknown>) => {
      // Re-use the same data the preview table shows
      switch (activeModule) {
        case "travel":          return [row.reference_number, (row.requester as Record<string,unknown>)?.name, row.destination_country, row.destination_city, row.departure_date, row.return_date, row.currency, row.estimated_dsa, row.status];
        case "leave":           return [row.reference_number, (row.requester as Record<string,unknown>)?.name, row.leave_type, row.start_date, row.end_date, row.days_requested, row.status];
        case "dsa":             return [row.reference_number, (row.requester as Record<string,unknown>)?.name, row.destination_country, row.departure_date, row.return_date, "--", row.estimated_dsa, row.currency, row.status];
        case "imprest":         return [row.reference_number, (row.requester as Record<string,unknown>)?.name, row.purpose, row.budget_line, row.currency, row.amount_requested, row.status, row.expected_liquidation_date];
        case "procurement":     return [row.reference_number, row.title, (row.requester as Record<string,unknown>)?.name, row.category, row.currency, row.estimated_value, row.status];
        case "salary-advances": return [row.reference_number, (row.requester as Record<string,unknown>)?.name, row.advance_type, row.currency, row.amount_requested, row.repayment_months, row.status];
        case "hr-timesheets":   return [(row.user as Record<string,unknown>)?.name, row.week_start, row.total_hours, row.overtime_hours, row.status];
        case "risk":            return [row.reference_number, row.title, (row.owner as Record<string,unknown>)?.name, row.likelihood, row.impact, row.risk_score, row.status];
        case "governance":      return [row.meeting_title, row.meeting_type, row.meeting_date, row.status];
        case "assets":          return [row.asset_number, row.name, row.category, row.location, row.assigned_to, row.condition, row.acquisition_date];
        default: return [];
      }
    };
    const bodyRows = rows.map((r) => buildCells(r as Record<string, unknown>).map((v) => String(v ?? "")).map((v) => `<td>${v}</td>`).join("")).map((r) => `<tr>${r}</tr>`).join(""); // i18n-ignore
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t("reports.reportTitle", { module: moduleLabel })}</title><style>body{font-family:Arial,sans-serif;font-size:10pt;margin:20px}h2{font-size:13pt;margin-bottom:4px}p{font-size:9pt;color:#666;margin-bottom:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:9pt}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}@media print{body{margin:0}}</style></head><body><h2>${t("reports.printHeading", { module: moduleLabel })}</h2><p>${t("reports.printGenerated", { date, total })}</p><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`; // i18n-ignore
    openPrintPreview(html, "_blank", "width=900,height=700");
  }, [rows, module, activeModule, total, t]);

  const previewRows = rows?.slice(0, 10) ?? [];

  if (accessDenied) {
    return <AccessDenied path="/reports" reason={t("reports.accessDenied")} />;
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <ModulePageHeader
        title="nav.reports"
        subtitle="reports.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.reports" }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {canSchedule && (
        <section className="card p-5" aria-labelledby="scheduled-reports-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="scheduled-reports-heading" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("reports.schedule.title")}</h2>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t("reports.schedule.hint")}</p>
            </div>
            <span className="badge badge-muted">{t("reports.schedule.count", { count: schedules.length })}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label htmlFor="reports-name-setscheduleform-prev-placeholder-monthly-tr" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("reports.schedule.name")}
              <input id="reports-name-setscheduleform-prev-placeholder-monthly-tr" className="form-input mt-1 text-sm" value={scheduleForm.label} onChange={(event) => setScheduleForm((prev) => ({ ...prev, label: event.target.value }))} placeholder={t("reports.schedule.namePlaceholder")} />
            </label>
            <label htmlFor="reports-frequency-setscheduleform-prev-daily-weekly-mont" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("reports.schedule.frequency")}
              <select id="reports-frequency-setscheduleform-prev-daily-weekly-mont" className="form-input mt-1 text-sm" value={scheduleForm.frequency} onChange={(event) => setScheduleForm((prev) => ({ ...prev, frequency: event.target.value }))}>
                <option value="daily">{t("reports.schedule.daily")}</option><option value="weekly">{t("reports.schedule.weekly")}</option><option value="monthly">{t("reports.schedule.monthly")}</option>
              </select>
            </label>
            <label htmlFor="reports-format-setscheduleform-prev-csv-excel-pdf" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("reports.schedule.format")}
              <select id="reports-format-setscheduleform-prev-csv-excel-pdf" className="form-input mt-1 text-sm" value={scheduleForm.format} onChange={(event) => setScheduleForm((prev) => ({ ...prev, format: event.target.value }))}>
                <option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option>{/* i18n-ignore */}
              </select>
            </label>
            <label htmlFor="reports-recipients-setscheduleform-prev-placeholder-name" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{t("reports.schedule.recipients")}
              <input id="reports-recipients-setscheduleform-prev-placeholder-name" className="form-input mt-1 text-sm" value={scheduleForm.recipients} onChange={(event) => setScheduleForm((prev) => ({ ...prev, recipients: event.target.value }))} placeholder="name@example.org" />{/* i18n-ignore */}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary text-xs" onClick={submitSchedule}>{t("reports.schedule.submit")}</button>
            {scheduleNotice ? <span className="text-xs text-neutral-500 dark:text-neutral-400" role="status">{scheduleNotice}</span> : null}
          </div>
          {schedules.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table text-xs">
                <thead><tr><th>{t("reports.schedule.name")}</th><th>{t("reports.schedule.report")}</th><th>{t("reports.schedule.frequency")}</th><th>{t("reports.col.status")}</th><th>{t("reports.schedule.action")}</th></tr></thead>
                <tbody>{schedules.slice(0, 8).map((schedule, index) => (
                  <tr key={String(schedule.id ?? index)}>
                    <td>{String(schedule.label ?? "-")}</td><td>{String(schedule.report_key ?? "-")}</td><td className="capitalize">{String(schedule.frequency ?? "-")}</td>
                    <td><span className="badge badge-muted capitalize">{String(schedule.status ?? "-")}</span></td>
                    <td>{schedule.status === "requested" ? <button type="button" className="btn-secondary text-xs" onClick={() => { if (schedule.id) void changeScheduleStatus(Number(schedule.id), "approve"); }}>{t("common.approve")}</button> : schedule.status === "active" ? <button type="button" className="btn-secondary text-xs" onClick={() => { if (schedule.id) void changeScheduleStatus(Number(schedule.id), "pause"); }}>{t("reports.schedule.pause")}</button> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null}
          {exportEvents.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("reports.schedule.exportHistory")}</h3>
              <table className="data-table text-xs">
                <thead><tr><th>{t("reports.col.reference")}</th><th>{t("reports.schedule.report")}</th><th>{t("reports.col.status")}</th><th>{t("reports.schedule.rows")}</th><th>{t("reports.schedule.action")}</th></tr></thead>
                <tbody>{exportEvents.slice(0, 8).map((item, index) => (
                  <tr key={String(item.id ?? index)}>
                    <td className="font-mono">{String(item.reference ?? "-")}</td><td>{String(item.report_key ?? "-")}</td>
                    <td><span className="badge badge-muted capitalize">{String(item.status ?? "-")}</span></td><td>{String(item.rows_count ?? "-")}</td>
                    <td>{item.status === "completed" && item.id ? <button type="button" className="btn-secondary text-xs" onClick={async () => { const response = await reportsApi.downloadExport(Number(item.id)); downloadBlob(response.data as Blob, `${String(item.reference ?? "report-export")}.csv`); }}>{t("common.download")}</button> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}

      <div className="flex gap-5">
        {/* ── Left panel: module selector ───────────────────────────────────── */}
        <aside className="w-52 shrink-0">
          <div className="card overflow-hidden sticky top-4">
            {GROUPS.map((group) => {
              const mods = MODULES.filter((m) => m.group === group);
              return (
                <div key={group}>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{t(group)}</p>
                  {mods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setActiveModule(m.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        activeModule === m.key
                          ? "bg-primary text-white font-medium"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[17px] ${activeModule === m.key ? "text-white" : m.color}`}
                        style={{ fontVariationSettings: "'FILL' 0" }}
                      >
                        {m.icon}
                      </span>
                      {t(m.label)}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Right panel: filters + output ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filter bar */}
          <div className="card">
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-neutral-600 mr-1">{t("reports.fiscalYear")}</span>
                {FY_OPTIONS.map(({ label, fy }) => (
                  <button
                    key={fy}
                    type="button"
                    onClick={() => activeFy === fy ? clearFy() : setFiscalYear(fy)}
                    className={`filter-tab text-xs py-1 px-3 ${activeFy === fy ? "active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFy}
                  className={`filter-tab text-xs py-1 px-3 ${activeFy === null && (filters.period_from || filters.period_to) ? "active" : ""}`}
                >
                  {t("reports.custom")}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* Period from */}
                <div>
                  <label htmlFor="reports-from" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.from")}</label>
                  <input id="reports-from"
                    type="date"
                    className="form-input text-sm"
                    value={filters.period_from}
                    onChange={(e) => { setActiveFy(null); setFilters((f) => ({ ...f, period_from: e.target.value })); }}
                  />
                </div>
                {/* Period to */}
                <div>
                  <label htmlFor="reports-to" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.to")}</label>
                  <input id="reports-to"
                    type="date"
                    className="form-input text-sm"
                    value={filters.period_to}
                    onChange={(e) => { setActiveFy(null); setFilters((f) => ({ ...f, period_to: e.target.value })); }}
                  />
                </div>
                {/* Staff member (managers only) */}
                {isManager && (
                  <div>
                    <label htmlFor="reports-staff-member" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.staffMember")}</label>
                    <select id="reports-staff-member"
                      className="form-input text-sm"
                      value={filters.user_id}
                      onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
                    >
                      <option value="">{t("reports.allStaff")}</option>
                      {reportUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Department */}
                <div>
                  <label htmlFor="reports-department" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.department")}</label>
                  <select id="reports-department"
                    className="form-input text-sm"
                    value={filters.department_id}
                    onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">{t("reports.allDepartments")}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {/* Status */}
                {module.statusOptions.length > 0 && (
                  <div>
                    <label htmlFor="reports-status" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.status")}</label>
                    <select id="reports-status"
                      className="form-input text-sm"
                      value={filters.status}
                      onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="">{t("reports.allStatuses")}</option>
                      {module.statusOptions.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Governance: committee */}
                {activeModule === "governance" && (
                  <div>
                    <label htmlFor="reports-committee" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.committee")}</label>
                    <input id="reports-committee"
                      type="text"
                      className="form-input text-sm"
                      placeholder={t("reports.committeePlaceholder")}
                      value={filters.committee}
                      onChange={(e) => setFilters((f) => ({ ...f, committee: e.target.value }))}
                    />
                  </div>
                )}
                {/* Assets: category */}
                {activeModule === "assets" && (
                  <div>
                    <label htmlFor="reports-category" className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">{t("reports.col.category")}</label>
                    <select id="reports-category"
                      className="form-input text-sm"
                      value={filters.category}
                      onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">{t("reports.allCategories")}</option>
                      {assetCategories.map((c) => (
                        <option key={c.id} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-700/50">
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                  )}
                  {loading ? t("common.loading") : t("reports.generate")}
                </button>

                {canExport && rows !== null && activeModule !== "budget" && (
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={exporting}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {exporting ? (
                      <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[15px]">table_view</span>
                    )}
                    {exporting ? t("reports.exporting") : t("hr.appraisals.list.exportCsv")}
                  </button>
                )}

                {canExport && rows !== null && activeModule !== "budget" && (
                  <button
                    type="button"
                    onClick={exportXlsx}
                    disabled={exporting}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[15px]">grid_on</span>
                    {t("reports.exportExcel")}
                  </button>
                )}

                {canExport && rows !== null && activeModule !== "budget" && (
                  <button
                    type="button"
                    onClick={exportPdfFile}
                    disabled={exporting}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[15px] text-red-500">picture_as_pdf</span>
                    {t("reports.exportPdf")}
                  </button>
                )}

                {rows !== null && rows.length > 0 && (
                  <button
                    type="button"
                    onClick={exportPdf}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px] text-red-500">picture_as_pdf</span>
                    {t("reports.printPdf")}
                  </button>
                )}

                {rows !== null && (
                  <span className="ml-auto text-xs text-neutral-400">
                    {rows.length === 0 ? t("reports.noRecords") : t("reports.showingOf", { shown: Math.min(10, rows.length), total })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview table */}
          {rows !== null && rows.length === 0 && (
            <div className="card">
              <EmptyState icon="search_off" title="reports.noRecordsFiltered" />
            </div>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${module.color}`} style={{ fontVariationSettings: "'FILL' 0" }}>{module.icon}</span>
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t("reports.reportTitle", { module: t(module.label) })}</span>
                {(filters.period_from || filters.period_to) && (
                  <span className="ml-2 text-xs text-neutral-400">
                    {filters.period_from && t("reports.fromDate", { date: filters.period_from })} {filters.period_to && t("reports.toDate", { date: filters.period_to })}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      {module.columns.map((col) => <th key={col}>{t(col)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <PreviewRow key={i} moduleKey={activeModule} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <p className="px-5 py-2.5 text-xs text-neutral-400 border-t border-neutral-100">
                  {t("reports.showingOf", { shown: 10, total })}
                  {canExport && ` · ${t("reports.exportForFull")}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview row switcher ─────────────────────────────────────────────────────

function PreviewRow({ moduleKey, row }: { moduleKey: ModuleKey; row: Record<string, unknown> }) {
  switch (moduleKey) {
    case "travel":          return <TravelRow row={row} />;
    case "leave":           return <LeaveRow row={row} />;
    case "dsa":             return <DsaRow row={row} />;
    case "imprest":         return <ImprestRow row={row} />;
    case "procurement":     return <ProcurementRow row={row} />;
    case "salary-advances": return <SalaryAdvRow row={row} />;
    case "hr-timesheets":   return <TimesheetRow row={row} />;
    case "risk":            return <RiskRow row={row} />;
    case "governance":      return <GovernanceRow row={row} />;
    case "assets":          return <AssetRow row={row} />;
    case "budget": {
      const p = row as Record<string, unknown>;
      return (
        <tr>
          <td className="font-mono">{String(p.reference_number ?? "")}</td>
          <td className="max-w-[140px] truncate">{String(p.title ?? "")}</td>
          <td><span className="badge badge-muted capitalize">{String(p.status ?? "").replace(/_/g, " ")}</span></td>
          <td>{String(p.funding_source ?? "—")}</td>
          <td className="tabular-nums">{Number(p.total_budget ?? 0).toLocaleString()}</td>
          <td>{String(p.primary_currency ?? "")}</td>
          <td className="tabular-nums text-[11px]">{formatDateTable(String(p.end_date ?? ""))}</td>
        </tr>
      );
    }
  }
}
