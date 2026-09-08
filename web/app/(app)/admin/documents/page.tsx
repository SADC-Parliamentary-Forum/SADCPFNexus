"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { documentServiceApi, type ManagedDocumentRow } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { Badge } from "@/components/ui/Badge";

function scanVariant(status?: string): "success" | "warning" | "danger" | "muted" {
  if (status === "clean") return "success";
  if (status === "pending" || status === "scanning") return "warning";
  if (status === "quarantined" || status === "infected" || status === "failed") return "danger";
  return "muted";
}

export default function AdminDocumentsPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState<ManagedDocumentRow[]>([]);
  const [meta, setMeta] = useState<{ current_page?: number; last_page?: number; total?: number }>({});
  const [q, setQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [holdOnly, setHoldOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [backup, setBackup] = useState<unknown>(null);
  const [holdTarget, setHoldTarget] = useState<ManagedDocumentRow | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [holding, setHolding] = useState(false);
  const [retentionDoc, setRetentionDoc] = useState<ManagedDocumentRow | null>(null);
  const [retainUntil, setRetainUntil] = useState("");
  const [retentionPolicy, setRetentionPolicy] = useState("");
  const [savingRetention, setSavingRetention] = useState(false);

  const load = (nextPage = page) => {
    setLoading(true);
    documentServiceApi
      .list({
        q: q.trim() || undefined,
        module: moduleFilter.trim() || undefined,
        legal_hold: holdOnly ? true : undefined,
        page: nextPage,
        per_page: 25,
      })
      .then((r: { data?: { data?: ManagedDocumentRow[]; current_page?: number; last_page?: number; total?: number } }) => {
        setRows(r.data?.data ?? []);
        setMeta({
          current_page: r.data?.current_page ?? nextPage,
          last_page: r.data?.last_page ?? 1,
          total: r.data?.total ?? 0,
        });
      })
      .catch((err: unknown) => {
        setRows([]);
        error(t("documents.register.loadError"), apiErrorMessage(err, t("documents.register.loadError")));
      })
      .finally(() => setLoading(false));
    documentServiceApi
      .backupStatus()
      .then((r: { data?: unknown }) => setBackup((r.data as { data?: unknown })?.data ?? r.data))
      .catch(() => setBackup({ status: "unavailable", note: t("documents.register.backupHint") }));
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, holdOnly]);

  const applyFilters = () => {
    setPage(1);
    load(1);
  };

  const placeHold = async () => {
    if (!holdTarget || holding) return;
    const reason = holdReason.trim();
    if (!reason) return;
    setHolding(true);
    try {
      await documentServiceApi.placeLegalHold(holdTarget.id, reason);
      success(t("documents.register.holdPlaced"));
      setHoldTarget(null);
      setHoldReason("");
      load();
    } catch (err: unknown) {
      error(t("documents.register.holdFailed"), apiErrorMessage(err, t("documents.register.holdFailed")));
    } finally {
      setHolding(false);
    }
  };

  const releaseHold = async (row: ManagedDocumentRow) => {
    const ok = await confirm({
      title: "documents.register.releaseTitle",
      message: "documents.register.releaseMessage",
      confirmText: t("documents.register.releaseHold"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      await documentServiceApi.releaseLegalHold(row.id);
      success(t("documents.register.holdReleased"));
      if (holdTarget?.id === row.id) {
        setHoldTarget(null);
        setHoldReason("");
      }
      load();
    } catch (err: unknown) {
      error(t("documents.register.holdFailed"), apiErrorMessage(err, t("documents.register.holdFailed")));
    }
  };

  const saveRetention = async () => {
    if (!retentionDoc || savingRetention) return;
    if (!retainUntil.trim() && !retentionPolicy.trim()) return;
    setSavingRetention(true);
    try {
      await documentServiceApi.setRetention(retentionDoc.id, {
        retain_until: retainUntil || undefined,
        retention_policy: retentionPolicy.trim() || undefined,
      });
      success(t("documents.register.retentionSaved"));
      setRetainUntil("");
      setRetentionPolicy("");
      load();
    } catch (err: unknown) {
      error(t("documents.register.retentionFailed"), apiErrorMessage(err, t("documents.register.retentionFailed")));
    } finally {
      setSavingRetention(false);
    }
  };

  const currentPage = meta.current_page ?? page;
  const lastPage = meta.last_page ?? 1;

  const rowActions = (row: ManagedDocumentRow) => (
    <div className="flex flex-wrap gap-2">
      {row.legal_hold ? (
        <button type="button" className="btn-secondary text-xs" onClick={() => void releaseHold(row)}>
          {t("documents.register.releaseHold")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            setHoldTarget(row);
            setHoldReason("");
          }}
        >
          {t("documents.register.placeHold")}
        </button>
      )}
      <button
        type="button"
        className="btn-secondary text-xs"
        onClick={() => {
          setRetentionDoc(row);
          setRetainUntil("");
          setRetentionPolicy("");
        }}
      >
        {t("documents.register.setRetention")}
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <RegisterShell
        title="documents.register.title"
        subtitle="documents.register.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.admin", href: "/admin" },
              { label: "documents.register.title" },
            ]}
          />
        }
        actions={
          <>
            <Link href="/admin/documents/governance" className="btn-secondary text-sm">
              {t("documents.governance.title")}
            </Link>
            <Link href="/admin/documents/retention" className="btn-secondary text-sm">
              {t("documents.retention.title")}
            </Link>
          </>
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="doc-register-search" className="mb-1 block text-xs font-semibold text-neutral-700">
                {t("documents.register.search")}
              </label>
              <input
                id="doc-register-search"
                className="form-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder={t("documents.register.searchPlaceholder")}
              />
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="doc-register-module" className="mb-1 block text-xs font-semibold text-neutral-700">
                {t("documents.register.module")}
              </label>
              <input
                id="doc-register-module"
                className="form-input"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                placeholder={t("documents.register.modulePlaceholder")}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input
                id="doc-register-hold-only"
                type="checkbox"
                checked={holdOnly}
                onChange={(e) => {
                  setHoldOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded text-primary focus:ring-primary"
              />
              <label htmlFor="doc-register-hold-only" className="text-sm text-neutral-700">
                {t("documents.register.holdOnly")}
              </label>
            </div>
            <button type="button" className="btn-primary text-sm" onClick={applyFilters}>
              {t("documents.register.apply")}
            </button>
          </div>
        }
        density={density}
        onDensityChange={setDensity}
        page={currentPage}
        pageCount={lastPage}
        total={meta.total}
        onPageChange={setPage}
        loading={loading}
        empty={
          !loading && rows.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="folder_managed"
                title="documents.register.empty"
                description="documents.register.emptyHint"
              />
            </div>
          ) : undefined
        }
      >
        <div className="card overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-full text-sm">
              <caption className="sr-only">{t("documents.register.tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("documents.register.colTitle")}</th>
                  <th scope="col">{t("documents.register.colModule")}</th>
                  <th scope="col">{t("documents.register.colClass")}</th>
                  <th scope="col">{t("documents.register.colHash")}</th>
                  <th scope="col">{t("documents.register.colScan")}</th>
                  <th scope="col">{t("documents.register.colHold")}</th>
                  <th scope="col">{t("documents.register.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hash = row.current_version?.content_hash ?? "";
                  const scan = row.current_version?.quarantine_status;
                  return (
                    <tr key={row.id}>
                      <td className="font-medium text-neutral-900 dark:text-neutral-100">{row.title}</td>
                      <td className="capitalize">{row.module || t("documents.register.none")}</td>
                      <td>{row.classification || t("documents.register.none")}</td>
                      <td className="font-mono text-xs">{hash ? `${hash.slice(0, 12)}…` : t("documents.register.none")}</td>
                      <td>
                        <Badge variant={scanVariant(scan)}>{scan || t("documents.register.none")}</Badge>
                      </td>
                      <td>
                        <Badge variant={row.legal_hold ? "danger" : "muted"}>
                          {row.legal_hold ? t("documents.register.onHold") : t("documents.register.notHeld")}
                        </Badge>
                      </td>
                      <td>{rowActions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {rows.map((row) => {
              const scan = row.current_version?.quarantine_status;
              return (
                <article key={row.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">{row.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {row.module || t("documents.register.none")} · {row.classification || t("documents.register.none")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={scanVariant(scan)}>{scan || t("documents.register.none")}</Badge>
                    <Badge variant={row.legal_hold ? "danger" : "muted"}>
                      {row.legal_hold ? t("documents.register.onHold") : t("documents.register.notHeld")}
                    </Badge>
                  </div>
                  <div className="mt-3">{rowActions(row)}</div>
                </article>
              );
            })}
          </div>
        </div>
      </RegisterShell>

      {holdTarget ? (
        <div className="mx-auto max-w-6xl">
          <FormSection
            title="documents.register.placeHold"
            description={holdTarget.title}
            icon="gavel"
          >
            <label htmlFor="doc-hold-reason" className="mb-1 block text-xs font-semibold text-neutral-700">
              {t("documents.register.holdReason")}
            </label>
            <textarea
              id="doc-hold-reason"
              className="form-input"
              rows={3}
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder={t("documents.register.holdReasonPlaceholder")}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-60"
                disabled={holding || !holdReason.trim()}
                onClick={() => void placeHold()}
              >
                {t("documents.register.holdConfirm")}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setHoldTarget(null);
                  setHoldReason("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </FormSection>
        </div>
      ) : null}

      {backup != null ? (
        <div className="mx-auto max-w-6xl">
          <FormSection title="documents.register.backup" description="documents.register.backupHint" icon="backup">
            <LabelledRecord value={backup} />
          </FormSection>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl">
        <FormSection
          title="documents.register.retention"
          description="documents.register.retentionHint"
          icon="policy"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-700">{t("documents.register.selected")}</p>
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/40">
                {retentionDoc?.title ?? t("documents.register.selectDocument")}
              </p>
            </div>
            <div>
              <label htmlFor="doc-retention-until" className="mb-1 block text-xs font-semibold text-neutral-700">
                {t("documents.register.retainUntil")}
              </label>
              <input
                id="doc-retention-until"
                type="date"
                className="form-input"
                value={retainUntil}
                onChange={(e) => setRetainUntil(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="doc-retention-policy" className="mb-1 block text-xs font-semibold text-neutral-700">
                {t("documents.register.policy")}
              </label>
              <input
                id="doc-retention-policy"
                className="form-input"
                value={retentionPolicy}
                onChange={(e) => setRetentionPolicy(e.target.value)}
                placeholder={t("documents.register.policyPlaceholder")}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary mt-3 text-sm disabled:opacity-60"
            disabled={
              savingRetention ||
              !retentionDoc ||
              (!retainUntil.trim() && !retentionPolicy.trim())
            }
            onClick={() => void saveRetention()}
          >
            {t("documents.register.saveRetention")}
          </button>
        </FormSection>
      </div>
    </div>
  );
}
