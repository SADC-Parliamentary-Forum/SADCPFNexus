"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  adminApi,
  hrApi,
  payslipRefreshApi,
  type AdminPayslip,
  type PayslipDirectoryPerson,
  type PayslipPeriodCoverage,
} from "@/lib/api";
import { PAYSLIP_ACCEPTED_TYPES } from "@/lib/constants";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import {
  defaultPayPeriodValue,
  formatPayPeriod,
  isPayslipDocument,
  isPayslipZip,
  parsePeriodValue,
} from "@/lib/payslipPeriod";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";

type EnvelopeRow = {
  key: string;
  filename: string;
  file: File;
  archive: string | null;
  status: "matched" | "ambiguous" | "unmatched" | "zip";
  user: PayslipDirectoryPerson | null;
  candidates: PayslipDirectoryPerson[];
  existingPayslipId: number | null;
};

function StaffPicker({
  value,
  candidates,
  onSelect,
}: {
  value: PayslipDirectoryPerson | null;
  candidates?: PayslipDirectoryPerson[];
  onSelect: (person: PayslipDirectoryPerson | null) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<PayslipDirectoryPerson[]>(candidates ?? []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.id, value?.name]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q && candidates && candidates.length > 0) {
      setOptions(candidates);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      adminApi
        .payslipDirectory(q || undefined)
        .then((r) => setOptions(r.data.data ?? []))
        .catch(() => setOptions(candidates ?? []))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, open, candidates]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-[180px]">
      <input
        type="search"
        className="form-input w-full text-xs"
        placeholder="Assign to staff…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        aria-label="Assign payslip to staff member"
      />
      {open ? (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {loading ? (
            <p className="px-3 py-2 text-xs text-neutral-400">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">No staff found</p>
          ) : (
            options.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-primary/5"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(person);
                  setQuery(person.name);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-neutral-800 dark:text-neutral-100">{person.name}</span>
                <span className="text-neutral-400">
                  {person.employee_number ?? "No staff number"} · {person.email}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function statusChip(status: EnvelopeRow["status"]) {
  if (status === "matched") return <span className="badge badge-success">Matched</span>;
  if (status === "ambiguous") return <span className="badge badge-warning">Needs pick</span>;
  if (status === "zip") return <span className="badge badge-muted">ZIP</span>;
  return <span className="badge badge-warning">Unassigned</span>;
}

export function PayslipDistributionDesk({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const [periodValue, setPeriodValue] = useState(defaultPayPeriodValue);
  const period = parsePeriodValue(periodValue);
  const [rows, setRows] = useState<EnvelopeRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [matching, setMatching] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [issued, setIssued] = useState<AdminPayslip[]>([]);
  const [loadingIssued, setLoadingIssued] = useState(true);
  const [issuedError, setIssuedError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [coverage, setCoverage] = useState<PayslipPeriodCoverage | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AdminPayslip | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<"confirmed" | "rejected">("confirmed");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCanManage(
      isSystemAdmin(user) ||
        hasPermission(user, "hr.admin") ||
        !!user?.roles?.some((r) => ["HR Manager", "HR Administrator"].includes(r)),
    );
  }, []);

  const loadIssued = useCallback(() => {
    if (!period) return;
    setLoadingIssued(true);
    setIssuedError(null);
    Promise.all([
      adminApi.listPayslips({
        per_page: 100,
        period_month: period.month,
        period_year: period.year,
        search: search.trim() || undefined,
      }),
      adminApi.payslipPeriodCoverage(period.month, period.year),
    ])
      .then(([listRes, coverRes]) => {
        setIssued(Array.isArray(listRes.data?.data) ? listRes.data.data : []);
        setCoverage(coverRes.data.data);
      })
      .catch(() => setIssuedError("Failed to load payslips for this period."))
      .finally(() => setLoadingIssued(false));
  }, [period?.month, period?.year, search]);

  useEffect(() => {
    loadIssued();
  }, [loadIssued]);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || !period) return;
    const incoming = Array.from(fileList).filter(
      (f) => isPayslipDocument(f.name) || isPayslipZip(f.name),
    );
    if (incoming.length === 0) return;
    const zips = incoming.filter((f) => isPayslipZip(f.name));
    const docs = incoming.filter((f) => isPayslipDocument(f.name));
    setMatching(true);
    const nextRows: EnvelopeRow[] = [];
    try {
      if (docs.length > 0) {
        let docRows: EnvelopeRow[] = docs.map((file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}`,
          filename: file.name,
          file,
          archive: null,
          status: "unmatched" as const,
          user: null,
          candidates: [],
          existingPayslipId: null,
        }));
        try {
          const preview = await adminApi.matchPayslips({
            filenames: docs.map((f) => f.name),
            period_month: period.month,
            period_year: period.year,
          });
          const byName = new Map(preview.data.data.items.map((item) => [item.filename, item]));
          docRows = docs.map((file) => {
            const item = byName.get(file.name);
            const user = item?.user ?? (item?.candidates.length === 1 ? item.candidates[0] : null);
            return {
              key: `${file.name}-${file.size}-${file.lastModified}`,
              filename: file.name,
              file,
              archive: null,
              status: item?.status ?? "unmatched",
              user,
              candidates: item?.candidates ?? [],
              existingPayslipId: item?.existing_payslip_id ?? null,
            };
          });
        } catch {
          error("Could not match filenames. You can still assign each file by hand.");
        }
        nextRows.push(...docRows);
      }
      for (const zip of zips) {
        try {
          const form = new FormData();
          form.append("period_month", String(period.month));
          form.append("period_year", String(period.year));
          form.append("files[]", zip, zip.name);
          const preview = await adminApi.matchPayslipUploads(form);
          const items = preview.data.data.items;
          if (items.length === 0) {
            error(`${zip.name} did not contain any PDF or spreadsheet payslips.`);
            continue;
          }
          nextRows.push(
            ...items.map((item) => {
              const user = item.user ?? (item.candidates.length === 1 ? item.candidates[0] : null);
              return {
                key: `${zip.name}:${item.filename}`,
                filename: item.filename,
                file: zip,
                archive: zip.name,
                status: item.status,
                user,
                candidates: item.candidates ?? [],
                existingPayslipId: item.existing_payslip_id ?? null,
              };
            }),
          );
        } catch {
          error(`Could not open ${zip.name}. Drop the PDFs instead, or issue the ZIP as-is.`);
          nextRows.push({
            key: `${zip.name}-${zip.size}-${zip.lastModified}`,
            filename: zip.name,
            file: zip,
            archive: zip.name,
            status: "zip",
            user: null,
            candidates: [],
            existingPayslipId: null,
          });
        }
      }
    } finally {
      setMatching(false);
    }
    setRows((prev) => {
      const next = [...prev];
      for (const row of nextRows) {
        const idx = next.findIndex((r) => r.key === row.key || (r.filename === row.filename && r.archive === row.archive));
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      }
      return next;
    });
  };

  const assignable = rows.filter((r) => r.status !== "zip");
  const readyCount = rows.filter((r) => r.status === "zip" || r.user).length;
  const unassignedCount = assignable.filter((r) => !r.user).length;
  const replaceCount = rows.filter((r) => r.existingPayslipId).length;
  const duplicatePeople = useMemo(() => {
    const counts = new Map<number, string[]>();
    for (const row of rows) {
      if (!row.user) continue;
      const list = counts.get(row.user.id) ?? [];
      list.push(row.filename);
      counts.set(row.user.id, list);
    }
    return [...counts.values()].filter((files) => files.length > 1);
  }, [rows]);

  const assignPersonToNextFile = (person: PayslipDirectoryPerson) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.status !== "zip" && !r.user);
      if (idx < 0) return prev;
      return prev.map((r, i) =>
        i === idx ? { ...r, user: person, status: "matched" } : r,
      );
    });
  };

  const handleIssue = async () => {
    if (!period || rows.length === 0) return;
    if (unassignedCount > 0) {
      const ok = await confirm({
        title: "Issue without every file assigned?",
        message: `${unassignedCount} file${unassignedCount === 1 ? "" : "s"} have no staff member. They will be skipped.`,
        confirmText: "Issue the rest",
        variant: "primary",
      });
      if (!ok) return;
    }
    if (duplicatePeople.length > 0) {
      const ok = await confirm({
        title: "Two files for the same person?",
        message: "Each staff member can only receive one payslip for this month. Extra files for the same person will be skipped.",
        confirmText: "Issue the first of each",
        variant: "danger",
      });
      if (!ok) return;
    }
    if (replaceCount > 0) {
      const ok = await confirm({
        title: "Replace existing payslips?",
        message: `${replaceCount} staff already have a file for ${formatPayPeriod(period.month, period.year)}. Issuing again replaces the document and resets salary confirmation.`,
        confirmText: "Replace and issue",
        variant: "danger",
      });
      if (!ok) return;
    }
    setIssuing(true);
    try {
      const form = new FormData();
      form.append("period_month", String(period.month));
      form.append("period_year", String(period.year));
      form.append(
        "assignments",
        JSON.stringify(
          rows
            .filter((r) => r.user)
            .map((r) => ({ filename: r.filename, user_id: r.user!.id })),
        ),
      );
      const unique = new Map<string, File>();
      for (const row of rows) {
        unique.set(`${row.file.name}:${row.file.size}:${row.file.lastModified}`, row.file);
      }
      unique.forEach((file) => form.append("files[]", file, file.name));
      const res = await adminApi.distributePayslips(form);
      const failed = res.data.data.failed?.length ?? 0;
      success(
        `${res.data.data.issued + res.data.data.replaced} payslip${res.data.data.issued + res.data.data.replaced === 1 ? "" : "s"} issued.${failed ? ` ${failed} skipped.` : ""}`,
      );
      setRows([]);
      loadIssued();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error(message ?? "Could not issue payslips.");
    } finally {
      setIssuing(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await hrApi.confirmPayslip(confirmTarget.id, {
        confirmation_status: confirmStatus,
        confirmation_notes: confirmNotes || undefined,
      });
      success(`Payslip ${confirmStatus}.`);
      setConfirmTarget(null);
      setConfirmNotes("");
      loadIssued();
    } catch {
      error("Confirmation failed.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const lastPage = clientPageCount(issued.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(issued, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [issued, page, lastPage],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RegisterShell
        title="Issue payslips"
        subtitle="Pick the pay month once, drop the files, assign anyone the filename missed, then issue."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: homeLabel, href: homeHref }, { label: "Payslips" }]} />
        }
        stats={
          coverage ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-xs text-neutral-500">Issued this month</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.issued}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-neutral-500">Still missing</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.missing}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-neutral-500">Active staff</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.staff}</p>
              </div>
            </div>
          ) : undefined
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="payslip-period">
                Pay period
              </label>
              <input
                id="payslip-period"
                type="month"
                className="form-input"
                value={periodValue}
                onChange={(e) => {
                  setPeriodValue(e.target.value);
                  setPage(1);
                  setRows([]);
                }}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <Input
                label="Search issued"
                icon="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Name, email, or staff number"
              />
            </div>
          </div>
        }
        density={density}
        onDensityChange={setDensity}
        page={Math.min(page, lastPage)}
        pageCount={lastPage}
        total={issued.length}
        onPageChange={setPage}
        loading={loadingIssued}
        empty={
          !loadingIssued && issued.length === 0 ? (
            issuedError ? (
              <EmptyState icon="error" title="Could not load payslips" description={issuedError} />
            ) : (
              <EmptyState
                icon="receipt_long"
                title={`No payslips for ${period ? formatPayPeriod(period.month, period.year) : "this period"}`}
                description="Drop files into the envelope below. Filenames such as EMP042_August2026.pdf or Jane_Doe.pdf are matched automatically."
              />
            )
          ) : undefined
        }
      >
        {issued.length > 0 ? (
          <>
            <div className="card hidden overflow-hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Staff no.</th>
                    <th>Net</th>
                    <th>File</th>
                    <th>Salary confirm</th>
                    {canManage ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-neutral-900 dark:text-neutral-100">{p.user?.name ?? "—"}</td>
                      <td className="font-mono text-xs text-neutral-600">{p.user?.employee_number ?? "—"}</td>
                      <td>
                        {p.currency} {Number(p.net_amount || 0).toLocaleString()}
                      </td>
                      <td>{p.has_file ? <span className="badge badge-success">On file</span> : <span className="badge badge-muted">No file</span>}</td>
                      <td>
                        {p.confirmation_status === "confirmed" ? (
                          <span className="badge badge-success">Confirmed</span>
                        ) : p.confirmation_status === "rejected" ? (
                          <span className="badge badge-danger">Rejected</span>
                        ) : canManage ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => {
                              setConfirmTarget(p);
                              setConfirmStatus("confirmed");
                              setConfirmNotes("");
                            }}
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="badge badge-muted">Pending</span>
                        )}
                      </td>
                      {canManage ? (
                        <td>
                          <div className="flex gap-2">
                            {p.user?.id ? (
                              <Link href={`/admin/payslip-config/${p.user.id}`} className="text-xs text-primary hover:underline">
                                Lines
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="text-neutral-400 hover:text-primary"
                              title="Refresh auto-fill"
                              disabled={refreshingId === p.id}
                              onClick={async () => {
                                setRefreshingId(p.id);
                                try {
                                  await payslipRefreshApi.refresh(p.id);
                                  success("Auto-fill refreshed.");
                                  loadIssued();
                                } catch {
                                  error("Refresh failed.");
                                } finally {
                                  setRefreshingId(null);
                                }
                              }}
                            >
                              <span className={`material-symbols-outlined text-[16px] ${refreshingId === p.id ? "animate-spin" : ""}`}>refresh</span>
                            </button>
                            <button type="button" className="text-xs text-primary hover:underline" onClick={() => adminApi.downloadPayslip(p.id).catch(() => error("Download failed."))}>
                              Download
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <RegisterMobileCards
              items={paged}
              getKey={(p) => p.id}
              title={(p) => p.user?.name ?? "Payslip"}
              subtitle={(p) => p.user?.employee_number ?? p.user?.email ?? ""}
              badge={(p) =>
                p.confirmation_status === "confirmed" ? (
                  <span className="badge badge-success">Confirmed</span>
                ) : (
                  <span className="badge badge-muted">Pending</span>
                )
              }
              fields={(p) => [
                { label: "Net", value: `${p.currency} ${Number(p.net_amount || 0).toLocaleString()}` },
                { label: "File", value: p.has_file ? "On file" : "Missing" },
              ]}
            />
          </>
        ) : null}
      </RegisterShell>

      {canManage ? (
        <FormSection
          title={`Envelope — ${period ? formatPayPeriod(period.month, period.year) : "choose a period"}`}
          description="Drop a ZIP from payroll or many PDFs. We match staff numbers and names; you only assign the leftovers."
          icon="mail"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-neutral-300 hover:border-primary/40 dark:border-neutral-700"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={PAYSLIP_ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="material-symbols-outlined mb-2 block text-4xl text-neutral-300">upload_file</span>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {matching ? "Matching staff…" : "Drop payslip PDFs or a ZIP"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              EMP042_August2026.pdf · Jane_Doe.pdf · payroll-export.zip
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  {readyCount} ready · {unassignedCount} need a person
                  {replaceCount > 0 ? ` · ${replaceCount} will replace an existing file` : ""}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => setRows([])}>
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={issuing || readyCount === 0}
                    onClick={() => void handleIssue()}
                  >
                    {issuing ? "Issuing…" : `Issue ${readyCount} file${readyCount === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Match</th>
                    <th>Staff</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-neutral-400">
                            {row.status === "zip" ? "folder_zip" : "picture_as_pdf"}
                          </span>
                          <span className="max-w-[220px] truncate font-mono text-xs">{row.filename}</span>
                          {row.archive ? (
                            <span className="badge badge-muted" title={row.archive}>
                              ZIP
                            </span>
                          ) : null}
                          {row.existingPayslipId ? (
                            <span className="badge badge-warning">Replace</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{statusChip(row.status)}</td>
                      <td>
                        {row.status === "zip" ? (
                          <span className="text-xs text-neutral-500">Unpacked and matched when you issue</span>
                        ) : (
                          <StaffPicker
                            value={row.user}
                            candidates={row.candidates}
                            onSelect={(person) =>
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, user: person, status: person ? "matched" : "unmatched" }
                                    : r,
                                ),
                              )
                            }
                          />
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-neutral-300 hover:text-red-500"
                          aria-label={`Remove ${row.filename}`}
                          onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      {coverage && coverage.missing.length > 0 ? (
        <FormSection
          title="Still missing a file"
          description={
            unassignedCount > 0
              ? "Click Assign to attach the next unassigned file in the envelope."
              : "Active staff with no payslip for this period. Drop their file, or assign an unmatched file to them above."
          }
          icon="person_off"
        >
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {coverage.missing.slice(0, 12).map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-neutral-800 dark:text-neutral-100">{person.name}</span>
                  <span className="font-mono text-xs text-neutral-400">{person.employee_number ?? person.email}</span>
                </span>
                {unassignedCount > 0 ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                    onClick={() => assignPersonToNextFile(person)}
                  >
                    Assign
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {coverage.missing.length > 12 ? (
            <p className="mt-2 text-xs text-neutral-400">{coverage.missing.length - 12} more not shown</p>
          ) : null}
        </FormSection>
      ) : null}

      {confirmTarget ? (
        <Modal open title="Confirm salary" onClose={() => setConfirmTarget(null)} size="md">
          <p className="text-sm text-neutral-600">
            {confirmTarget.user?.name ?? "Staff"} — {formatPayPeriod(confirmTarget.period_month, confirmTarget.period_year)}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmStatus("confirmed")}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${confirmStatus === "confirmed" ? "border-green-400 bg-green-50 text-green-700" : "border-neutral-200"}`}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmStatus("rejected")}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${confirmStatus === "rejected" ? "border-red-400 bg-red-50 text-red-700" : "border-neutral-200"}`}
            >
              Reject
            </button>
          </div>
          <textarea
            className="form-input mt-3 h-20 resize-none"
            placeholder="Optional note"
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
          />
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary flex-1" disabled={confirmLoading} onClick={() => void handleConfirm()}>
              {confirmLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
