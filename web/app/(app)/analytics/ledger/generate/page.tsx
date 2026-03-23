"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MODULES = ["Procurement & Sourcing", "Human Resources & Payroll", "Treasury & Risk", "Travel & Missions", "Leave Management", "Assets & Inventory"];

type Scope = "global" | "module" | "user";
type Format = "pdf" | "excel";

export default function GenerateLedgerReportPage() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("global");
  const [module, setModule] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [events, setEvents] = useState({ access: true, change: true, deletion: false });
  const [format, setFormat] = useState<Format>("pdf");
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1800));
    setGenerating(false);
    setDone(true);
    setTimeout(() => router.push("/analytics/ledger"), 1500);
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Report Generated!</h2>
        <p className="text-sm text-neutral-500">Redirecting to ledger dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <nav className="flex items-center text-sm text-neutral-500 mb-2 gap-1">
          <Link href="/analytics" className="hover:text-primary transition-colors">Analytics</Link>
          <span className="material-symbols-outlined text-base">chevron_right</span>
          <Link href="/analytics/ledger" className="hover:text-primary transition-colors">Audit Ledger</Link>
          <span className="material-symbols-outlined text-base">chevron_right</span>
          <span className="text-neutral-800 font-medium">Generate Report</span>
        </nav>
        <h1 className="page-title">Generate Ledger Report</h1>
        <p className="page-subtitle">Configure scope, period, and output format for your audit report.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main form */}
        <main className="flex-1 space-y-8">
          {/* 1. Scope */}
          <section className="space-y-4">
            <h3 className="font-semibold text-neutral-900 text-base">1. Report Scope</h3>
            <div className="space-y-3">
              {([
                { value: "global", label: "Global Scope", desc: "Comprehensive report covering the entire organization ledger. Requires executive approval for export.", icon: "public" },
                { value: "module", label: "Module Specific", desc: "Report limited to a specific functional module (e.g., Procurement, HR, Treasury).", icon: "view_module" },
                { value: "user",   label: "User Specific",   desc: "Targeted audit trail of a specific user's activity log within the selected timeframe.", icon: "person_search" },
              ] as { value: Scope; label: string; desc: string; icon: string }[]).map(opt => (
                <label key={opt.value} className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all ${scope === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:border-primary/40"}`}>
                  <input type="radio" name="scope" className="mt-0.5 h-4 w-4 text-primary" value={opt.value} checked={scope === opt.value} onChange={() => setScope(opt.value)} />
                  <div className="flex grow flex-col gap-0.5">
                    <span className="font-medium text-neutral-900">{opt.label}</span>
                    <span className="text-sm text-neutral-500">{opt.desc}</span>
                  </div>
                  <span className="material-symbols-outlined text-neutral-400">{opt.icon}</span>
                </label>
              ))}
            </div>

            {scope === "module" && (
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Select Target Module</label>
                <select className="form-input" value={module} onChange={e => setModule(e.target.value)}>
                  <option value="">Choose a module…</option>
                  {MODULES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            )}
          </section>

          <hr className="border-neutral-200" />

          {/* 2 & 3: Period + Event types */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h3 className="font-semibold text-neutral-900 text-base">2. Reporting Period</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">From Date</label>
                  <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">To Date</label>
                  <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="material-symbols-outlined text-blue-500 text-sm mt-0.5">info</span>
                <span className="text-xs text-blue-700">Historical data older than 7 years must be requested from the Archive Retrieval System.</span>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold text-neutral-900 text-base">3. Event Types</h3>
              <div className="space-y-3">
                {([
                  { key: "access",   label: "Access Logs",     hint: "Login, View"       },
                  { key: "change",   label: "Change Events",   hint: "Create, Update"    },
                  { key: "deletion", label: "Deletion Events", hint: "Soft/Hard Delete"  },
                ] as { key: keyof typeof events; label: string; hint: string }[]).map(ev => (
                  <label key={ev.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded h-4 w-4 text-primary border-neutral-300"
                      checked={events[ev.key]}
                      onChange={e => setEvents({ ...events, [ev.key]: e.target.checked })}
                    />
                    <span className="text-neutral-700 font-medium text-sm">{ev.label}</span>
                    <span className="text-xs text-neutral-400 ml-auto">{ev.hint}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <hr className="border-neutral-200" />

          {/* 4. Output format */}
          <section className="space-y-4">
            <h3 className="font-semibold text-neutral-900 text-base">4. Output Format</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${format === "pdf" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                <input type="radio" name="format" className="h-4 w-4 text-primary" checked={format === "pdf"} onChange={() => setFormat("pdf")} />
                <div className="flex flex-col">
                  <span className="font-semibold text-neutral-900 text-sm">Secured PDF</span>
                  <span className="text-xs text-neutral-500">Digital Signature included</span>
                </div>
                <span className="material-symbols-outlined text-red-500 text-3xl ml-auto">picture_as_pdf</span>
              </label>
              <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${format === "excel" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                <input type="radio" name="format" className="h-4 w-4 text-primary" checked={format === "excel"} onChange={() => setFormat("excel")} />
                <div className="flex flex-col">
                  <span className="font-semibold text-neutral-900 text-sm">Excel Workbook</span>
                  <span className="text-xs text-neutral-500">Raw data for analysis</span>
                </div>
                <span className="material-symbols-outlined text-green-600 text-3xl ml-auto">table_view</span>
              </label>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-neutral-200">
            <Link href="/analytics/ledger" className="btn-secondary">Cancel</Link>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary flex items-center gap-2 disabled:opacity-70"
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Generating…
                </>
              ) : (
                <>
                  Next Step
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex flex-col gap-6 shrink-0">
          {/* Policy notice */}
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-5">
            <div className="flex items-center gap-2 mb-3 text-orange-700">
              <span className="material-symbols-outlined text-lg">warning</span>
              <h4 className="font-bold text-sm uppercase tracking-wide">Policy Notice</h4>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed mb-3">
              All report generation activities are strictly logged for audit purposes. Accessing sensitive ledger data without a valid business case constitutes a Level 2 violation.
            </p>
            <p className="text-xs text-orange-700 font-medium">Reference: COMP-POL-2023-04</p>
          </div>

          {/* Session metadata */}
          <div className="card p-5 space-y-4">
            <h4 className="font-bold text-neutral-700 text-xs uppercase tracking-wide border-b border-neutral-100 pb-2">Session Metadata</h4>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-neutral-400 text-xs">Compliance Ref</span>
                <span className="font-mono text-neutral-800">AUD-2026-X99</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-neutral-400 text-xs">Request ID</span>
                <span className="font-mono text-neutral-800">REQ-84720</span>
              </div>
              <div className="flex flex-col gap-0.5 col-span-2">
                <span className="text-neutral-400 text-xs">Authorized By</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-neutral-800">System Admin (Auto)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="rounded-xl bg-primary/5 p-5 border border-primary/10">
            <h4 className="font-bold text-primary text-sm mb-2">Need Assistance?</h4>
            <p className="text-neutral-500 text-xs mb-3">If you are unsure about the scope parameters, consult the Data Governance handbook.</p>
            <a href="#" className="text-primary text-xs font-semibold hover:underline flex items-center gap-1">
              View Handbook <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
