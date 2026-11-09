"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { conductApi, tenantUsersApi, type ConductRecord, type TenantUserOption } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const RECORD_TYPE_LABELS: Record<string, string> = {
  commendation: "hr.conduct.type.commendation",
  verbal_counseling: "hr.conduct.typeLc.verbalCounseling",
  written_warning: "hr.conduct.typeLc.writtenWarning",
  final_warning: "hr.conduct.typeLc.finalWarning",
  suspension: "hr.conduct.type.suspension",
  dismissal: "hr.conduct.type.dismissal",
  performance_improvement: "hr.conduct.typeLc.performanceImprovement",
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
  open: "hr.conduct.status.open",
  acknowledged: "hr.conduct.status.acknowledged",
  under_appeal: "hr.conduct.status.underAppeal",
  resolved: "hr.conduct.status.resolved",
  closed: "hr.conduct.status.closed",
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

  const inputId = `user-ac-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div ref={ref} className="relative">
      <label htmlFor={inputId} className="block text-xs font-semibold text-neutral-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        id={inputId}
        type="text"
        className="form-input w-full"
        placeholder={t("hr.conduct.typeToSearch")}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && query.trim().length > 0 && (
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

export default function ConductPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState<ConductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
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
      setError(t("hr.conduct.loadFailed"));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, recordTypeFilter, statusFilter, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleCreateConduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee) { setCreateError(t("hr.conduct.selectEmployee")); return; }
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
      toast.success(t("hr.conduct.new.created"));
      loadList();
    } catch (err: unknown) {
      setCreateError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("hr.conduct.new.createFailed"));
      toast.error(t("hr.conduct.new.notCreated"), apiErrorMessage(err, t("hr.conduct.new.createFailed")));
    } finally { setCreating(false); }
  };

  const visible = list.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [r.employee?.name, r.title, r.record_type, r.status].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  const handleExport = () => {
    if (visible.length === 0) return;
    exportToCsv(
      `hr-conduct-${new Date().toISOString().slice(0, 10)}.csv`,
      visible.map((r) => ({
        employee: r.employee?.name ?? "",
        type: r.record_type,
        title: r.title,
        status: r.status,
        issue_date: r.issue_date ?? "",
      })),
      [
        { key: "employee", header: t("hr.conduct.employee") },
        { key: "type", header: t("hr.conduct.type") },
        { key: "title", header: t("hr.conduct.titleLabel") },
        { key: "status", header: t("hr.conduct.statusLabel") },
        { key: "issue_date", header: t("hr.conduct.issueDateLc") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.conduct.title")}
        subtitle={t("hr.conduct.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.hr", href: "/hr" }, { label: t("hr.conduct.crumb") }]} />}
        actions={
          <>
          <button
            type="button"
            className="btn-secondary py-2 px-3 text-sm disabled:opacity-50"
            disabled={visible.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("hr.conduct.exportCsv")}
          </button>
          <Link href="/hr/conduct/new" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            {t("hr.conduct.fullForm")}
          </Link>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("hr.conduct.quickAdd")}
          </button>
          </>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder={t("hr.conduct.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t("hr.conduct.type")}</span>
        <select
          className="form-input max-w-[220px] py-2 text-sm"
          value={recordTypeFilter}
          onChange={(e) => {
            setRecordTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("hr.conduct.allTypes")}</option>
          {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t("hr.conduct.statusLabel")}</span>
        <select
          className="form-input max-w-[180px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("hr.conduct.all")}</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">{t("hr.conduct.records")}</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="gavel"
            title={t("hr.conduct.empty")}
            description={recordTypeFilter || statusFilter || search ? t("hr.conduct.emptyFiltered") : t("hr.conduct.emptyHint")}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("hr.conduct.employee")}</th>
                    <th>{t("hr.conduct.type")}</th>
                    <th>{t("hr.conduct.titleLabel")}</th>
                    <th>{t("hr.conduct.issueDateLc")}</th>
                    <th>{t("hr.conduct.statusLabel")}</th>
                    <th className="text-right">{t("hr.conduct.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-neutral-900">
                        {r.employee?.name ?? `#${r.employee_id}`}
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RECORD_TYPE_CLS[r.record_type] ?? "bg-neutral-100"}`}>
                          {RECORD_TYPE_LABELS[r.record_type] ? t(RECORD_TYPE_LABELS[r.record_type]) : r.record_type}
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
                          {STATUS_LABELS[r.status] ? t(STATUS_LABELS[r.status]) : r.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/hr/conduct/${r.id}`}
                          className="btn-secondary text-xs"
                        >
                          {t("hr.conduct.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={page}
              lastPage={lastPage}
              total={total}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}
      </div>

      {/* New Conduct Record Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-base font-semibold text-neutral-900">{t("hr.conduct.new.title")}</h2>
              <button type="button" onClick={() => setShowNew(false)} aria-label={t("hr.conduct.closeForm")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateConduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{createError}</div>
              )}
              <UserAutocomplete label={t("hr.conduct.employee")} value={newEmployee} onSelect={setNewEmployee} required />
              <div>
                <label htmlFor="conduct-record-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.conduct.recordTypeLc")} <span className="text-red-500">*</span></label>
                <select id="conduct-record-type" className="form-input w-full" value={newRecordType} onChange={(e) => setNewRecordType(e.target.value)} required>
                  {Object.entries(RECORD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="conduct-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.conduct.titleLabel")} <span className="text-red-500">*</span></label>
                <input id="conduct-title" type="text" className="form-input w-full" placeholder={t("hr.conduct.quickTitlePlaceholder")} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="conduct-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.conduct.description")} <span className="text-red-500">*</span></label>
                <textarea id="conduct-description" rows={3} className="form-input resize-none" placeholder={t("hr.conduct.quickDescriptionPlaceholder")} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="conduct-issue-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.conduct.issueDateLc")} <span className="text-red-500">*</span></label>
                  <input id="conduct-issue-date" type="date" className="form-input w-full" value={newIssueDate} onChange={(e) => setNewIssueDate(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="conduct-incident-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.conduct.incidentDateLc")}</label>
                  <input id="conduct-incident-date" type="date" className="form-input w-full" value={newIncidentDate} onChange={(e) => setNewIncidentDate(e.target.value)} />
                </div>
              </div>
              <label htmlFor="hr-conduct-setnewisconfidential-e-target-checked-classname-" className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                <input id="hr-conduct-setnewisconfidential-e-target-checked-classname-" type="checkbox" checked={newIsConfidential} onChange={(e) => setNewIsConfidential(e.target.checked)} className="rounded border-neutral-300 text-primary" />
                {t("hr.conduct.markConfidential")}
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
                <button type="submit" disabled={creating || !newEmployee || !newTitle || !newDescription} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                  {creating ? t("hr.conduct.creating") : t("hr.conduct.createRecord")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
