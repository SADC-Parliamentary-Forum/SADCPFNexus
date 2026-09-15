"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  tenantUsersApi,
  timesheetImportApi,
  type TenantUserOption,
  type TimesheetImportBatch,
  type TimesheetImportRow,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { ListPagination } from "@/components/ui/ListPagination";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const FILTERS = [
  "all",
  "valid",
  "warnings",
  "errors",
  "duplicates",
  "unmatched",
  "unmapped_project",
  "multi_day",
] as const;

const POLL_STATUSES = new Set(["uploaded", "detecting", "mapping", "validating", "processing"]);

function progressLabel(step: string | null | undefined, t: (key: string) => string): string {
  if (!step) return t("timesheet.import.progress");
  return t(`timesheet.import.step.${step}`);
}

function apiError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    if (data?.message) return data.message;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
    if (first) return first;
  }
  return fallback;
}

export function TimesheetImportWizard({
  variant,
  initialBatchId,
}: {
  variant: "self" | "admin";
  initialBatchId?: number;
}) {
  const { t } = useI18n();
  const { prompt } = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"single" | "multi">(variant === "admin" ? "multi" : "single");
  const [targetUserId, setTargetUserId] = useState<number | "">("");
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [importAsVerified, setImportAsVerified] = useState(false);
  const [justification, setJustification] = useState("");
  const [batch, setBatch] = useState<TimesheetImportBatch | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [rows, setRows] = useState<TimesheetImportRow[]>([]);
  const [unmatched, setUnmatched] = useState<Array<{ email: string; name?: string | null }>>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, number | "">>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "admin") return;
    tenantUsersApi.list().then((res) => setUsers(res.data.data ?? [])).catch(() => undefined);
  }, [variant]);

  const loadPreview = useCallback(async (id: number, nextFilter = filter, nextPage = page) => {
    const res = await timesheetImportApi.show(id, {
      filter: nextFilter === "all" ? undefined : nextFilter,
      page: nextPage,
      per_page: 50,
    });
    const payload = res.data.data;
    setBatch(payload.batch);
    setCounts(payload.counts ?? null);
    setRows(payload.rows?.data ?? []);
    setPage(payload.rows?.current_page ?? 1);
    setLastPage(payload.rows?.last_page ?? 1);
    setTotal(payload.rows?.total ?? 0);
    setUnmatched(payload.unmatched_employees ?? []);
    return payload.batch;
  }, [filter, page]);

  useEffect(() => {
    if (!initialBatchId) return;
    void loadPreview(initialBatchId, "all", 1).catch((err) => setError(apiError(err, t("common.error"))));
  }, [initialBatchId, loadPreview, t]);

  useEffect(() => {
    if (!batch || !POLL_STATUSES.has(batch.status)) return;
    const timer = window.setInterval(() => {
      void loadPreview(batch.id, filter, page).catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [batch, filter, page, loadPreview]);

  const downloadTemplate = async () => {
    setBusy("template");
    setError(null);
    try {
      await timesheetImportApi.downloadTemplate();
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError(t("timesheet.import.noFile"));
      return;
    }
    if (variant === "admin" && mode === "single" && !targetUserId) {
      setError(t("timesheet.import.employee"));
      return;
    }
    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      const extra =
        variant === "self"
          ? { mode: "self" }
          : {
              mode,
              target_user_id: mode === "single" && targetUserId ? Number(targetUserId) : undefined,
              import_as_verified: importAsVerified,
              justification: importAsVerified ? justification : undefined,
            };
      const res = await timesheetImportApi.upload(file, extra);
      const uploaded = res.data.data;
      setBatch(uploaded);
      setMessage(res.data.message);
      await loadPreview(uploaded.id, "all", 1);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    if (!batch) return;
    setBusy("confirm");
    setError(null);
    try {
      const res = await timesheetImportApi.confirm(batch.id, true);
      setBatch(res.data.data);
      setMessage(res.data.message);
      await loadPreview(batch.id, filter, page);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onMap = async () => {
    if (!batch) return;
    const employee_maps = Object.entries(employeeMap)
      .filter(([, userId]) => typeof userId === "number" && userId > 0)
      .map(([email, userId]) => ({ email, user_id: Number(userId) }));
    if (employee_maps.length === 0) return;
    setBusy("map");
    setError(null);
    try {
      await timesheetImportApi.map(batch.id, { employee_maps, apply_to_all: true });
      await loadPreview(batch.id, filter, 1);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onVerify = async () => {
    if (!batch) return;
    const reason = await prompt({
      title: t("timesheet.import.verify"),
      label: t("timesheet.import.justification"),
      required: true,
    });
    if (!reason) return;
    setBusy("verify");
    try {
      const res = await timesheetImportApi.verify(batch.id, reason);
      setBatch(res.data.data);
      setMessage(res.data.message);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onRollback = async () => {
    if (!batch) return;
    const reason = await prompt({
      title: t("timesheet.import.rollback"),
      label: t("common.reason"),
      required: true,
      variant: "danger",
    });
    if (!reason) return;
    setBusy("rollback");
    try {
      const res = await timesheetImportApi.rollback(batch.id, reason);
      setBatch(res.data.data);
      setMessage(res.data.message);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onReverse = async () => {
    if (!batch) return;
    const reason = await prompt({
      title: t("timesheet.import.reverse"),
      label: t("common.reason"),
      required: true,
      variant: "danger",
    });
    if (!reason) return;
    setBusy("reverse");
    try {
      const res = await timesheetImportApi.reverse(batch.id, reason);
      setBatch(res.data.data);
      setMessage(res.data.message);
    } catch (err) {
      setError(apiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const ready = batch && ["preview_ready", "imported", "partial", "verified", "failed"].includes(batch.status);
  const canConfirm = batch?.status === "preview_ready" && (batch.valid_rows + batch.warning_rows) > 0;
  const canVerify = variant === "admin" && (batch?.status === "imported" || batch?.status === "partial");
  const canRollback = variant === "admin" && batch && ["imported", "partial", "preview_ready"].includes(batch.status);
  const canReverse = variant === "admin" && batch?.status === "verified";

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} /> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <FormSection title="timesheet.import.template" icon="download">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => void downloadTemplate()} disabled={busy === "template"} data-testid="timesheet-import-template">
            {t("timesheet.import.template")}
          </Button>
          {variant === "self" ? (
            <Link href="/hr/timesheets/import/history" className="btn-secondary text-sm">
              {t("timesheet.import.historyTitle")}
            </Link>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="timesheet.import.upload" icon="upload_file">
        <form className="space-y-4" onSubmit={(event) => void onUpload(event)}>
          {variant === "admin" ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("timesheet.import.mode")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="import-mode" checked={mode === "single"} onChange={() => setMode("single")} />
                {t("timesheet.import.modeA")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="import-mode" checked={mode === "multi"} onChange={() => setMode("multi")} />
                {t("timesheet.import.modeB")}
              </label>
              {mode === "single" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-neutral-600">{t("timesheet.import.employee")}</span>
                  <select className="form-input" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">{t("timesheet.import.employee")}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-neutral-400">{t("timesheet.import.employeeHint")}</span>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={importAsVerified} onChange={(e) => setImportAsVerified(e.target.checked)} />
                {t("timesheet.import.verified")}
              </label>
              {importAsVerified ? (
                <textarea
                  className="form-input"
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder={t("timesheet.import.justification")}
                />
              ) : null}
            </fieldset>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">{t("timesheet.import.file")}</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              data-testid="timesheet-import-file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="submit" disabled={busy === "upload"} data-testid="timesheet-import-upload">
            {busy === "upload" ? t("timesheet.import.uploading") : t("timesheet.import.upload")}
          </Button>
        </form>
      </FormSection>

      {batch ? (
        <FormSection title="timesheet.import.progress" icon="hourglass_top">
          <p className="text-sm text-neutral-700" data-testid="timesheet-import-progress">
            {batch.reference} · {batch.status} · {progressLabel(batch.progress_step, t)}
          </p>
          {counts ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["uploaded_rows", "timesheet.import.counts.uploaded"],
                ["valid_entries", "timesheet.import.counts.valid"],
                ["warnings", "timesheet.import.counts.warnings"],
                ["errors", "timesheet.import.counts.errors"],
                ["possible_duplicates", "timesheet.import.counts.duplicates"],
                ["employees_detected", "timesheet.import.counts.employees"],
              ].map(([key, label]) => (
                <div key={key} className="rounded-lg border border-neutral-200 px-3 py-2">
                  <dt className="text-xs text-neutral-500">{t(label)}</dt>
                  <dd className="text-lg font-semibold text-neutral-900">{counts[key] ?? 0}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </FormSection>
      ) : null}

      {variant === "admin" && unmatched.length > 0 ? (
        <FormSection title="timesheet.import.filterUnmatched" icon="person_search">
          <div className="space-y-3">
            {unmatched.map((row) => (
              <label key={row.email} className="grid gap-2 sm:grid-cols-2 text-sm">
                <span>{row.name ? `${row.name} (${row.email})` : row.email}</span>
                <select
                  className="form-input"
                  value={employeeMap[row.email] ?? ""}
                  onChange={(e) => setEmployeeMap((prev) => ({ ...prev, [row.email]: e.target.value ? Number(e.target.value) : "" }))}
                >
                  <option value="">{t("timesheet.import.mapUser")}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </label>
            ))}
            <Button type="button" variant="secondary" onClick={() => void onMap()} disabled={busy === "map"}>
              {t("timesheet.import.map")}
            </Button>
          </div>
        </FormSection>
      ) : variant === "admin" && batch && ready ? (
        <EmptyState icon="group" title="timesheet.import.emptyUnmatched" />
      ) : null}

      {batch && ready ? (
        <FormSection
          title="timesheet.import.filterAll"
          icon="table_rows"
          actions={
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === item ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}
                  onClick={() => {
                    setFilter(item);
                    setPage(1);
                    if (batch) void loadPreview(batch.id, item, 1);
                  }}
                >
                  {t(
                    item === "all" ? "timesheet.import.filterAll"
                      : item === "valid" ? "timesheet.import.filterValid"
                      : item === "warnings" ? "timesheet.import.filterWarnings"
                      : item === "errors" ? "timesheet.import.filterErrors"
                      : item === "duplicates" ? "timesheet.import.filterDuplicates"
                      : item === "unmatched" ? "timesheet.import.filterUnmatched"
                      : item === "unmapped_project" ? "timesheet.import.filterUnmapped"
                      : "timesheet.import.filterMultiDay",
                  )}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {canConfirm ? (
              <Button type="button" onClick={() => void onConfirm()} disabled={Boolean(busy)} data-testid="timesheet-import-confirm">
                {busy === "confirm" ? t("timesheet.import.confirming") : t("timesheet.import.confirm")}
              </Button>
            ) : null}
            {(batch.error_rows > 0 || batch.duplicate_rows > 0) ? (
              <Button type="button" variant="secondary" onClick={() => void timesheetImportApi.downloadFailures(batch.id)}>
                {t("timesheet.import.failures")}
              </Button>
            ) : null}
            {canVerify ? (
              <Button type="button" variant="secondary" onClick={() => void onVerify()}>{t("timesheet.import.verify")}</Button>
            ) : null}
            {canRollback ? (
              <Button type="button" variant="danger" onClick={() => void onRollback()}>{t("timesheet.import.rollback")}</Button>
            ) : null}
            {canReverse ? (
              <Button type="button" variant="danger" onClick={() => void onReverse()}>{t("timesheet.import.reverse")}</Button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <EmptyState icon="inbox" title="timesheet.import.emptyPreview" className="min-h-0 py-8" />
          ) : (
            <div className="overflow-x-auto" data-testid="timesheet-import-preview">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("timesheet.import.colRow")}</th>
                    <th>{t("timesheet.import.colStatus")}</th>
                    <th>{t("timesheet.import.colEmail")}</th>
                    <th>{t("timesheet.import.colDate")}</th>
                    <th>{t("timesheet.import.colHours")}</th>
                    <th>{t("timesheet.import.colProject")}</th>
                    <th>{t("timesheet.import.colMessage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const norm = row.normalised ?? {};
                    return (
                      <tr key={row.id}>
                        <td>{row.source_row_number}</td>
                        <td>{row.row_status}</td>
                        <td>{row.source_employee_email ?? "—"}</td>
                        <td>{String(norm.work_date ?? "—")}</td>
                        <td>{String(norm.hours ?? "—")}</td>
                        <td>{String(norm.project ?? "—")}</td>
                        <td className="text-xs text-neutral-500">
                          {(row.messages ?? []).map((msg) => msg.message).join("; ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ListPagination page={page} lastPage={lastPage} total={total} onPageChange={(next) => {
                setPage(next);
                if (batch) void loadPreview(batch.id, filter, next);
              }} />
            </div>
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
