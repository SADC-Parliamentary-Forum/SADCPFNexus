"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { PAYSLIP_ACCEPTED_TYPES, PAYSLIP_EMPLOYEE_PATTERN, PAYSLIP_MONTH_NAMES } from "@/lib/constants";
import { adminApi, payslipRefreshApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import type { AdminPayslip, User } from "@/lib/api";

interface PayslipRow {
  id: number;
  filename: string;
  employeeNum: string;
  period: string;
  file: File;
}

function parseFilename(filename: string): { employeeNum: string; period: string } {
  const empMatch = filename.match(PAYSLIP_EMPLOYEE_PATTERN);
  const employeeNum = empMatch ? empMatch[0].toUpperCase() : filename.split(/[-_]/)[0] || "UNKNOWN";
  const lower = filename.toLowerCase();
  const monthNames = PAYSLIP_MONTH_NAMES;
  let period = "";
  for (const m of monthNames) {
    if (lower.includes(m)) {
      const yearMatch = filename.match(/20\d{2}/);
      period = `${m.charAt(0).toUpperCase() + m.slice(1)}${yearMatch ? " " + yearMatch[0] : ""}`;
      break;
    }
  }
  if (!period) {
    const dateMatch = filename.match(/(20\d{2})[-_]?(0[1-9]|1[0-2])/);
    if (dateMatch) {
      const [, y, mo] = dateMatch;
      const d = new Date(parseInt(y), parseInt(mo) - 1);
      period = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    } else {
      period = "Unknown Period";
    }
  }
  return { employeeNum, period };
}

function periodToMonthValue(period: string): string {
  if (!period || period === "Unknown Period") return "";
  const parts = period.trim().split(/\s+/);
  const yearPart = parts.find((p) => /^20\d{2}$/.test(p));
  const monthPart = parts.find((p) => !/^20\d{2}$/.test(p))?.toLowerCase();
  if (!yearPart || !monthPart) return "";
  const mi = PAYSLIP_MONTH_NAMES.findIndex((m) => m.startsWith(monthPart.slice(0, 3)));
  if (mi === -1) return "";
  const m = mi + 1;
  return `${yearPart}-${String(m).padStart(2, "0")}`;
}

function monthValueToPeriod(value: string): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "Unknown Period";
  const [y, mo] = value.split("-").map(Number);
  const d = new Date(y, mo - 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatPeriod(p: { period_month: number; period_year: number }): string {
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[p.period_month] ?? p.period_month} ${p.period_year}`;
}

export default function HrPayslipsPage() {
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploadedList, setUploadedList] = useState<AdminPayslip[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterEmployeeCode, setFilterEmployeeCode] = useState("");
  const [selectedPayslip, setSelectedPayslip] = useState<AdminPayslip | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [canManage, setCanManage] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCanManage(
      isSystemAdmin(user) ||
      hasPermission(user, "hr.admin") ||
      !!(user?.roles?.some((r) => ["HR Manager", "HR Administrator"].includes(r)))
    );
  }, []);

  const fetchList = useCallback((params?: { search?: string; employee_number?: string }) => {
    setLoadingList(true);
    setListError(null);
    const query: { per_page: number; search?: string; employee_number?: string } = { per_page: 100 };
    const search = (params?.search ?? filterUser).trim();
    const emp = (params?.employee_number ?? filterEmployeeCode).trim();
    if (search) query.search = search;
    if (emp) query.employee_number = emp;
    adminApi
      .listPayslips(query)
      .then((res) => setUploadedList(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setListError("Failed to load payslips."))
      .finally(() => setLoadingList(false));
  }, [filterUser, filterEmployeeCode]);

  useEffect(() => {
    fetchList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
    setTimeout(() => { setToast(null); setToastError(false); }, 4000);
  };

  const handleDownload = (id: number) => {
    adminApi.downloadPayslip(id).catch(() => showToast("Download failed.", true));
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      await payslipRefreshApi.refresh(id);
      showToast("Payslip auto-fill refreshed.");
      fetchList();
    } catch {
      showToast("Refresh failed.", true);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleReuploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedPayslip) return;
    setReuploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", String(selectedPayslip.user_id ?? selectedPayslip.user?.id));
    form.append("period_month", String(selectedPayslip.period_month));
    form.append("period_year", String(selectedPayslip.period_year));
    adminApi
      .uploadPayslip(form)
      .then(() => { showToast("Payslip re-uploaded."); setSelectedPayslip(null); fetchList(); })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        showToast(err?.response?.data?.message ?? "Re-upload failed.", true);
      })
      .finally(() => setReuploading(false));
  };

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) => f.name.match(/\.(pdf|xlsx|xls)$/i));
    const newRows: PayslipRow[] = accepted.map((f) => ({
      id: Date.now() + Math.random(),
      filename: f.name,
      file: f,
      ...parseFilename(f.name),
    }));
    setRows((prev) => [...prev, ...newRows]);
  };

  const updateRow = (id: number, field: "employeeNum" | "period", value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleUploadAll = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    let success = 0;
    let failed = 0;
    let allUsers: User[] = [];
    try {
      const res = await adminApi.listUsers({ per_page: 200 });
      allUsers = res.data.data ?? [];
    } catch { /* proceed without lookup */ }

    for (const row of rows) {
      try {
        const empNum = row.employeeNum.toUpperCase();
        const user = allUsers.find((u) => u.employee_number && u.employee_number.toUpperCase() === empNum);
        if (!user) { failed++; continue; }
        const [monthName, yearStr] = row.period.split(" ");
        const monthIdx = new Date(`${monthName} 1, 2000`).getMonth() + 1;
        const year = parseInt(yearStr ?? "");
        if (!monthIdx || !year) { failed++; continue; }
        const form = new FormData();
        form.append("file", row.file);
        form.append("user_id", String(user.id));
        form.append("period_month", String(monthIdx));
        form.append("period_year", String(year));
        await adminApi.uploadPayslip(form);
        success++;
      } catch { failed++; }
    }

    if (success > 0) {
      showToast(`${success} payslip${success !== 1 ? "s" : ""} uploaded.${failed > 0 ? ` ${failed} failed.` : ""}`);
      setRows([]);
      fetchList();
    } else {
      showToast(failed > 0 ? `Upload failed for all ${failed} payslips. Check employee numbers and periods.` : "Nothing to upload.", true);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toastError ? "bg-red-600" : "bg-green-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{toastError ? "error" : "check_circle"}</span>
          {toast}
        </div>
      )}

      {selectedPayslip && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedPayslip(null)}>
          <div className="card max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Payslip</h3>
              <button type="button" onClick={() => setSelectedPayslip(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-neutral-500">Employee</dt><dd className="font-medium">{selectedPayslip.user?.name ?? selectedPayslip.user?.email ?? "—"}</dd></div>
              <div><dt className="text-neutral-500">Employee code</dt><dd className="font-mono">{selectedPayslip.user?.employee_number ?? "—"}</dd></div>
              <div><dt className="text-neutral-500">Period</dt><dd>{formatPeriod(selectedPayslip)}</dd></div>
              <div><dt className="text-neutral-500">Gross</dt><dd>{Number(selectedPayslip.gross_amount).toLocaleString()} {selectedPayslip.currency}</dd></div>
              <div><dt className="text-neutral-500">Net</dt><dd>{Number(selectedPayslip.net_amount).toLocaleString()} {selectedPayslip.currency}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => handleDownload(selectedPayslip.id)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download
              </button>
              {canManage && (
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  {reuploading ? "Uploading…" : "Re-upload"}
                  <input ref={reuploadInputRef} type="file" accept={PAYSLIP_ACCEPTED_TYPES} className="hidden" onChange={handleReuploadSelect} disabled={reuploading} />
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/hr" className="hover:text-primary transition-colors">HR</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Payslip Management</span>
      </div>

      <div>
        <h1 className="page-title">Payslip Management</h1>
        <p className="page-subtitle">Upload and manage employee payslips. Files are parsed for employee number and pay period.</p>
      </div>

      {/* Uploaded payslips list */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-neutral-900">Uploaded payslips</h2>
          <button type="button" onClick={() => fetchList()} className="text-xs font-medium text-primary hover:underline">Refresh</button>
        </div>
        <div className="px-4 py-3 border-b border-neutral-200 flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-neutral-600 mb-1">User (name or email)</label>
            <input type="text" placeholder="Search by name or email" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Employee code</label>
            <input type="text" placeholder="e.g. EMP042" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={filterEmployeeCode} onChange={(e) => setFilterEmployeeCode(e.target.value)} />
          </div>
          <button type="button" onClick={() => fetchList()} className="btn-primary px-4 py-2 text-sm">Apply filters</button>
        </div>
        {loadingList ? (
          <div className="p-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading…
          </div>
        ) : listError ? (
          <div className="p-6 text-center text-sm text-red-600">{listError}</div>
        ) : uploadedList.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">No payslips match the filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee code</th>
                  <th>Period</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Net</th>
                  <th>Currency</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {uploadedList.map((p) => (
                  <tr key={p.id} className="hover:bg-primary/5 transition-colors">
                    <td className="font-medium text-neutral-900 cursor-pointer" onClick={() => setSelectedPayslip(p)}>{p.user?.name ?? p.user?.email ?? "—"}</td>
                    <td className="font-mono text-neutral-600 text-sm cursor-pointer" onClick={() => setSelectedPayslip(p)}>{p.user?.employee_number ?? "—"}</td>
                    <td className="text-neutral-700 whitespace-nowrap cursor-pointer" onClick={() => setSelectedPayslip(p)}>{formatPeriod(p)}</td>
                    <td className="text-right text-neutral-700 cursor-pointer" onClick={() => setSelectedPayslip(p)}>{Number(p.gross_amount).toLocaleString()}</td>
                    <td className="text-right text-neutral-700 cursor-pointer" onClick={() => setSelectedPayslip(p)}>{Number(p.net_amount).toLocaleString()}</td>
                    <td className="text-neutral-600 cursor-pointer" onClick={() => setSelectedPayslip(p)}>{p.currency}</td>
                    <td>
                      {(p as AdminPayslip & { details?: object }).details ? (
                        <span className="badge-success text-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                          Auto-filled
                        </span>
                      ) : (
                        <span className="badge-muted text-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">pending</span>
                          Pending
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-2">
                          {p.user?.id && (
                            <Link
                              href={`/admin/payslip-config/${p.user.id}`}
                              className="text-xs text-primary hover:underline font-medium"
                              title="Configure payslip lines for this employee"
                            >
                              Configure
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRefresh(p.id)}
                            disabled={refreshingId === p.id}
                            className="text-xs text-neutral-500 hover:text-primary disabled:opacity-40"
                            title="Re-run auto-fill from system data"
                          >
                            {refreshingId === p.id ? (
                              <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[15px]">refresh</span>
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload zone — for HR managers and admins */}
      {canManage && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-neutral-300 hover:border-primary/50 hover:bg-neutral-50"}`}
          >
            <input ref={inputRef} type="file" multiple accept={PAYSLIP_ACCEPTED_TYPES} className="hidden" onChange={(e) => processFiles(e.target.files)} />
            <span className="material-symbols-outlined text-5xl text-neutral-300 mb-3 block" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>upload_file</span>
            <p className="text-sm font-semibold text-neutral-700">Drag & drop payslip files here</p>
            <p className="text-xs text-neutral-400 mt-1">or click to browse</p>
            <p className="text-xs text-neutral-400 mt-3">Accepts: <span className="font-medium">{PAYSLIP_ACCEPTED_TYPES.replace(/,/g, " · ")}</span></p>
            <p className="text-xs text-neutral-400 mt-1">Filename format: <code className="text-xs bg-neutral-100 px-1 rounded">EMP042_March2026.pdf</code></p>
          </div>

          {rows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-neutral-900">Upload Preview — {rows.length} file{rows.length !== 1 ? "s" : ""}</h2>
                <button type="button" onClick={handleUploadAll} disabled={uploading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                  {uploading ? (<><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Uploading…</>) : (<><span className="material-symbols-outlined text-[16px]">cloud_upload</span>Upload All</>)}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Employee # (editable)</th>
                      <th>Period (editable)</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-neutral-400 text-[16px]">{row.filename.endsWith(".pdf") ? "picture_as_pdf" : "table_chart"}</span>
                            <span className="text-xs font-mono text-neutral-600 max-w-[200px] truncate">{row.filename}</span>
                          </div>
                        </td>
                        <td>
                          <input className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={row.employeeNum} onChange={(e) => updateRow(row.id, "employeeNum", e.target.value)} />
                        </td>
                        <td>
                          <input type="month" className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[140px]" value={periodToMonthValue(row.period)} onChange={(e) => updateRow(row.id, "period", monthValueToPeriod(e.target.value))} />
                        </td>
                        <td>
                          <button type="button" onClick={() => removeRow(row.id)} className="text-neutral-300 hover:text-red-400 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
