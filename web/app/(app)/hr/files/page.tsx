"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { hrFilesApi, adminApi, type HrPersonalFile } from "@/lib/api";

const FILE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  suspended: "Suspended",
  separated: "Separated",
  archived: "Archived",
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  secondment: "Secondment",
  acting: "Acting",
  probation: "Probation",
  separated: "Separated",
};

const PROBATION_STATUS_LABELS: Record<string, string> = {
  on_probation: "On probation",
  confirmed: "Confirmed",
  extended: "Extended",
  terminated: "Terminated",
  not_applicable: "N/A",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface Department {
  id: number;
  name: string;
}

export default function HrFilesDirectoryPage() {
  const [files, setFiles] = useState<HrPersonalFile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [employmentStatus, setEmploymentStatus] = useState<string>("");
  const [probationStatus, setProbationStatus] = useState<string>("");
  const [fileStatus, setFileStatus] = useState<string>("");

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
      const params: Record<string, string | number> = { per_page: 100 };
      if (search.trim()) params.search = search.trim();
      if (departmentId) params.department_id = Number(departmentId);
      if (employmentStatus) params.employment_status = employmentStatus;
      if (probationStatus) params.probation_status = probationStatus;
      if (fileStatus) params.file_status = fileStatus;
      const res = await hrFilesApi.list(params);
      const data = (res.data as { data?: HrPersonalFile[] }).data ?? [];
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load HR files.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, employmentStatus, probationStatus, fileStatus]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const total = files.length;
  const activeCount = files.filter((f) => f.employment_status === "permanent" || f.file_status === "active").length;
  const probationCount = files.filter((f) => f.probation_status === "on_probation").length;
  const warningCount = files.filter((f) => f.active_warning_flag).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            HR
          </Link>
          <h1 className="page-title">HR Personal Files</h1>
          <p className="page-subtitle">
            Searchable employee directory and digital HR files.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Total files</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Active</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">On probation</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{probationCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Active warning</p>
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
            placeholder="Search by name or staff number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-500">Department</label>
            <select
              className="form-input py-2 text-sm min-w-[140px]"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-500">Employment</label>
            <select
              className="form-input py-2 text-sm min-w-[120px]"
              value={employmentStatus}
              onChange={(e) => setEmploymentStatus(e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-500">Probation</label>
            <select
              className="form-input py-2 text-sm min-w-[120px]"
              value={probationStatus}
              onChange={(e) => setProbationStatus(e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(PROBATION_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-500">File status</label>
            <select
              className="form-input py-2 text-sm min-w-[120px]"
              value={fileStatus}
              onChange={(e) => setFileStatus(e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(FILE_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Employee directory</h3>
          <Link href="/hr" className="text-xs font-semibold text-primary hover:underline">
            Back to HR
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">folder_open</span>
            <p className="mt-3 text-sm text-neutral-500">No HR files found.</p>
            <p className="text-xs text-neutral-400 mt-1">Adjust filters or search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Staff #</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Employment</th>
                  <th>Probation</th>
                  <th>Contract expiry</th>
                  <th>Warning</th>
                  <th className="text-right">Action</th>
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
                        {EMPLOYMENT_STATUS_LABELS[f.employment_status] ?? f.employment_status}
                      </span>
                    </td>
                    <td className="text-sm">
                      {PROBATION_STATUS_LABELS[f.probation_status] ?? f.probation_status}
                    </td>
                    <td className="text-sm text-neutral-600 whitespace-nowrap">
                      {formatDate(f.contract_expiry_date)}
                    </td>
                    <td>
                      {f.active_warning_flag ? (
                        <span className="badge badge-danger">Yes</span>
                      ) : (
                        <span className="text-neutral-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/hr/files/${f.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        View file
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
