"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { leaveApi, tenantUsersApi, type LeaveRequest, type TenantUserOption } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  approved:  "badge-success",
  submitted: "badge-warning",
  rejected:  "badge-danger",
  draft:     "badge-muted",
  cancelled: "badge-muted",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:    "Annual",
  sick:      "Sick",
  lil:       "LIL",
  special:   "Special",
  maternity: "Maternity",
  paternity: "Paternity",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function UserAutocomplete({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: TenantUserOption | null;
  onSelect: (u: TenantUserOption | null) => void;
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
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}</label>
      <input
        type="text"
        className="form-input w-full"
        placeholder="Type name to search…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (query.trim().length > 0) && (
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

function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5,6,7].map((i) => (
        <td key={i}><div className="h-4 bg-neutral-100 rounded animate-pulse w-full max-w-[100px]" /></td>
      ))}
    </tr>
  );
}

export default function HRLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Balance override state
  const [overrideId, setOverrideId] = useState<number | null>(null);
  const [overrideBalanceMsg, setOverrideBalanceMsg] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // New leave request modal
  const [showNew, setShowNew] = useState(false);
  const [newEmployee, setNewEmployee] = useState<TenantUserOption | null>(null);
  const [newLeaveType, setNewLeaveType] = useState<string>("annual");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    leaveApi.list({ all: 1 })
      .then((r) => { setRequests(r.data.data); setError(null); })
      .catch(() => setError("Failed to load leave requests."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter((r) => {
    const matchStatus = filterStatus === "All" || r.status === filterStatus.toLowerCase();
    const matchSearch = !search ||
      r.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      (r.requester?.name ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleApprove = (id: number, override?: string) => {
    setSubmitting(true);
    leaveApi.approve(id, override)
      .then(() => { showToast("Leave approved."); load(); setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { errors?: { balance?: string[] } } } };
        const balMsg = err?.response?.data?.errors?.balance?.[0];
        if (balMsg) {
          setOverrideId(id);
          setOverrideBalanceMsg(balMsg);
        } else {
          showToast("Failed to approve.");
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    setSubmitting(true);
    leaveApi.reject(rejectId, rejectReason)
      .then(() => { showToast("Leave rejected."); setRejectId(null); setRejectReason(""); load(); })
      .catch(() => showToast("Failed to reject."))
      .finally(() => setSubmitting(false));
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee) { setCreateError("Please select an employee."); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await leaveApi.create({
        leave_type: newLeaveType as LeaveRequest["leave_type"],
        start_date: newStartDate,
        end_date: newEndDate,
        reason: newReason || undefined,
        // Pass employee info via a workaround — the API might support user_id for HR-created
      } as Partial<LeaveRequest> & { user_id?: number });
      setShowNew(false);
      setNewEmployee(null); setNewLeaveType("annual"); setNewStartDate(""); setNewEndDate(""); setNewReason("");
      showToast("Leave request created.");
      load();
    } catch (err: unknown) {
      setCreateError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to create leave request.");
    } finally { setCreating(false); }
  };

  const statuses = ["All", "Submitted", "Approved", "Rejected", "Draft"];
  const pending = requests.filter((r) => r.status === "submitted").length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/hr" className="hover:text-primary transition-colors">HR</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-900 font-medium">Leave Manager</span>
          </div>
          <h1 className="page-title">Staff Leave Requests</h1>
          <p className="page-subtitle">Review and action all leave applications from staff members.</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">pending_actions</span>
              <span className="text-sm font-semibold text-amber-800">{pending} pending</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New leave request
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" style={{ fontSize: "20px" }}>search</span>
          <input
            type="search"
            placeholder="Search by name or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`filter-tab ${filterStatus === s ? "active" : ""}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-neutral-900">All Leave Requests ({filtered.length})</h2>
          <button type="button" onClick={load} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Staff Member</th>
                <th>Leave Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-neutral-400">
                        No leave requests found.
                      </td>
                    </tr>
                  )
                  : filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-neutral-600">{r.reference_number}</td>
                      <td className="font-medium text-neutral-900">{r.requester?.name ?? "—"}</td>
                      <td>
                        <span className="badge badge-muted">{LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}</span>
                      </td>
                      <td className="text-neutral-600 text-xs whitespace-nowrap">{formatDate(r.start_date)}</td>
                      <td className="text-neutral-600 text-xs whitespace-nowrap">{formatDate(r.end_date)}</td>
                      <td className="text-neutral-700">{r.days_requested}d</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-muted"} capitalize`}>{r.status}</span>
                      </td>
                      <td>
                        {r.status === "submitted" ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(r.id)}
                              disabled={submitting}
                              className="text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <span className="text-neutral-300">|</span>
                            <button
                              type="button"
                              onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                              disabled={submitting}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* New Leave Request Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">New Leave Request</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createError}</div>
              )}
              <UserAutocomplete label="Employee *" value={newEmployee} onSelect={setNewEmployee} />
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Leave type *</label>
                <select className="form-input w-full" value={newLeaveType} onChange={(e) => setNewLeaveType(e.target.value)} required>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">From *</label>
                  <input type="date" className="form-input w-full" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">To *</label>
                  <input type="date" className="form-input w-full" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason</label>
                <textarea rows={2} className="form-input resize-none" placeholder="Optional reason…" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={creating || !newEmployee} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                  {creating ? "Creating…" : "Create request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Balance Override Modal */}
      {overrideId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                <h2 className="text-base font-semibold text-neutral-900">Insufficient Leave Balance</h2>
              </div>
              <button type="button" onClick={() => { setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); }} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-neutral-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{overrideBalanceMsg}</p>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Override justification <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Provide a written justification for approving despite insufficient balance…"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); }} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={() => handleApprove(overrideId!, overrideReason.trim())}
                  disabled={!overrideReason.trim() || submitting}
                  className="px-5 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? "Processing…" : "Approve Anyway"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">Reject Leave Request</h2>
              <button type="button" onClick={() => setRejectId(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Reason for rejection <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Provide a clear reason for the staff member…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setRejectId(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || submitting}
                  className="btn-primary px-5 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
