"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { conductApi, tenantUsersApi, type ConductRecord, type TenantUserOption } from "@/lib/api";

const RECORD_TYPE_LABELS: Record<string, string> = {
  commendation: "Commendation",
  verbal_counseling: "Verbal counseling",
  written_warning: "Written warning",
  final_warning: "Final warning",
  suspension: "Suspension",
  dismissal: "Dismissal",
  performance_improvement: "Performance improvement",
};

const RECORD_TYPE_CLS: Record<string, string> = {
  commendation: "bg-green-100 text-green-800 border-green-200",
  verbal_counseling: "bg-amber-100 text-amber-800 border-amber-200",
  written_warning: "bg-orange-100 text-orange-800 border-orange-200",
  final_warning: "bg-red-100 text-red-800 border-red-200",
  suspension: "bg-red-100 text-red-800 border-red-200",
  dismissal: "bg-red-100 text-red-800 border-red-200",
  performance_improvement: "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  under_appeal: "Under appeal",
  resolved: "Resolved",
  closed: "Closed",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function UserAutocomplete({
  label,
  value,
  onSelect,
  required,
}: {
  label: string;
  value: TenantUserOption | null;
  onSelect: (u: TenantUserOption | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await tenantUsersApi.list({ search: query });
        setOptions((r.data as { data?: TenantUserOption[] }).data ?? (Array.isArray(r.data) ? r.data as unknown as TenantUserOption[] : []));
      } catch { setOptions([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        type="text"
        className="form-input w-full"
        placeholder="Type name to search…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-neutral-400">Searching…</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400">No users found</div>
          ) : options.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center gap-2"
              onMouseDown={(e) => { e.preventDefault(); onSelect(u); setQuery(u.name); setOpen(false); }}
            >
              <span className="font-medium text-neutral-800">{u.name}</span>
              <span className="text-neutral-400 text-xs">{u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConductPage() {
  const [list, setList] = useState<ConductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // New conduct record modal
  const [showNew, setShowNew] = useState(false);
  const [newEmployee, setNewEmployee] = useState<TenantUserOption | null>(null);
  const [newRecordType, setNewRecordType] = useState("commendation");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIssueDate, setNewIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [newIncidentDate, setNewIncidentDate] = useState("");
  const [newIsConfidential, setNewIsConfidential] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { per_page: number; page: number; record_type?: string; status?: string } = {
        per_page: 20,
        page,
      };
      if (recordTypeFilter) params.record_type = recordTypeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await conductApi.list(params);
      const payload = res.data as { data?: ConductRecord[]; current_page?: number; last_page?: number; total?: number };
      setList(payload.data ?? []);
      setLastPage(payload.last_page ?? 1);
      setTotal(payload.total ?? 0);
    } catch {
      setError("Failed to load conduct records.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, recordTypeFilter, statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleCreateConduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee) { setCreateError("Please select an employee."); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await conductApi.create({
        employee_id: newEmployee.id,
        record_type: newRecordType,
        title: newTitle,
        description: newDescription,
        issue_date: newIssueDate,
        incident_date: newIncidentDate || undefined,
        is_confidential: newIsConfidential,
      });
      setShowNew(false);
      setNewEmployee(null); setNewRecordType("commendation"); setNewTitle(""); setNewDescription(""); setNewIncidentDate(""); setNewIsConfidential(false);
      loadList();
    } catch (err: unknown) {
      setCreateError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to create record.");
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            HR
          </Link>
          <h1 className="page-title">Conduct, Discipline & Recognition</h1>
          <p className="page-subtitle">
            Commendations, warnings, and corrective actions. These records support performance review and HR decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hr/conduct/new" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Full Form
          </Link>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Quick Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Type</span>
        <select
          className="form-input max-w-[220px] py-2 text-sm"
          value={recordTypeFilter}
          onChange={(e) => setRecordTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</span>
        <select
          className="form-input max-w-[180px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Records</h3>
          <Link href="/hr" className="text-xs font-semibold text-primary hover:underline">
            Back to HR
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">gavel</span>
            <p className="mt-3 text-sm text-neutral-500">No conduct records found.</p>
            <p className="text-xs text-neutral-400 mt-1">
              {recordTypeFilter || statusFilter ? "Try changing the filters." : "Commendations and disciplinary records will appear here."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Issue date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-neutral-900">
                        {r.employee?.name ?? `#${r.employee_id}`}
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RECORD_TYPE_CLS[r.record_type] ?? "bg-neutral-100"}`}>
                          {RECORD_TYPE_LABELS[r.record_type] ?? r.record_type}
                        </span>
                      </td>
                      <td className="text-neutral-700 text-sm max-w-[200px] truncate" title={r.title}>
                        {r.title}
                      </td>
                      <td className="text-sm text-neutral-600 whitespace-nowrap">
                        {formatDate(r.issue_date)}
                      </td>
                      <td>
                        <span className="text-xs font-medium text-neutral-600">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/hr/conduct/${r.id}`}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 text-sm text-neutral-600">
                <span>Page {page} of {lastPage} ({total} total)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Conduct Record Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">New Conduct Record</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateConduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createError}</div>
              )}
              <UserAutocomplete label="Employee" value={newEmployee} onSelect={setNewEmployee} required />
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Record type <span className="text-red-500">*</span></label>
                <select className="form-input w-full" value={newRecordType} onChange={(e) => setNewRecordType(e.target.value)} required>
                  {Object.entries(RECORD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input type="text" className="form-input w-full" placeholder="Brief title for this record" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea rows={3} className="form-input resize-none" placeholder="Full description of the incident or commendation…" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Issue date <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input w-full" value={newIssueDate} onChange={(e) => setNewIssueDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Incident date</label>
                  <input type="date" className="form-input w-full" value={newIncidentDate} onChange={(e) => setNewIncidentDate(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                <input type="checkbox" checked={newIsConfidential} onChange={(e) => setNewIsConfidential(e.target.checked)} className="rounded border-neutral-300 text-primary" />
                Mark as confidential
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={creating || !newEmployee || !newTitle || !newDescription} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                  {creating ? "Creating…" : "Create record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
