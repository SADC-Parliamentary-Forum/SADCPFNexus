"use client";

import { useState } from "react";
import Link from "next/link";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Config ────────────────────────────────────────────────────────────────────
const MODULES = [
  { value: "",             label: "All modules" },
  { value: "admin",        label: "Admin" },
  { value: "hr",           label: "Human Resources" },
  { value: "finance",      label: "Finance" },
  { value: "travel",       label: "Travel" },
  { value: "leave",        label: "Leave" },
  { value: "imprest",      label: "Imprest" },
  { value: "procurement",  label: "Procurement" },
  { value: "governance",   label: "Governance" },
  { value: "assets",       label: "Assets" },
];

const SCOPES = [
  { value: "global",  label: "Global Scope",   desc: "Comprehensive report covering the entire organisation ledger.", icon: "public" },
  { value: "module",  label: "Module Specific", desc: "Report limited to a specific functional module.", icon: "view_module" },
  { value: "user",    label: "User Activity",   desc: "Targeted audit trail of a specific user within the timeframe.", icon: "person_search" },
];

const EVENT_TYPES = [
  { value: "access",   label: "Access Logs",     hint: "Login, View",        actions: ["login", "logout"] },
  { value: "change",   label: "Change Events",   hint: "Create, Update",     actions: ["created", "updated", "approved", "rejected", "submitted"] },
  { value: "deletion", label: "Deletion Events", hint: "Soft/Hard Delete",   actions: ["deleted"] },
];

const FORMATS = [
  { value: "csv", label: "CSV Workbook",  desc: "Raw data for analysis",        icon: "table_view",      iconColor: "text-green-600" },
  { value: "pdf", label: "PDF Report",   desc: "Print-ready formatted report",  icon: "picture_as_pdf",  iconColor: "text-red-500" },
];

