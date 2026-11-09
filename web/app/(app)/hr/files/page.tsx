"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { hrFilesApi, adminApi, type HrPersonalFile } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const FILE_STATUS_LABELS: Record<string, string> = {
  active: "hr.files.fileStatus.active",
  probation: "hr.files.fileStatus.probation",
  suspended: "hr.files.fileStatus.suspended",
  separated: "hr.files.fileStatus.separated",
  archived: "hr.files.fileStatus.archived",
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  permanent: "hr.files.employment.permanent",
  contract: "hr.files.employment.contract",
  secondment: "hr.files.employment.secondment",
  acting: "hr.files.employment.acting",
  probation: "hr.files.employment.probation",
  separated: "hr.files.employment.separated",
};

const PROBATION_STATUS_LABELS: Record<string, string> = {
  on_probation: "hr.files.probation.on_probation",
  confirmed: "hr.files.probation.confirmed",
  extended: "hr.files.probation.extended",
  terminated: "hr.files.probation.terminated",
  not_applicable: "hr.files.probation.not_applicable",
};

function formatDate(d: string | null, localeTag: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
}

interface Department {
  id: number;
  name: string;
}

export default function HrFilesDirectoryPage() {
  const [files, setFiles] = useState<HrPersonalFile[]>([]);
  const { t, localeTag } = useI18n();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [employmentStatus, setEmploymentStatus] = useState<string>("");
  const [probationStatus, setProbationStatus] = useState<string>("");
  const [fileStatus, setFileStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await adminApi.listDepartments();
      const data = (res.data as { data?: Department[] }).data ?? res.data;
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 25, page };
      if (search.trim()) params.search = search.trim();
      if (departmentId) params.department_id = Number(departmentId);
      if (employmentStatus) params.employment_status = employmentStatus;
      if (probationStatus) params.probation_status = probationStatus;
      if (fileStatus) params.file_status = fileStatus;
      const res = await hrFilesApi.list(params);
      const data = getListData<HrPersonalFile>(res.data);
      setFiles(data);
      setLastPage(getLastPage(res.data));
      setTotalCount(getTotal(res.data, data.length));
    } catch {
      setError(t("hr.files.list.loadFailed"));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, employmentStatus, probationStatus, fileStatus, page, t]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const total = totalCount || files.length;
  const activeCount = files.filter((f) => f.employment_status === "permanent" || f.file_status === "active").length;
  const probationCount = files.filter((f) => f.probation_status === "on_probation").length;
  const warningCount = files.filter((f) => f.active_warning_flag).length;

  const handleExport = () => {
    if (files.length === 0) return;
    exportToCsv(
      `hr-files-${new Date().toISOString().slice(0, 10)}.csv`,
      files.map((f) => ({
        employee: f.employee?.name ?? "",
        staff_number: f.staff_number ?? "",
        department: f.department?.name ?? "",
        position: f.current_position ?? "",
        employment: f.employment_status,
        probation: f.probation_status,
        file_status: f.file_status,
        warning: f.active_warning_flag ? "yes" : "no",
      })),
      [
        { key: "employee", header: t("hr.files.list.col.employee") },
        { key: "staff_number", header: t("hr.files.list.col.staffNo") },
        { key: "department", header: t("hr.files.list.col.department") },
        { key: "position", header: t("hr.files.list.col.position") },
        { key: "employment", header: t("hr.files.list.col.employment") },
        { key: "probation", header: t("hr.files.list.col.probation") },
        { key: "file_status", header: t("hr.files.list.col.fileStatus") },
        { key: "warning", header: t("hr.files.list.col.warning") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("hr.files.list.title")}
        subtitle={t("hr.files.list.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.hr", href: "/hr" }, { label: "hr.files.detail.crumb" }]} />}
        actions={
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={files.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("hr.files.list.exportCsv")}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("hr.files.list.totalFiles")}</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("hr.files.list.active")}</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("hr.files.list.onProbation")}</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{probationCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">{t("hr.files.list.activeWarning")}</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{warningCount}</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-[20px]">search</span>
          <input
            type="text"
            className="form-input pl-10"
            placeholder={t("hr.files.list.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="hr-files-department" className="text-xs font-semibold text-neutral-500">{t("hr.files.list.col.department")}</label>
            <select
              id="hr-files-department"
              className="form-input py-2 text-sm min-w-[140px]"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("hr.files.list.all")}</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="hr-files-employment" className="text-xs font-semibold text-neutral-500">{t("hr.files.list.col.employment")}</label>
            <select
              id="hr-files-employment"
              className="form-input py-2 text-sm min-w-[120px]"
              value={employmentStatus}
              onChange={(e) => {
                setEmploymentStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("hr.files.list.all")}</option>
              {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="hr-files-probation" className="text-xs font-semibold text-neutral-500">{t("hr.files.list.col.probation")}</label>
            <select
              id="hr-files-probation"
              className="form-input py-2 text-sm min-w-[120px]"
              value={probationStatus}
              onChange={(e) => {
                setProbationStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("hr.files.list.all")}</option>
              {Object.entries(PROBATION_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="hr-files-status" className="text-xs font-semibold text-neutral-500">{t("hr.files.list.col.fileStatus")}</label>
            <select
              id="hr-files-status"
              className="form-input py-2 text-sm min-w-[120px]"
              value={fileStatus}
              onChange={(e) => {
                setFileStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("hr.files.list.all")}</option>
              {Object.entries(FILE_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">{t("hr.files.list.directory")}</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : files.length === 0 ? (
          <EmptyState icon="folder_open" title={t("hr.files.list.empty")} description={t("hr.files.list.emptyHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("hr.files.list.col.employee")}</th>
                  <th>{t("hr.files.list.col.staffNo")}</th>
                  <th>{t("hr.files.list.col.department")}</th>
                  <th>{t("hr.files.list.col.position")}</th>
                  <th>{t("hr.files.list.col.employment")}</th>
                  <th>{t("hr.files.list.col.probation")}</th>
                  <th>{t("hr.files.list.col.contractExpiry")}</th>
                  <th>{t("hr.files.list.col.warning")}</th>
                  <th className="text-right">{t("hr.files.list.col.action")}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium text-neutral-900">
                      {f.employee?.name ?? `#${f.employee_id}`}
                    </td>
                    <td className="text-sm text-neutral-600">{f.staff_number ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{f.department?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-600">{f.current_position ?? "—"}</td>
                    <td className="text-sm">
                      <span className="text-neutral-700">
                        {EMPLOYMENT_STATUS_LABELS[f.employment_status] ? t(EMPLOYMENT_STATUS_LABELS[f.employment_status]) : f.employment_status}
                      </span>
                    </td>
                    <td className="text-sm">
                      {PROBATION_STATUS_LABELS[f.probation_status] ? t(PROBATION_STATUS_LABELS[f.probation_status]) : f.probation_status}
                    </td>
                    <td className="text-sm text-neutral-600 whitespace-nowrap">
                      {formatDate(f.contract_expiry_date, localeTag)}
                    </td>
                    <td>
                      {f.active_warning_flag ? (
                        <span className="badge badge-danger">{t("hr.files.list.yes")}</span>
                      ) : (
                        <span className="text-neutral-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/hr/files/${f.id}`}
                        className="btn-secondary text-xs"
                      >
                        {t("hr.files.list.viewFile")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination
          page={page}
          lastPage={lastPage}
          total={totalCount}
          onPageChange={setPage}
          disabled={loading}
        />
      </div>
    </div>
  );
}
