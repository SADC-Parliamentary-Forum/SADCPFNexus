"use client";

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
import { formatDateTable } from "@/lib/utils";

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
  { key: "travel",          label: "Travel",           icon: "flight_takeoff",   color: "text-primary",    group: "Operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["Reference","Employee","Destination","Departure","Return","DSA","Status"] },
  { key: "leave",           label: "Leave",            icon: "event_available",  color: "text-green-600",  group: "Operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["Reference","Employee","Type","From","To","Days","Status"] },
  { key: "dsa",             label: "DSA Allowances",   icon: "paid",             color: "text-teal-600",   group: "Operational",      statusOptions: ["draft","submitted","approved","rejected"],            columns: ["Reference","Employee","Country","Departure","Return","Days","DSA","Status"] },
  { key: "imprest",         label: "Imprest",          icon: "account_balance_wallet", color: "text-orange-600", group: "Operational", statusOptions: ["draft","submitted","approved","rejected","liquidated"], columns: ["Reference","Employee","Purpose","Requested","Approved","Status","Liquidation Date"] },
  // Financial
  { key: "procurement",     label: "Procurement",      icon: "shopping_cart",    color: "text-blue-600",   group: "Financial",        statusOptions: ["draft","submitted","hod_approved","budget_reserved","approved","awarded","rejected"], columns: ["Reference","Employee","Title","Category","Method","Value","Status"] },
  { key: "salary-advances", label: "Salary Advances",  icon: "savings",          color: "text-purple-600", group: "Financial",        statusOptions: ["draft","submitted","approved","rejected"],            columns: ["Reference","Employee","Type","Amount","Months","Status"] },
  { key: "budget",          label: "Budget / Programmes", icon: "account_balance", color: "text-amber-600", group: "Financial",       statusOptions: [],                                                     columns: ["Programme","Title","Status","Funding","Budget","Currency","End Date"] },
  // HR
  { key: "hr-timesheets",   label: "HR Timesheets",    icon: "schedule",         color: "text-indigo-600", group: "HR",               statusOptions: ["draft","submitted","approved","rejected"],            columns: ["Employee","Week Start","Week End","Total Hrs","Overtime","Status"] },
  // Governance & Risk
  { key: "governance",      label: "Governance",       icon: "gavel",            color: "text-rose-600",   group: "Governance & Risk", statusOptions: ["draft","open","adopted","archived"],                columns: ["Reference","Title","Type","Committee","Status","Adopted"] },
  { key: "risk",            label: "Risk Register",    icon: "warning_amber",    color: "text-red-600",    group: "Governance & Risk", statusOptions: ["draft","submitted","reviewed","approved","monitoring","escalated","closed"], columns: ["Code","Title","Category","Department","Likelihood","Impact","Level","Owner","Status"] },
  // Assets
  { key: "assets",          label: "Assets",           icon: "inventory_2",      color: "text-teal-700",   group: "Assets",           statusOptions: ["active","under_maintenance","retired","disposed"],   columns: ["Code","Name","Category","Status","Age","Value"] },
];

const GROUPS = ["Operational", "Financial", "HR", "Governance & Risk", "Assets"];

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

function buildApiParams(filters: Filters, extra?: Record<string, string>) {
  const p: Record<string, string> = {};
  if (filters.period_from)  p.period_from  = filters.period_from;
  if (filters.period_to)    p.period_to    = filters.period_to;
  if (filters.user_id)      p.user_id      = filters.user_id;
  if (filters.department_id) p.department_id = filters.department_id;
  if (filters.status)       p.status       = filters.status;
  if (filters.committee)    p.committee    = filters.committee;
  if (filters.category)     p.category     = filters.category;
  return { ...p, ...extra, per_page: "50" };
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
  return (
    <tr>
      <td className="font-mono">{String(row.reference_number ?? "")}</td>
      <td>{String((row.requester as Record<string,string>)?.name ?? "—")}</td>
      <td className="capitalize">{String(row.advance_type ?? "").replace(/_/g, " ")}</td>
      <td className="tabular-nums">{String(row.currency ?? "NAD")} {Number(row.amount ?? 0).toLocaleString()}</td>
      <td>{String(row.repayment_months ?? "—")} mo</td>
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
      <td className="text-neutral-500">{String((row as Asset).age_display ?? "—")}</td>
      <td className="tabular-nums">{(row as Asset).current_value != null ? Number((row as Asset).current_value).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
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

  // Auth guard + load filter data
  useEffect(() => {
    const user = getStoredUser();
    if (!user || !hasPermission(user, "reports.view")) {
      router.replace("/dashboard");
      return;
    }
    setCanExport(hasPermission(user, "reports.export"));
    setIsManager(hasPermission(user, "reports.export"));

    reportsApi.users().then((r) => setReportUsers(r.data.data ?? [])).catch(() => {});
    reportsApi.departments().then((r) => setDepartments(r.data.data ?? [])).catch(() => {});
    assetCategoriesApi.list().then((r) => setAssetCategories(r.data.data ?? [])).catch(() => {});
  }, [router]);

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
      setError("Failed to load report data. Check your filters and try again.");
    } finally {
      setLoading(false);
    }
  }, [activeModule, filters]);

  const exportCsv = useCallback(async () => {
    if (!canExport) return;
    setExporting(true);
    setError(null);
    try {
      const params = buildApiParams(filters, { format: "csv" });
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
      downloadBlob(res.data as Blob, `${activeModule}-report-${date}.csv`);
    } catch {
      setError("Export failed. You may not have permission to export reports.");
    } finally {
      setExporting(false);
    }
  }, [activeModule, filters, canExport]);

  const exportPdf = useCallback(() => {
    if (!rows || rows.length === 0 || !module) return;
    const date = new Date().toLocaleDateString("en-GB");
    const headers = module.columns;
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
    const bodyRows = rows.map((r) => buildCells(r as Record<string, unknown>).map((v) => String(v ?? "")).map((v) => `<td>${v}</td>`).join("")).map((r) => `<tr>${r}</tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${module.label} Report</title><style>body{font-family:Arial,sans-serif;font-size:10pt;margin:20px}h2{font-size:13pt;margin-bottom:4px}p{font-size:9pt;color:#666;margin-bottom:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:9pt}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}@media print{body{margin:0}}</style></head><body><h2>SADC Parliamentary Forum — ${module.label} Report</h2><p>Generated: ${date} · ${total} records</p><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => { win.print(); }, 400); }
  }, [rows, module, activeModule, total]);

  const previewRows = rows?.slice(0, 10) ?? [];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Generate, filter, and export reports across all modules. Use the fiscal year selector for annual audit periods.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="flex gap-5">
        {/* ── Left panel: module selector ───────────────────────────────────── */}
        <aside className="w-52 shrink-0">
          <div className="card overflow-hidden sticky top-4">
            {GROUPS.map((group) => {
              const mods = MODULES.filter((m) => m.group === group);
              return (
                <div key={group}>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group}</p>
                  {mods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setActiveModule(m.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                        activeModule === m.key
                          ? "bg-primary text-white font-medium"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[17px] ${activeModule === m.key ? "text-white" : m.color}`}
                        style={{ fontVariationSettings: "'FILL' 0" }}
                      >
                        {m.icon}
                      </span>
                      {m.label}
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
                <span className="text-xs font-semibold text-neutral-600 mr-1">Fiscal Year:</span>
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
                  Custom
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* Period from */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">From</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={filters.period_from}
                    onChange={(e) => { setActiveFy(null); setFilters((f) => ({ ...f, period_from: e.target.value })); }}
                  />
                </div>
                {/* Period to */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">To</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={filters.period_to}
                    onChange={(e) => { setActiveFy(null); setFilters((f) => ({ ...f, period_to: e.target.value })); }}
                  />
                </div>
                {/* Staff member (managers only) */}
                {isManager && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Staff Member</label>
                    <select
                      className="form-input text-sm"
                      value={filters.user_id}
                      onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
                    >
                      <option value="">All staff</option>
                      {reportUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Department</label>
                  <select
                    className="form-input text-sm"
                    value={filters.department_id}
                    onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {/* Status */}
                {module.statusOptions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Status</label>
                    <select
                      className="form-input text-sm"
                      value={filters.status}
                      onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="">All statuses</option>
                      {module.statusOptions.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Governance: committee */}
                {activeModule === "governance" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Committee</label>
                    <input
                      type="text"
                      className="form-input text-sm"
                      placeholder="e.g. ExCo"
                      value={filters.committee}
                      onChange={(e) => setFilters((f) => ({ ...f, committee: e.target.value }))}
                    />
                  </div>
                )}
                {/* Assets: category */}
                {activeModule === "assets" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
                    <select
                      className="form-input text-sm"
                      value={filters.category}
                      onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">All categories</option>
                      {assetCategories.map((c) => (
                        <option key={c.id} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
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
                  {loading ? "Loading…" : "Generate Report"}
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
                    {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                )}

                {rows !== null && rows.length > 0 && (
                  <button
                    type="button"
                    onClick={exportPdf}
                    className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px] text-red-500">picture_as_pdf</span>
                    Print / PDF
                  </button>
                )}

                {rows !== null && (
                  <span className="ml-auto text-xs text-neutral-400">
                    {rows.length === 0 ? "No records found" : `Showing ${Math.min(10, rows.length)} of ${total} records`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview table */}
          {rows !== null && rows.length === 0 && (
            <div className="card px-5 py-10 text-center text-sm text-neutral-400">
              <span className="material-symbols-outlined text-4xl block mb-2 text-neutral-300">search_off</span>
              No records found for the selected filters.
            </div>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${module.color}`} style={{ fontVariationSettings: "'FILL' 0" }}>{module.icon}</span>
                <span className="text-sm font-semibold text-neutral-800">{module.label} Report</span>
                {(filters.period_from || filters.period_to) && (
                  <span className="ml-2 text-xs text-neutral-400">
                    {filters.period_from && `From ${filters.period_from}`} {filters.period_to && `to ${filters.period_to}`}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      {module.columns.map((col) => <th key={col}>{col}</th>)}
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
                  Showing 10 of {total} records
                  {canExport && " · Export CSV for full data"}
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