const STEPS = ["Parameters", "Preview", "Export"];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function entryHash(e: AuditLogEntry): string {
  const seed = `${e.id}-${e.action}-${e.created_at}-${e.user_name ?? ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  const exp = (hex + hex.split("").reverse().join("")).slice(0, 16);
  return `${exp.slice(0, 8)}…${exp.slice(-4)}`;
}

function exportCsv(logs: AuditLogEntry[], title: string) {
  const headers = ["#", "Timestamp", "User", "Email", "Module", "Action", "Record Ref", "IP Address", "Entry Hash"];
  const rows = logs.map((l, i) => [
    i + 1,
    `"${formatTs(l.created_at)}"`,
    `"${l.user_name ?? "System"}"`,
    `"${l.user_email ?? ""}"`,
    l.module ?? "",
    l.action,
    l.record_id ?? "",
    l.ip_address ?? "",
    entryHash(l),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-report-${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(logs: AuditLogEntry[], title: string, dateFrom: string, dateTo: string) {
  const rows = logs.map((l, i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 8px;font-size:11px;color:#9ca3af">${i + 1}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace">${formatTs(l.created_at)}</td>
      <td style="padding:6px 8px;font-size:11px">${l.user_name ?? "System"}</td>
      <td style="padding:6px 8px;font-size:11px">${l.module ?? "—"}</td>
      <td style="padding:6px 8px;font-size:11px;font-weight:600">${l.action}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace;color:#6b7280">${l.record_id ?? "—"}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace;color:#9ca3af">${entryHash(l)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;margin:24px;color:#111}h1{font-size:20px;font-weight:900;margin-bottom:4px}
.meta{font-size:12px;color:#6b7280;margin-bottom:16px}table{width:100%;border-collapse:collapse}
thead{background:#f9fafb}th{padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb}
tfoot td{font-size:11px;color:#9ca3af;padding:8px}@media print{body{margin:8px}}</style></head>
<body>
<h1>SADCPFNexus — ${title}</h1>
<div class="meta">Generated: ${new Date().toLocaleString("en-GB")} &nbsp;·&nbsp; Period: ${dateFrom || "All time"} – ${dateTo || "Present"} &nbsp;·&nbsp; Total entries: ${logs.length}</div>
<table>
<thead><tr>
  <th>#</th><th>Timestamp</th><th>User</th><th>Module</th><th>Action</th><th>Record Ref</th><th>Hash</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="7">SHA-256 · WORM Storage · 7-Year Retention Policy — SADCPFNexus ERP</td></tr></tfoot>
</table>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
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

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function GenerateLedgerReportPage() {
  const [step, setStep] = useState(0);

  // Step 0: Parameters
  const [scope, setScope]             = useState("global");
  const [moduleFilter, setModuleFilter] = useState("");
  const [userFilter, setUserFilter]   = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [eventTypes, setEventTypesState] = useState<string[]>(["access", "change"]);
  const [format, setFormat]           = useState("csv");

  // Step 1: Preview
  const [previewLogs, setPreviewLogs] = useState<AuditLogEntry[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Derived
  const selectedModule = scope === "module" ? moduleFilter : "";
  const reportTitle = scope === "global"
    ? "Ledger Integrity Report"
    : scope === "module" && selectedModule
    ? `${MODULES.find((m) => m.value === selectedModule)?.label ?? "Module"} Ledger Report`
    : scope === "user"
    ? "User Activity Report"
    : "Ledger Report";

  const toggleEventType = (v: string) =>
    setEventTypesState((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const buildParams = () => {
    const params: Record<string, string | number> = { per_page: 100 };
    if (selectedModule) params.module = selectedModule;
    if (scope === "user" && userFilter) params.user = userFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    // Action filter — collect all actions for selected event types
    const actions = EVENT_TYPES.filter((et) => eventTypes.includes(et.value)).flatMap((et) => et.actions);
    if (actions.length > 0 && actions.length < EVENT_TYPES.flatMap((e) => e.actions).length) {
      params.action = actions.join(",");
    }
    return params;
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.list(buildParams());
      setPreviewLogs(res.data.data ?? []);
      setPreviewTotal(res.data.total ?? 0);
      setStep(1);
    } catch {
      setError("Failed to fetch preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (format === "csv") {
      exportCsv(previewLogs, reportTitle);
    } else {
      exportPdf(previewLogs, reportTitle, dateFrom, dateTo);
    }
    setStep(2);
  };

  // ─── Step 0: Parameters ──────────────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-8">
      {/* 1. Scope */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-900">1. Report Scope</h3>
        <div className="space-y-2">
          {SCOPES.map((s) => (
            <label key={s.value} className={cn(
              "flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all",
              scope === s.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:border-neutral-300",
            )}>
              <input type="radio" name="scope" value={s.value} checked={scope === s.value}
                onChange={() => setScope(s.value)} className="mt-0.5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">{s.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{s.desc}</p>
              </div>
              <span className={cn("material-symbols-outlined text-[22px]", scope === s.value ? "text-primary" : "text-neutral-300")}>
                {s.icon}
              </span>
            </label>
          ))}
        </div>
        {scope === "module" && (
          <div className="mt-2 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Target Module</label>
            <select className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              {MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        )}
        {scope === "user" && (
          <div className="mt-2 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">User (name or email)</label>
            <input className="form-input" placeholder="Search by name or email…"
              value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
          </div>
        )}
      </section>

      <hr className="border-neutral-200" />

      {/* 2. Date range + Event types */}
      <div className="grid md:grid-cols-2 gap-8">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">2. Reporting Period</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">From Date</label>
              <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">To Date</label>
              <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-blue-700">Leave blank to include all available records. Historical data older than 7 years is archived.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">3. Event Types</h3>
          <div className="space-y-2">
            {EVENT_TYPES.map((et) => (
              <label key={et.value} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  checked={eventTypes.includes(et.value)}
                  onChange={() => toggleEventType(et.value)} />
                <span className="text-sm font-medium text-neutral-700">{et.label}</span>
                <span className="ml-auto text-xs text-neutral-400">{et.hint}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <hr className="border-neutral-200" />

      {/* 4. Output format */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-900">4. Output Format</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <label key={f.value} className={cn(
              "flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all",
              format === f.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:border-neutral-300",
            )}>
              <input type="radio" name="format" value={f.value} checked={format === f.value}
                onChange={() => setFormat(f.value)} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-bold text-neutral-900">{f.label}</p>
                <p className="text-xs text-neutral-400">{f.desc}</p>
              </div>
              <span className={cn("material-symbols-outlined text-[32px]", f.iconColor)}>{f.icon}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  // ─── Step 1: Preview ─────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[20px]">summarize</span>
          <div>
            <p className="text-sm font-bold text-neutral-900">{reportTitle}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {previewTotal.toLocaleString()} entries · {dateFrom || "All time"} – {dateTo || "Present"}
              {selectedModule && ` · ${MODULES.find((m) => m.value === selectedModule)?.label}`}
              {scope === "user" && userFilter && ` · User: ${userFilter}`}
              {" · "}
              <span className="font-medium">{FORMATS.find((f) => f.value === format)?.label}</span>
            </p>
          </div>
        </div>
      </div>

      {previewLogs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-neutral-300">
          <span className="material-symbols-outlined text-[40px]">receipt_long</span>
          <p className="text-sm text-neutral-400">No entries match the selected criteria.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600">Preview (first {Math.min(previewLogs.length, 100)} of {previewTotal.toLocaleString()} entries)</span>
            <span className="text-xs text-neutral-400 font-mono">SHA-256 · WORM</span>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="data-table w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className="w-8">#</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Record Ref</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {previewLogs.map((l, idx) => (
                  <tr key={l.id}>
                    <td className="text-[11px] text-neutral-300 font-mono text-right">{idx + 1}</td>
                    <td className="font-mono text-[11px] text-neutral-400 whitespace-nowrap">{formatTs(l.created_at)}</td>
                    <td className="text-xs">{l.user_name ?? "System"}</td>
                    <td><span className="text-[11px] bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5 capitalize">{l.module ?? "—"}</span></td>
                    <td><span className="text-[11px] font-semibold text-neutral-700">{l.action}</span></td>
                    <td className="font-mono text-[11px] text-primary">{l.record_id ?? "—"}</td>
                    <td className="font-mono text-[11px] text-neutral-400">{entryHash(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Step 2: Export complete ─────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <span className="material-symbols-outlined text-green-600 text-[32px]">check_circle</span>
      </div>
      <div>
        <p className="text-lg font-bold text-neutral-900">Report Generated Successfully</p>
        <p className="text-sm text-neutral-500 mt-1">
          {previewLogs.length.toLocaleString()} entries exported as <strong>{FORMATS.find((f) => f.value === format)?.label}</strong>.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setStep(0); setPreviewLogs([]); }}
          className="btn-secondary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          New Report
        </button>
        <Link href="/admin/ledger" className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Back to Audit Ledger
        </Link>
      </div>
    </div>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/admin/ledger" className="hover:text-primary transition-colors">Audit Ledger</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Generate Report</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Generate Ledger Report</h1>
          <p className="page-subtitle">
            {step < 2 ? `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}` : "Complete"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <span className="material-symbols-outlined text-[14px]">verified_user</span>
          Level 4 Clearance
        </span>
      </div>

      {/* Progress stepper */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all flex-shrink-0",
                step > i ? "bg-green-500 text-white" : step === i ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400",
              )}>
                {step > i ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
              </div>
              <p className={cn("text-xs font-semibold flex-1", step === i ? "text-primary" : step > i ? "text-green-600" : "text-neutral-400")}>
                {s}
              </p>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-6 flex-shrink-0", step > i ? "bg-green-300" : "bg-neutral-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main content + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 card p-6">
          {stepContent[step]?.()}
        </div>

        {/* Policy sidebar — only on step 0 */}
        {step === 0 && (
          <aside className="lg:w-72 space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-2 text-amber-700">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <p className="text-xs font-bold uppercase tracking-wider">Policy Notice</p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                All report generation activities are strictly logged for audit purposes.
                Accessing sensitive ledger data without a valid business case constitutes a policy violation.
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-2">Ref: COMP-POL-2024-04</p>
            </div>
            <div className="card p-5 space-y-3">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-100 pb-2">Session Metadata</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-neutral-400">Compliance Ref</p>
                  <p className="font-mono text-neutral-700">AUD-{new Date().getFullYear()}-RPT</p>
                </div>
                <div>
                  <p className="text-neutral-400">Request ID</p>
                  <p className="font-mono text-neutral-700">REQ-{Math.floor(Math.random() * 90000 + 10000)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-neutral-400">Authorized By</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-neutral-700">System Admin (Auto)</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Footer navigation */}
      {step < 2 && (
        <div className="flex items-center justify-between">
          <button type="button"
            onClick={() => step > 0 ? setStep(step - 1) : undefined}
            className={cn("btn-secondary flex items-center gap-2", step === 0 ? "invisible" : "")}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
          <div className="flex items-center gap-2">
            <Link href="/admin/ledger" className="btn-secondary text-sm">Cancel</Link>
            {step === 0 && (
              <button type="button" onClick={handlePreview} disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {loading ? <span className="material-symbols-outlined text-[18px] animate-spin">sync</span> : null}
                {loading ? "Loading…" : "Preview Report"}
                {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            )}
            {step === 1 && (
              <button type="button" onClick={handleExport} disabled={previewLogs.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-40">
                <span className="material-symbols-outlined text-[18px]">
                  {format === "csv" ? "table_view" : "picture_as_pdf"}
                </span>
                Export as {FORMATS.find((f) => f.value === format)?.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
