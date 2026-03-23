"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { governanceConfigApi, auditApi, type GovernanceConfig, type AuditLogEntry } from "@/lib/api";

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-neutral-200"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

const AUDIT_STATUS: Record<string, string> = {
  "Approved": "bg-green-100 text-green-700 border-green-200",
  "Blocked": "bg-red-100 text-red-700 border-red-200",
  "Flagged": "bg-amber-100 text-amber-700 border-amber-200",
};
const AUDIT_DOT: Record<string, string> = { "Approved": "bg-green-500", "Blocked": "bg-red-500", "Flagged": "bg-amber-500" };

const DEFAULTS: GovernanceConfig = {
  datasets: { census: true, tax: true, infra: true, personnel: false },
  redaction: { maskSSN: true, generalizeLocation: true, hideIncome: false, obscureNames: true },
  formats: { csv: true, pdf: true, json: false, xlsx: false },
  retention_days: 30,
  min_group_size: 15,
  granularity: "Weekly",
  variance_limit: 5,
};

export default function AdminGovernanceConfigPage() {
  const [config, setConfig] = useState<GovernanceConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    governanceConfigApi.get()
      .then((res) => setConfig({ ...DEFAULTS, ...res.data }))
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));

    auditApi.list({ per_page: 4 })
      .then((res) => setRecentLogs(res.data.data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await governanceConfigApi.update(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const update = (key: keyof GovernanceConfig, val: unknown) => setConfig((c) => ({ ...c, [key]: val }));

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-neutral-100 rounded" />
        <div className="h-64 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-neutral-900 font-medium">Governance Configuration</span>
          </div>
          <h1 className="page-title">Governance Configuration</h1>
          <p className="page-subtitle text-neutral-500 max-w-2xl">Manage institutional data policies, aggregation thresholds, and access controls for the platform.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setConfig(DEFAULTS)} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>Reset
          </button>
          <button onClick={handleSave} disabled={saving} className={`btn-primary px-5 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-60 ${saved ? "!bg-green-600" : ""}`}>
            {saving ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">{saved ? "check" : "save"}</span>
            )}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Datasets */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><span className="material-symbols-outlined">folder_shared</span></div>
              <div><h2 className="font-bold text-neutral-900">Allowed Datasets</h2><p className="text-xs text-neutral-500">Define which data classes are accessible to standard queries.</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: "census", label: "Finance Records 2024", badge: "Class A", badgeColor: "bg-blue-100 text-blue-700" },
                { key: "tax", label: "HR Records Q1-Q4", badge: "Class B", badgeColor: "bg-purple-100 text-purple-700" },
                { key: "infra", label: "Procurement Logs", badge: "Public", badgeColor: "bg-green-100 text-green-700" },
                { key: "personnel", label: "Personnel Records", badge: "Restricted", badgeColor: "bg-red-100 text-red-700" },
              ]).map(({ key, label, badge, badgeColor }) => (
                <label key={key} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:border-primary/50 ${config.datasets[key] ? "border-primary/30 bg-primary/5" : "border-neutral-100 bg-neutral-50"}`}>
                  <input type="checkbox" checked={!!config.datasets[key]} onChange={() => update("datasets", { ...config.datasets, [key]: !config.datasets[key] })} className="h-5 w-5 rounded border-neutral-300 text-primary focus:ring-primary/20" />
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{label}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><span className="material-symbols-outlined">groups</span></div>
              <div><h2 className="font-bold text-neutral-900">Aggregation Thresholds</h2><p className="text-xs text-neutral-500">Set limits to prevent identification of individuals in reports.</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Min Group Size</label>
                <div className="relative">
                  <input type="number" value={config.min_group_size} onChange={(e) => update("min_group_size", Number(e.target.value))} className="form-input pr-12" />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 text-xs pointer-events-none">pax</div>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Groups smaller than this are suppressed.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Time Granularity</label>
                <select className="form-input" value={config.granularity} onChange={(e) => update("granularity", e.target.value)}>
                  {["Daily", "Weekly", "Monthly", "Quarterly"].map((g) => <option key={g}>{g}</option>)}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">Minimum time window for data buckets.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Variance Limit (%)</label>
                <input type="number" value={config.variance_limit} onChange={(e) => update("variance_limit", Number(e.target.value))} className="form-input" />
                <p className="text-[11px] text-neutral-400 mt-1">Acceptable deviation for noise injection.</p>
              </div>
            </div>
          </div>

          {/* Audit Log (live from API) */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><span className="material-symbols-outlined">history</span></div>
                <div><h2 className="font-bold text-neutral-900">Recent System Activity</h2><p className="text-xs text-neutral-500">Latest audit log entries from the platform.</p></div>
              </div>
              <Link href="/admin/audit" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View Full Audit<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Record</th></tr></thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-neutral-400 text-xs">No audit entries available</td></tr>
                  ) : recentLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="font-mono text-xs text-neutral-400 whitespace-nowrap">{l.timestamp}</td>
                      <td className="text-xs text-neutral-700">{l.user}</td>
                      <td><span className="badge badge-muted">{l.action}</span></td>
                      <td className="text-neutral-600">{l.module}</td>
                      <td className="font-mono text-xs text-neutral-400">{l.record_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Redaction Rules */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><span className="material-symbols-outlined">visibility_off</span></div>
              <div><h2 className="font-bold text-neutral-900">Redaction Rules</h2><p className="text-xs text-neutral-500">Automatic field masking for PII.</p></div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-2">Class A Data</p>
              {([
                { key: "maskSSN", label: "Mask National IDs", sub: "Replace with XXXXX-####" },
                { key: "generalizeLocation", label: "Generalize Location", sub: "Region/District level only" },
              ]).map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                  <div><p className="text-sm font-semibold text-neutral-900">{label}</p><p className="text-xs text-neutral-400">{sub}</p></div>
                  <Toggle checked={!!config.redaction[key]} onChange={() => update("redaction", { ...config.redaction, [key]: !config.redaction[key] })} />
                </div>
              ))}
              <p className="text-xs font-bold uppercase text-neutral-400 tracking-wider mt-4 mb-2">Class B Data</p>
              {([
                { key: "hideIncome", label: "Hide Exact Income", sub: "Use income brackets" },
                { key: "obscureNames", label: "Obscure Names", sub: "Use Employee ID only" },
              ]).map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-neutral-50">
                  <div><p className="text-sm font-semibold text-neutral-900">{label}</p><p className="text-xs text-neutral-400">{sub}</p></div>
                  <Toggle checked={!!config.redaction[key]} onChange={() => update("redaction", { ...config.redaction, [key]: !config.redaction[key] })} />
                </div>
              ))}
            </div>
          </div>

          {/* Export Policies */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><span className="material-symbols-outlined">file_download</span></div>
              <div><h2 className="font-bold text-neutral-900">Export Policies</h2><p className="text-xs text-neutral-500">Approved formats and destinations.</p></div>
            </div>
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                <p className="text-sm font-bold text-neutral-900 mb-3">Allowed Formats</p>
                <div className="flex flex-wrap gap-2">
                  {(["csv", "pdf", "json", "xlsx"] as const).map((fmt) => (
                    <button key={fmt} onClick={() => update("formats", { ...config.formats, [fmt]: !config.formats[fmt] })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${config.formats[fmt] ? "bg-primary text-white border-primary" : "bg-white text-neutral-700 border-neutral-300 hover:border-primary/50"}`}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">Retention Period: <span className="text-primary font-bold">{config.retention_days} days</span></label>
                <input type="range" min={1} max={90} value={config.retention_days} onChange={(e) => update("retention_days", Number(e.target.value))} className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                <p className="text-xs text-neutral-400 mt-1">Days before export logs are purged.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
