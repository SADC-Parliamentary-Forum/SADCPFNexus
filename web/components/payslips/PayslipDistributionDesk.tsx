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
import { DEFAULT_PAGE_SIZE, clientPageCount, getLastPage, getListData, slicePage } from "@/lib/listPagination";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

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
  const { t } = useI18n();
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
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminApi
        .payslipDirectory(q || undefined)
        .then((r) => setOptions(r.data.data ?? []))
        .catch(() => setOptions(candidates ?? []))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
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
        placeholder={t("payslips.desk.assignPlaceholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        aria-label={t("payslips.desk.assignAria")}
      />
      {open ? (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {loading ? (
            <p className="px-3 py-2 text-xs text-neutral-400">{t("payslips.desk.searching")}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">{t("payslips.desk.noStaff")}</p>
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
                  {person.employee_number ?? t("payslips.desk.noStaffNumber")} · {person.email}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function statusChip(status: EnvelopeRow["status"], t: Translate) {
  if (status === "matched") return <span className="badge badge-success">{t("payslips.desk.chip.matched")}</span>;
  if (status === "ambiguous") return <span className="badge badge-warning">{t("payslips.desk.chip.ambiguous")}</span>;
  if (status === "zip") return <span className="badge badge-muted">{t("payslips.desk.chip.zip")}</span>;
  return <span className="badge badge-warning">{t("payslips.desk.chip.unassigned")}</span>;
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
  const { t } = useI18n();
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
        hasPermission(user, ["hr.admin", "hr.edit"]) ||
        !!user?.roles?.some((r) => ["HR Manager", "HR Administrator"].includes(r)),
    );
  }, []);

  const loadIssued = useCallback(() => {
    if (!period) return;
    setLoadingIssued(true);
    setIssuedError(null);
    Promise.all([
      (async () => {
        const first = await adminApi.listPayslips({
          per_page: 100,
          page: 1,
          period_month: period.month,
          period_year: period.year,
          search: search.trim() || undefined,
        });
        const rows = getListData<AdminPayslip>(first.data);
        const lastPage = Math.min(getLastPage(first.data), 10);
        if (lastPage <= 1) return rows;
        const rest = await Promise.all(
          Array.from({ length: lastPage - 1 }, (_, i) =>
            adminApi.listPayslips({
              per_page: 100,
              page: i + 2,
              period_month: period.month,
              period_year: period.year,
              search: search.trim() || undefined,
            }),
          ),
        );
        return rows.concat(...rest.map((r) => getListData<AdminPayslip>(r.data)));
      })(),
      adminApi.payslipPeriodCoverage(period.month, period.year),
    ])
      .then(([list, coverRes]) => {
        setIssued(list);
        setCoverage(coverRes.data.data);
      })
      .catch(() => setIssuedError(t("payslips.desk.loadFailed")))
      .finally(() => setLoadingIssued(false));
  }, [period?.month, period?.year, search, t]);

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
          error(t("payslips.desk.matchFailed"));
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
            error(t("payslips.desk.zipEmpty", { name: zip.name }));
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
          error(t("payslips.desk.zipFailed", { name: zip.name }));
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
        title: t("payslips.desk.confirm.unassignedTitle"),
        message: t(unassignedCount === 1 ? "payslips.desk.confirm.unassignedOne" : "payslips.desk.confirm.unassignedMany", { count: unassignedCount }),
        confirmText: t("payslips.desk.confirm.unassignedOk"),
        variant: "primary",
      });
      if (!ok) return;
    }
    if (duplicatePeople.length > 0) {
      const ok = await confirm({
        title: t("payslips.desk.confirm.duplicateTitle"),
        message: t("payslips.desk.confirm.duplicateMessage"),
        confirmText: t("payslips.desk.confirm.duplicateOk"),
        variant: "danger",
      });
      if (!ok) return;
    }
    if (replaceCount > 0) {
      const ok = await confirm({
        title: t("payslips.desk.confirm.replaceTitle"),
        message: t("payslips.desk.confirm.replaceMessage", { count: replaceCount, period: formatPayPeriod(period.month, period.year) }),
        confirmText: t("payslips.desk.confirm.replaceOk"),
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
      const issuedCount = res.data.data.issued + res.data.data.replaced;
      const issuedMsg = t(issuedCount === 1 ? "payslips.desk.issuedOne" : "payslips.desk.issuedMany", { count: issuedCount });
      success(failed ? `${issuedMsg} ${t("payslips.desk.skipped", { count: failed })}` : issuedMsg);
      setRows([]);
      loadIssued();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error(message ?? t("payslips.desk.issueFailed"));
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
      success(t(confirmStatus === "confirmed" ? "payslips.desk.payslipConfirmed" : "payslips.desk.payslipRejected"));
      setConfirmTarget(null);
      setConfirmNotes("");
      loadIssued();
    } catch {
      error(t("payslips.desk.confirmFailed"));
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
    <div className="w-full min-w-0 space-y-5">
      <RegisterShell
        title="payslips.issue"
        subtitle="payslips.desk.subtitle"
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: homeLabel, href: homeHref }, { label: "finance.hub.payslips" }]} />
        }
        stats={
          coverage ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-xs text-neutral-500">{t("payslips.desk.stat.issued")}</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.issued}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-neutral-500">{t("payslips.desk.stat.missing")}</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.missing}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-neutral-500">{t("payslips.desk.stat.staff")}</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{coverage.totals.staff}</p>
              </div>
            </div>
          ) : undefined
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="payslip-period" className="mb-1 block text-xs font-medium text-neutral-500">
                {t("payslips.desk.payPeriod")}
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
                label={t("payslips.desk.searchIssued")}
                icon="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("payslips.desk.searchPlaceholder")}
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
              <EmptyState icon="error" title="finance.payslips.couldNotLoad" description={issuedError} />
            ) : (
              <EmptyState
                icon="receipt_long"
                title={period ? t("payslips.desk.emptyFor", { period: formatPayPeriod(period.month, period.year) }) : t("payslips.desk.emptyThisPeriod")}
                description="payslips.desk.emptyHint"
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
                    <th>{t("finance.payrollImports.col.employee")}</th>
                    <th>{t("payslips.desk.col.staffNo")}</th>
                    <th>{t("finance.payrollImports.col.net")}</th>
                    <th>{t("finance.payslips.col.file")}</th>
                    <th>{t("payslips.desk.col.salaryConfirm")}</th>
                    {canManage ? <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th> : null}
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
                      <td>{p.has_file ? <span className="badge badge-success">{t("finance.payslips.onFile")}</span> : <span className="badge badge-muted">{t("payslips.desk.noFile")}</span>}</td>
                      <td>
                        {p.confirmation_status === "confirmed" ? (
                          <span className="badge badge-success">{t("finance.payslips.confirmed")}</span>
                        ) : p.confirmation_status === "rejected" ? (
                          <span className="badge badge-danger">{t("status.rejected")}</span>
                        ) : canManage ? (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => {
                              setConfirmTarget(p);
                              setConfirmStatus("confirmed");
                              setConfirmNotes("");
                            }}
                          >
                            {t("common.confirm")}
                          </button>
                        ) : (
                          <span className="badge badge-muted">{t("finance.hub.status.pending")}</span>
                        )}
                      </td>
                      {canManage ? (
                        <td>
                          <div className="flex gap-2">
                            {p.user?.id ? (
                              <Link href={`/admin/payslip-config/${p.user.id}`} className="btn-secondary text-xs">
                                {t("payslips.desk.lines")}
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="text-neutral-400 hover:text-primary"
                              title={t("payslips.desk.refreshAutofill")}
                              aria-label={t("payslips.desk.refreshAutofill")}
                              disabled={refreshingId === p.id}
                              onClick={async () => {
                                setRefreshingId(p.id);
                                try {
                                  await payslipRefreshApi.refresh(p.id);
                                  success(t("payslips.desk.refreshed"));
                                  loadIssued();
                                } catch {
                                  error(t("payslips.desk.refreshFailed"));
                                } finally {
                                  setRefreshingId(null);
                                }
                              }}
                            >
                              <span className={`material-symbols-outlined text-[16px] ${refreshingId === p.id ? "animate-spin" : ""}`}>refresh</span>
                            </button>
                            <button type="button" className="btn-secondary text-xs" onClick={() => adminApi.downloadPayslip(p.id).catch(() => error(t("payslips.desk.downloadFailed")))}>
                              {t("common.download")}
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
              title={(p) => p.user?.name ?? t("payslips.desk.payslip")}
              subtitle={(p) => p.user?.employee_number ?? p.user?.email ?? ""}
              badge={(p) =>
                p.confirmation_status === "confirmed" ? (
                  <span className="badge badge-success">{t("finance.payslips.confirmed")}</span>
                ) : (
                  <span className="badge badge-muted">{t("finance.hub.status.pending")}</span>
                )
              }
              fields={(p) => [
                { label: t("finance.payrollImports.col.net"), value: `${p.currency} ${Number(p.net_amount || 0).toLocaleString()}` },
                { label: t("finance.payslips.col.file"), value: p.has_file ? t("finance.payslips.onFile") : t("payslips.desk.missing") },
              ]}
            />
          </>
        ) : null}
      </RegisterShell>

      {canManage ? (
        <FormSection
          title={t("payslips.desk.envelope", { period: period ? formatPayPeriod(period.month, period.year) : t("payslips.desk.choosePeriod") })}
          description="payslips.desk.envelopeHint"
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
              {matching ? t("payslips.desk.matching") : t("payslips.desk.dropHint")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              EMP042_August2026.pdf · Jane_Doe.pdf · payroll-export.zip {/* i18n-ignore */}
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  {t("payslips.desk.readySummary", { ready: readyCount, unassigned: unassignedCount })}
                  {replaceCount > 0 ? ` · ${t("payslips.desk.willReplace", { count: replaceCount })}` : ""}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => setRows([])}>
                    {t("ui.bulkSelection.clear")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={issuing || readyCount === 0}
                    onClick={() => void handleIssue()}
                  >
                    {issuing ? t("payslips.desk.issuing") : t(readyCount === 1 ? "payslips.desk.issueOne" : "payslips.desk.issueMany", { count: readyCount })}
                  </button>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("finance.payslips.col.file")}</th>
                    <th>{t("payslips.desk.col.match")}</th>
                    <th>{t("payslips.desk.col.staff")}</th>
                    <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
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
                              {t("payslips.desk.chip.zip")}
                            </span>
                          ) : null}
                          {row.existingPayslipId ? (
                            <span className="badge badge-warning">{t("payslips.desk.replace")}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{statusChip(row.status, t)}</td>
                      <td>
                        {row.status === "zip" ? (
                          <span className="text-xs text-neutral-500">{t("payslips.desk.zipLater")}</span>
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
                          aria-label={t("payslips.desk.removeFile", { name: row.filename })}
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
          title="payslips.desk.missingTitle"
          description={
            unassignedCount > 0
              ? "payslips.desk.missingAssignHint"
              : "payslips.desk.missingHint"
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
                    className="shrink-0 btn-secondary text-xs"
                    onClick={() => assignPersonToNextFile(person)}
                  >
                    {t("payslips.desk.assign")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {coverage.missing.length > 12 ? (
            <p className="mt-2 text-xs text-neutral-400">{t("payslips.desk.moreNotShown", { count: coverage.missing.length - 12 })}</p>
          ) : null}
        </FormSection>
      ) : null}

      {confirmTarget ? (
        <Modal open title={t("payslips.desk.confirmSalary")} onClose={() => setConfirmTarget(null)} size="md">
          <p className="text-sm text-neutral-600">
            {confirmTarget.user?.name ?? t("payslips.desk.staff")} — {formatPayPeriod(confirmTarget.period_month, confirmTarget.period_year)}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmStatus("confirmed")}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${confirmStatus === "confirmed" ? "border-green-400 bg-green-50 text-green-700" : "border-neutral-200"}`}
            >
              {t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmStatus("rejected")}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${confirmStatus === "rejected" ? "border-red-400 bg-red-50 text-red-700" : "border-neutral-200"}`}
            >
              {t("common.reject")}
            </button>
          </div>
          <textarea
            className="form-input mt-3 h-20 resize-none"
            placeholder={t("payslips.desk.optionalNote")}
            aria-label={t("payslips.desk.optionalNote")}
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
          />
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmTarget(null)}>
              {t("common.cancel")}
            </button>
            <button type="button" className="btn-primary flex-1" disabled={confirmLoading} onClick={() => void handleConfirm()}>
              {confirmLoading ? t("decisions.create.saving") : t("common.save")}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
