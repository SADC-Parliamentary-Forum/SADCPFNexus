"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { leaveApi, tenantUsersApi, type LeaveRequest, type TenantUserOption } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { useFormatDate } from "@/lib/useFormatDate";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_BADGE: Record<string, string> = {
  approved:  "badge-success",
  submitted: "badge-warning",
  rejected:  "badge-danger",
  draft:     "badge-muted",
  cancelled: "badge-muted",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:    "leave.type.annual",
  sick:      "leave.type.sick",
  lil:       "leave.type.lil",
  special:   "leave.type.special",
  maternity: "leave.type.maternity",
  paternity: "leave.type.paternity",
};

const STATUS_LABELS: Record<string, string> = {
  approved:  "leave.status.approved",
  submitted: "leave.status.submitted",
  rejected:  "leave.status.rejected",
  draft:     "leave.status.draft",
  cancelled: "leave.status.cancelled",
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  All:       "leave.filter.all",
  Submitted: "leave.status.submitted",
  Approved:  "leave.status.approved",
  Rejected:  "leave.status.rejected",
  Draft:     "leave.status.draft",
};

function UserAutocomplete({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: TenantUserOption | null;
  onSelect: (u: TenantUserOption | null) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) { setOptions([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await tenantUsersApi.list({ search: query });
        setOptions((r.data as { data?: TenantUserOption[] }).data ?? (Array.isArray(r.data) ? r.data as unknown as TenantUserOption[] : []));
      } catch { setOptions([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label htmlFor="hr-leave-employee" className="block text-xs font-semibold text-neutral-700 mb-1">{label}</label>
      <input
        id="hr-leave-employee"
        type="text"
        className="form-input w-full"
        placeholder={t("hr.leaveRegister.searchUser")}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (query.trim().length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-neutral-400">{t("hr.conduct.searching")}</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400">{t("hr.conduct.noUsers")}</div>
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
  const { success, error: showErrorToast, info } = useToast();
  const { fmt } = useFormatDate();
  const { t } = useI18n();
  const canImport = canAccessRoute(getStoredUser(), "/hr/leave/import");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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
  const [bulkBusy, setBulkBusy] = useState(false);

  const [density, setDensity] = useState<RegisterDensity>("comfortable");


  const load = () => {
    setLoading(true);
    leaveApi.list({ all: 1 })
      .then((r) => { setRequests(r.data.data); setError(null); })
      .catch(() => setError(t("leave.list.loadError")))
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

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `hr-leave-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        employee: r.requester?.name ?? "",
        type: r.leave_type,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        days: r.days_requested,
        reason: r.reason ?? "",
      })),
      [
        { key: "reference", header: t("leave.col.reference") },
        { key: "employee", header: t("admin.salary.employee") },
        { key: "type", header: t("leave.import.colType") },
        { key: "status", header: t("leave.col.status") },
        { key: "start_date", header: t("leave.col.start") },
        { key: "end_date", header: t("leave.col.end") },
        { key: "days", header: t("leave.col.days") },
        { key: "reason", header: t("common.reason") },
      ],
    );
  };

  const handleApprove = (id: number, override?: string) => {
    setSubmitting(true);
    leaveApi.approve(id, override)
      .then(() => { success(t("hr.leaveRegister.approved")); load(); setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { errors?: { balance?: string[] } } } };
        const balMsg = err?.response?.data?.errors?.balance?.[0];
        if (balMsg) {
          setOverrideId(id);
          setOverrideBalanceMsg(balMsg);
        } else {
          showErrorToast(t("procurement.detail.approveFailed"));
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    setSubmitting(true);
    leaveApi.reject(rejectId, rejectReason)
      .then(() => { success(t("hr.leaveRegister.rejected")); setRejectId(null); setRejectReason(""); load(); })
      .catch(() => showErrorToast(t("procurement.detail.rejectFailed")))
      .finally(() => setSubmitting(false));
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee) { setCreateError(t("hr.conduct.selectEmployee")); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await leaveApi.create({
        leave_type: newLeaveType as LeaveRequest["leave_type"],
        start_date: newStartDate,
        end_date: newEndDate,
        reason: newReason || undefined,
        prepared_on_behalf_of: newEmployee.id,
        submit: true,
      });
      setShowNew(false);
      setNewEmployee(null); setNewLeaveType("annual"); setNewStartDate(""); setNewEndDate(""); setNewReason("");
      success(t("hr.leaveRegister.created"));
      load();
    } catch (err: unknown) {
      setCreateError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("hr.leaveRegister.createFailed"));
    } finally { setCreating(false); }
  };

  const handleBulkImport = async (file: File) => {
    setBulkBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("submit", "1");
      const res = await leaveApi.bulkImport(fd);
      const created = res.data.data.created_count;
      const errors = res.data.data.error_count;
      if (errors > 0) {
        info(t("hr.leaveRegister.bulkDone"), t("hr.leaveRegister.bulkDoneBody", { created, errors }));
      } else {
        success(t("hr.leaveRegister.bulkUploaded"), t("hr.leaveRegister.bulkUploadedBody", { created }));
      }
      load();
    } catch {
      showErrorToast(t("hr.leaveRegister.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const statuses = ["All", "Submitted", "Approved", "Rejected", "Draft"];
  const pending = requests.filter((r) => r.status === "submitted").length;

  return (
    <>
    <RegisterShell
      title="hr.leaveRegister.title"
      subtitle="hr.leaveRegister.subtitle"
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: "nav.hr", href: "/hr" },
            { label: "hr.leaveRegister.crumb" },
          ]}
        />
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={filtered.length}
      onPageChange={setPage}
      loading={loading}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {pending > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="material-symbols-outlined text-[18px] text-amber-600">pending_actions</span>
              <span className="text-sm font-semibold text-amber-800">{t("hr.leaveRegister.pending", { count: pending })}</span>
            </div>
          )}
          <Link href="/leave" className="btn-secondary text-sm">
            {t("hr.leaveRegister.myLeave")}
          </Link>
          {canImport && (
            <Link href="/hr/leave/import" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
              {t("leave.import.cta")}
            </Link>
          )}
          {canImport && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="hr-leave-bulk-file" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
                {t("hr.leaveRegister.uploadCsv")}
              </label>
              <input
                id="hr-leave-bulk-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={bulkBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleBulkImport(file);
                }}
              />
              <a
                href="/api/v1/leave/requests/bulk-import/template"
                className="text-sm text-neutral-600 hover:text-neutral-900"
              >
                {t("hr.leaveRegister.csvTemplate")}
              </a>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary py-2 px-3 text-sm flex items-center gap-1 disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("leave.common.exportCsv")}
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("leave.create.titleNew")}
          </button>
        </div>
      }
      filters={
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none text-[20px]">search</span>
            <input
              type="search"
              placeholder={t("hr.leaveRegister.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-input pl-10"
              aria-label={t("hr.leaveRegister.searchAria")}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilterStatus(s);
                  setPage(1);
                }}
                className={`filter-tab ${filterStatus === s ? "active" : ""}`}
              >
                {t(STATUS_FILTER_LABELS[s] ?? s)}
              </button>
            ))}
          </div>
        </div>
      }
      stats={
        error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error_outline</span>
            {error}
          </div>
        ) : undefined
      }
      empty={
        !loading && filtered.length === 0 ? (
          <div className="card">
            <EmptyState icon="event_available" title="hr.leaveRegister.empty" />
          </div>
        ) : undefined
      }
    >
      {/* Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-neutral-900">{t("hr.leaveRegister.tableTitle", { count: filtered.length })}</h2>
          <button type="button" onClick={load} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            {t("admin.common.refresh")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("leave.col.reference")}</th>
                <th>{t("header.staffMember")}</th>
                <th>{t("leave.certificate.leaveType")}</th>
                <th>{t("leave.create.from")}</th>
                <th>{t("leave.create.to")}</th>
                <th>{t("leave.col.days")}</th>
                <th>{t("leave.col.status")}</th>
                <th>{t("audit.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : paged.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-neutral-600">{r.reference_number}</td>
                      <td className="font-medium text-neutral-900">{r.requester?.name ?? "—"}</td>
                      <td>
                        <span className="badge badge-muted">{LEAVE_TYPE_LABELS[r.leave_type] ? t(LEAVE_TYPE_LABELS[r.leave_type]) : r.leave_type}</span>
                      </td>
                      <td className="text-neutral-600 text-xs whitespace-nowrap">{fmt(r.start_date)}</td>
                      <td className="text-neutral-600 text-xs whitespace-nowrap">{fmt(r.end_date)}</td>
                      <td className="text-neutral-700">{t("hr.leaveBalances.days", { days: r.days_requested })}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-muted"} capitalize`}>{STATUS_LABELS[r.status] ? t(STATUS_LABELS[r.status]) : r.status}</span>
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
                              {t("common.approve")}
                            </button>
                            <span className="text-neutral-300">|</span>
                            <button
                              type="button"
                              onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                              disabled={submitting}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {t("common.reject")}
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
    </RegisterShell>

      {/* New Leave Request Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">{t("hr.leaveRegister.newTitle")}</h2>
              <button type="button" onClick={() => setShowNew(false)} aria-label={t("hr.leaveRegister.closeNew")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createError}</div>
              )}
              <UserAutocomplete label={t("hr.leaveRegister.employeeRequired")} value={newEmployee} onSelect={setNewEmployee} />
              <div>
                <label htmlFor="hr-leave-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.leaveRegister.typeRequired")}</label>
                <select id="hr-leave-type" className="form-input w-full" value={newLeaveType} onChange={(e) => setNewLeaveType(e.target.value)} required>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hr-leave-from" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.leaveRegister.fromRequired")}</label>
                  <input id="hr-leave-from" type="date" className="form-input w-full" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="hr-leave-to" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.leaveRegister.toRequired")}</label>
                  <input id="hr-leave-to" type="date" className="form-input w-full" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} required />
                </div>
              </div>
              <div>
                <label htmlFor="hr-leave-reason" className="block text-xs font-semibold text-neutral-700 mb-1">{t("common.reason")}</label>
                <textarea id="hr-leave-reason" rows={2} className="form-input resize-none" placeholder={t("hr.leaveRegister.reasonPlaceholder")} value={newReason} onChange={(e) => setNewReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
                <button type="submit" disabled={creating || !newEmployee} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                  {creating ? t("audit.engagements.creating") : t("hr.leaveRegister.createRequest")}
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
                <h2 className="text-base font-semibold text-neutral-900">{t("leave.detail.insufficientBalance")}</h2>
              </div>
              <button type="button" onClick={() => { setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); }} aria-label={t("hr.leaveRegister.closeOverride")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-neutral-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{overrideBalanceMsg}</p>
              <div>
                <label htmlFor="hr-leave-override-reason" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("hr.leaveRegister.overrideLabel")} <span className="text-red-500">*</span></label>
                <textarea
                  id="hr-leave-override-reason"
                  rows={3}
                  className="form-input resize-none"
                  placeholder={t("hr.leaveRegister.overridePlaceholder")}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setOverrideId(null); setOverrideReason(""); setOverrideBalanceMsg(null); }} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
                <button
                  type="button"
                  onClick={() => handleApprove(overrideId!, overrideReason.trim())}
                  disabled={!overrideReason.trim() || submitting}
                  className="px-5 py-2 text-sm rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? t("leave.detail.processing") : t("leave.detail.approveAnyway")}
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
              <h2 className="text-base font-semibold text-neutral-900">{t("leave.detail.rejectTitle")}</h2>
              <button type="button" onClick={() => setRejectId(null)} aria-label={t("hr.leaveRegister.closeReject")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="hr-leave-reject-reason" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("approvals.reject.reasonLabel")} <span className="text-red-500">*</span></label>
                <textarea
                  id="hr-leave-reject-reason"
                  rows={3}
                  className="form-input resize-none"
                  placeholder={t("hr.leaveRegister.rejectPlaceholder")}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setRejectId(null)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || submitting}
                  className="btn-primary px-5 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {t("hr.leaveRegister.rejectLeave")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
