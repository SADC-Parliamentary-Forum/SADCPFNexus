"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDateShort } from "@/lib/utils";
import { adminConsoleApi, type AdminConsoleDashboard, type AdminConsoleRow } from "@/lib/api";

type Section = "overview" | "configuration" | "reliability" | "support";

type QueuePayload = { snapshots: AdminConsoleRow[]; audit_outbox: Record<string, number> };

type ResourceState = {
  dashboard: AdminConsoleDashboard | null;
  modules: AdminConsoleRow[];
  configurations: AdminConsoleRow[];
  referenceData: AdminConsoleRow[];
  featureFlags: AdminConsoleRow[];
  calendars: AdminConsoleRow[];
  numbering: AdminConsoleRow[];
  localisation: AdminConsoleRow[];
  integrations: AdminConsoleRow[];
  jobs: AdminConsoleRow[];
  jobRuns: AdminConsoleRow[];
  queues: AdminConsoleRow[];
  queueOutbox: Record<string, number>;
  deadLetters: AdminConsoleRow[];
  dataQuality: AdminConsoleRow[];
  backups: AdminConsoleRow[];
  restoreRequests: AdminConsoleRow[];
  imports: AdminConsoleRow[];
  migrations: AdminConsoleRow[];
};

const EMPTY: ResourceState = {
  dashboard: null,
  modules: [],
  configurations: [],
  referenceData: [],
  featureFlags: [],
  calendars: [],
  numbering: [],
  localisation: [],
  integrations: [],
  jobs: [],
  jobRuns: [],
  queues: [],
  queueOutbox: {},
  deadLetters: [],
  dataQuality: [],
  backups: [],
  restoreRequests: [],
  imports: [],
  migrations: [],
};

const SECTIONS: Section[] = ["overview", "configuration", "reliability", "support"];

const RESTORE_TYPES = [
  "test_restoration",
  "single_document_restoration",
  "record_recovery",
  "point_in_time_database_recovery",
  "disaster_recovery",
] as const;

const ENVIRONMENTS = [
  "staging",
  "testing",
  "user_acceptance_testing",
  "production",
  "disaster_recovery",
] as const;

async function safeLoad<T>(loader: () => Promise<{ data: { data: T } }>, fallback: T): Promise<{ value: T; failed: boolean }> {
  try {
    const response = await loader();
    return { value: response.data.data, failed: false };
  } catch {
    return { value: fallback, failed: true };
  }
}

function idOf(row: AdminConsoleRow): number | null {
  return typeof row.id === "number" ? row.id : Number.isFinite(Number(row.id)) ? Number(row.id) : null;
}

function statusTone(status?: unknown): string {
  const value = String(status ?? "").toLowerCase();
  if (["active", "operational", "healthy", "completed", "approved"].includes(value)) return "badge-success";
  if (["failed", "failing", "critical", "major_outage", "disabled"].includes(value)) return "badge-danger";
  if (["degraded", "partial_outage", "pending_approval", "proposed", "scheduled", "open"].includes(value)) return "badge-warning";
  return "badge-muted";
}

function serviceHint(meta?: Record<string, unknown>): string {
  if (!meta) return "";
  if (typeof meta.driver === "string" && meta.driver.trim()) return meta.driver;
  const parts = Object.entries(meta)
    .filter(([, value]) => value != null && value !== "" && typeof value !== "object")
    .slice(0, 2)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);
  return parts.join(" · ");
}

export default function AdminOperationsPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const [state, setState] = useState<ResourceState>(EMPTY);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ definitionId: "", proposedValue: "", reason: "" });
  const [supportForm, setSupportForm] = useState({ ticket_reference: "", reason: "" });
  const [breakGlassForm, setBreakGlassForm] = useState({ incident_reference: "", reason: "" });
  const [restoreForm, setRestoreForm] = useState({
    restore_type: "test_restoration",
    target_environment: "staging",
    reason: "",
  });

  const load = async () => {
    setLoading(true);
    const results = await Promise.all([
      safeLoad(() => adminConsoleApi.dashboard(), null as AdminConsoleDashboard | null),
      safeLoad(() => adminConsoleApi.modules(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.configurations(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.referenceData(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.featureFlags(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.calendars(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.numberingSchemes(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.localisation(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.integrations(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.jobs(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.jobRuns(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.queues(), { snapshots: [], audit_outbox: {} } as QueuePayload),
      safeLoad(() => adminConsoleApi.deadLetters(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.dataQualityIssues(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.backups(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.restoreRequests(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.imports(), [] as AdminConsoleRow[]),
      safeLoad(() => adminConsoleApi.migrations(), [] as AdminConsoleRow[]),
    ]);

    const [
      dashboard,
      modules,
      configurations,
      referenceData,
      featureFlags,
      calendars,
      numbering,
      localisation,
      integrations,
      jobs,
      jobRuns,
      queues,
      deadLetters,
      dataQuality,
      backups,
      restoreRequests,
      imports,
      migrations,
    ] = results;

    const jobName = (run: AdminConsoleRow) => {
      const job = jobs.value.find((row) => row.id === run.scheduled_job_id);
      return job?.name ?? job?.job_key ?? run.scheduled_job_id ?? "—";
    };

    setState({
      dashboard: dashboard.value,
      modules: modules.value,
      configurations: configurations.value,
      referenceData: referenceData.value,
      featureFlags: featureFlags.value,
      calendars: calendars.value,
      numbering: numbering.value,
      localisation: localisation.value,
      integrations: integrations.value,
      jobs: jobs.value,
      jobRuns: jobRuns.value.map((run) => ({ ...run, job_name: jobName(run) })),
      queues: queues.value.snapshots ?? [],
      queueOutbox: queues.value.audit_outbox ?? {},
      deadLetters: deadLetters.value,
      dataQuality: dataQuality.value,
      backups: backups.value,
      restoreRequests: restoreRequests.value,
      imports: imports.value,
      migrations: migrations.value,
    });

    if (dashboard.failed) {
      error(t("operations.loadError"), t("operations.loadError"));
    } else if (results.some((item) => item.failed)) {
      error(t("operations.partialError"), t("operations.partialError"));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(
    labelKey: string,
    callback: () => Promise<unknown>,
    confirmOpts?: { title: string; message?: string; variant?: "danger" | "primary" },
  ) {
    if (confirmOpts && !(await confirm(confirmOpts))) return;
    setSaving(labelKey);
    try {
      await callback();
      success(t("operations.success"), t(labelKey));
      await load();
    } catch (err: unknown) {
      error(t("operations.failed"), apiErrorMessage(err, t("operations.failed")));
    } finally {
      setSaving(null);
    }
  }

  function proposeConfig(event: FormEvent) {
    event.preventDefault();
    const definitionId = Number(configForm.definitionId);
    if (!definitionId || !configForm.proposedValue.trim() || !configForm.reason.trim()) return;
    act("operations.propose", () =>
      adminConsoleApi.proposeConfigurationChange(definitionId, {
        proposed_value: configForm.proposedValue,
        reason: configForm.reason,
        business_justification: configForm.reason,
      }),
    ).then(() => setConfigForm({ definitionId: "", proposedValue: "", reason: "" }));
  }

  function requestSupport(event: FormEvent) {
    event.preventDefault();
    if (!supportForm.ticket_reference.trim() || !supportForm.reason.trim()) return;
    act("operations.requestSupport", () => adminConsoleApi.createSupportSession(supportForm)).then(() =>
      setSupportForm({ ticket_reference: "", reason: "" }),
    );
  }

  function requestBreakGlass(event: FormEvent) {
    event.preventDefault();
    if (!breakGlassForm.incident_reference.trim() || !breakGlassForm.reason.trim()) return;
    act(
      "operations.requestBreakGlass",
      () =>
        adminConsoleApi.requestBreakGlass({
          ...breakGlassForm,
          requested_permissions: ["admin-console.view", "admin-console.view-health"],
        }),
      { title: "operations.confirm.breakGlass", variant: "danger" },
    ).then(() => setBreakGlassForm({ incident_reference: "", reason: "" }));
  }

  function requestRestore(event: FormEvent) {
    event.preventDefault();
    if (!restoreForm.reason.trim()) return;
    act("operations.requestRestore", () => adminConsoleApi.requestRestore(restoreForm)).then(() =>
      setRestoreForm({ restore_type: "test_restoration", target_environment: "staging", reason: "" }),
    );
  }

  const cards = state.dashboard?.cards ?? {};
  const services = state.dashboard ? Object.values(state.dashboard.health.services) : [];
  const alerts = state.dashboard?.critical_alerts ?? [];
  const busy = saving !== null;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="operations.title"
        subtitle="operations.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.admin", href: "/admin" }, { label: "operations.title" }]} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={load} disabled={loading}>
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              {t("operations.refresh")}
            </button>
            <Link href="/admin/audit-trail" className="btn-secondary text-xs">
              <span className="material-symbols-outlined text-[16px]">policy</span>
              {t("operations.auditTrail")}
            </Link>
          </div>
        }
      />

      <div role="tablist" aria-label={t("operations.sections")} className="flex flex-wrap gap-2">
        {SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`ops-tab-${id}`}
            aria-selected={section === id}
            className={section === id ? "btn-primary text-xs" : "btn-secondary text-xs"}
            onClick={() => setSection(id)}
          >
            {t(`operations.tab.${id}`)}
          </button>
        ))}
      </div>

      {loading && !state.dashboard ? (
        <div className="card p-6 text-sm text-neutral-500">{t("operations.loading")}</div>
      ) : null}

      {section === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ["operations.card.platform", state.dashboard?.status ?? (loading ? t("operations.loading") : t("operations.unavailable"))],
                ["operations.card.modules", cards.modules_active],
                ["operations.card.config", cards.configuration_pending],
                ["operations.card.deadLetters", cards.dead_letters_open],
                ["operations.card.dataIssues", cards.data_quality_open],
                ["operations.card.jobFailures", cards.job_failures],
              ] as Array<[string, unknown]>
            ).map(([label, value]) => (
              <div key={label} className="card p-4">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">{t(label)}</p>
                <p className="mt-1 text-lg font-semibold capitalize text-neutral-900">{display(value, t)}</p>
              </div>
            ))}
          </div>

          <section className="space-y-3">
            <SectionHeader title={t("operations.health")} count={services.length} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => (
                <div key={service.name} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-900">{service.name}</p>
                    <RowStatus status={service.status} t={t} />
                  </div>
                  {serviceHint(service.meta) ? (
                    <p className="mt-2 truncate text-xs text-neutral-500">{serviceHint(service.meta)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

            <Panel title={t("operations.alerts")} count={alerts.length} data-testid="ops-alerts">
              <Table
                rows={alerts.slice(0, 8)}
                columns={[
                  [t("operations.col.reference"), "reference"],
                  [t("operations.col.issue"), "message"],
                  [t("operations.col.severity"), "severity"],
                  [t("operations.col.status"), "status"],
                  [t("operations.col.source"), "source_service"],
                ]}
                t={t}
              />
          </Panel>
        </>
      ) : null}

      {section === "configuration" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title={t("operations.modules")} count={state.modules.length}>
              <Table
                rows={state.modules.slice(0, 10)}
                columns={[
                  [t("operations.col.module"), "name"],
                  [t("operations.col.status"), "status"],
                  [t("operations.col.health"), "health_status"],
                  [t("operations.col.dependencies"), "required_permissions"],
                ]}
                t={t}
                actions={(row) => {
                  const id = idOf(row);
                  if (!id) return null;
                  const target = row.status === "active" ? "read_only" : "active";
                  return (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() =>
                        act(
                          target === "read_only" ? "operations.readOnly" : "operations.activate",
                          () =>
                            adminConsoleApi.changeModuleStatus(id, {
                              status: target,
                              reason: `Operational Control changed status to ${target}.`,
                            }),
                          { title: "operations.confirm.module" },
                        )
                      }
                    >
                      {target === "read_only" ? t("operations.readOnly") : t("operations.activate")}
                    </button>
                  );
                }}
              />
            </Panel>

            <Panel title={t("operations.config")} count={state.configurations.length}>
              <form className="mb-4 grid gap-2 rounded-lg border border-neutral-200 p-3" onSubmit={proposeConfig}>
                <p className="text-xs text-neutral-500">{t("operations.configHint")}</p>
                <Field id="ops-config-item" label="operations.configItem">
                  <select
                    id="ops-config-item"
                    className="form-input text-sm"
                    value={configForm.definitionId}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, definitionId: event.target.value }))}
                  >
                    <option value="">{t("operations.configPlaceholder")}</option>
                    {state.configurations.map((config) => (
                      <option key={String(config.id)} value={String(config.id)}>
                        {display(config.config_key, t)} — {t("operations.current")}{" "}
                        {display((config.current_version as Record<string, unknown> | undefined)?.value, t)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="ops-config-value" label="operations.proposedValue">
                  <input
                    id="ops-config-value"
                    className="form-input text-sm"
                    value={configForm.proposedValue}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, proposedValue: event.target.value }))}
                  />
                </Field>
                <Field id="ops-config-reason" label="operations.reason">
                  <input
                    id="ops-config-reason"
                    className="form-input text-sm"
                    value={configForm.reason}
                    onChange={(event) => setConfigForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </Field>
                <button type="submit" className="btn-primary text-xs" disabled={busy}>
                  {t("operations.propose")}
                </button>
              </form>
              <Table
                rows={state.configurations.slice(0, 8)}
                columns={[
                  [t("operations.col.key"), "config_key"],
                  [t("operations.col.domain"), "domain"],
                  [t("operations.col.sensitivity"), "sensitivity"],
                  [t("operations.col.pending"), "pending_changes"],
                ]}
                t={t}
              />
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title={t("operations.flags")} count={state.featureFlags.length}>
              <Table
                rows={state.featureFlags.slice(0, 8)}
                columns={[
                  [t("operations.col.flag"), "flag_key"],
                  [t("operations.col.type"), "flag_type"],
                  [t("operations.col.status"), "status"],
                ]}
                t={t}
                actions={(row) => {
                  const id = idOf(row);
                  if (!id) return null;
                  if (row.status === "approved") {
                    return (
                      <ActionButton
                        label={t("operations.activate")}
                        busy={busy}
                        onClick={() => act("operations.activate", () => adminConsoleApi.activateFeatureFlag(id))}
                      />
                    );
                  }
                  if (row.status === "draft") {
                    return (
                      <ActionButton
                        label={t("operations.approve")}
                        busy={busy}
                        onClick={() => act("operations.approve", () => adminConsoleApi.approveFeatureFlag(id))}
                      />
                    );
                  }
                  if (row.status === "active") {
                    return (
                      <ActionButton
                        label={t("operations.disable")}
                        busy={busy}
                        onClick={() =>
                          act("operations.disable", () => adminConsoleApi.disableFeatureFlag(id), {
                            title: "operations.confirm.disableFlag",
                            variant: "danger",
                          })
                        }
                      />
                    );
                  }
                  return null;
                }}
              />
            </Panel>
            <Panel title={t("operations.reference")} count={state.referenceData.length}>
              <Table
                rows={state.referenceData.slice(0, 8)}
                columns={[
                  [t("operations.col.set"), "set_key"],
                  [t("operations.col.domain"), "domain"],
                  [t("operations.col.items"), "items_count"],
                ]}
                t={t}
              />
            </Panel>
            <Panel title={t("operations.localisation")} count={state.localisation.length}>
              <Table
                rows={state.localisation.slice(0, 6)}
                columns={[
                  [t("operations.col.translation"), "translation_key"],
                  [t("operations.col.module"), "module"],
                  [t("operations.col.status"), "status"],
                ]}
                t={t}
              />
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title={t("operations.calendars")} count={state.calendars.length}>
              <Table
                rows={state.calendars.slice(0, 6)}
                columns={[
                  [t("operations.col.calendar"), "name"],
                  [t("operations.col.year"), "effective_year"],
                  [t("operations.col.days"), "days_count"],
                ]}
                t={t}
              />
            </Panel>
            <Panel title={t("operations.numbering")} count={state.numbering.length}>
              <Table
                rows={state.numbering.slice(0, 6)}
                columns={[
                  [t("operations.col.scheme"), "scheme_key"],
                  [t("operations.col.prefix"), "prefix"],
                  [t("operations.col.example"), "example"],
                ]}
                t={t}
              />
            </Panel>
          </section>
        </>
      ) : null}

      {section === "reliability" ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title={t("operations.jobs")} count={state.jobs.length}>
              <Table
                rows={state.jobs.slice(0, 8)}
                columns={[
                  [t("operations.col.job"), "job_key"],
                  [t("operations.col.enabled"), "enabled"],
                  [t("operations.col.last"), "last_result"],
                ]}
                t={t}
                actions={(row) => {
                  const id = idOf(row);
                  if (!id) return null;
                  return (
                    <ActionButton
                      label={t("operations.run")}
                      busy={busy}
                      onClick={() =>
                        act(
                          "operations.run",
                          () => adminConsoleApi.runJob(id, { reason: "Manual run from Operational Control." }),
                          { title: "operations.confirm.runJob" },
                        )
                      }
                    />
                  );
                }}
              />
            </Panel>
            <Panel title={t("operations.jobRuns")} count={state.jobRuns.length} data-testid="ops-job-runs">
              <Table
                rows={state.jobRuns.slice(0, 8)}
                columns={[
                  [t("operations.col.job"), "job_name"],
                  [t("operations.col.status"), "status"],
                  [t("operations.col.trigger"), "trigger_type"],
                  [t("operations.col.started"), "started_at"],
                  [t("operations.col.processed"), "records_processed"],
                ]}
                t={t}
              />
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title={t("operations.queues")} count={state.queues.length} data-testid="ops-queues">
              <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-neutral-50 px-3 py-2">
                  <dt className="text-neutral-500">{t("operations.outboxPending")}</dt>
                  <dd className="font-semibold text-neutral-900">{state.queueOutbox.pending_outbox ?? 0}</dd>
                </div>
                <div className="rounded-lg bg-neutral-50 px-3 py-2">
                  <dt className="text-neutral-500">{t("operations.outboxFailed")}</dt>
                  <dd className="font-semibold text-neutral-900">{state.queueOutbox.failed_outbox ?? 0}</dd>
                </div>
                <div className="rounded-lg bg-neutral-50 px-3 py-2">
                  <dt className="text-neutral-500">{t("operations.deadLetters")}</dt>
                  <dd className="font-semibold text-neutral-900">{state.queueOutbox.open_dead_letters ?? 0}</dd>
                </div>
              </dl>
              <Table
                rows={state.queues.slice(0, 8)}
                columns={[
                  [t("operations.col.queue"), "queue_key"],
                  [t("operations.col.depth"), "queue_depth"],
                  [t("operations.col.worker"), "worker_status"],
                  [t("operations.col.status"), "failure_rate"],
                ]}
                t={t}
              />
            </Panel>
            <Panel title={t("operations.deadLetters")} count={state.deadLetters.length}>
              <Table
                rows={state.deadLetters.slice(0, 8)}
                columns={[
                  [t("operations.col.source"), "source_service"],
                  [t("operations.col.severity"), "severity"],
                  [t("operations.col.status"), "status"],
                ]}
                t={t}
                actions={(row) => {
                  const id = idOf(row);
                  if (!id) return null;
                  if (row.replay_safe === true) {
                    return (
                      <ActionButton
                        label={t("operations.replay")}
                        busy={busy}
                        onClick={() =>
                          act("operations.replay", () => adminConsoleApi.replayDeadLetter(id), {
                            title: "operations.confirm.replay",
                            variant: "danger",
                          })
                        }
                      />
                    );
                  }
                  return (
                    <ActionButton
                      label={t("operations.close")}
                      busy={busy}
                      onClick={() =>
                        act(
                          "operations.close",
                          () =>
                            adminConsoleApi.resolveDeadLetter(id, {
                              reason: "Closed as accepted exception from Operational Control.",
                            }),
                          { title: "operations.confirm.closeLetter" },
                        )
                      }
                    />
                  );
                }}
              />
            </Panel>
          </section>

          <Panel title={t("operations.backup")} count={state.backups.length}>
            <Table
              rows={state.backups.slice(0, 8)}
              columns={[
                [t("operations.col.type"), "backup_type"],
                [t("operations.col.status"), "status"],
                [t("operations.col.verified"), "last_verification_at"],
              ]}
              t={t}
            />
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">{t("operations.restoreRequests")}</h3>
                <span className="text-xs text-neutral-500">{state.restoreRequests.length}</span>
              </div>
              <Table
                rows={state.restoreRequests.slice(0, 8)}
                columns={[
                  [t("operations.col.reference"), "reference"],
                  [t("operations.col.type"), "restore_type"],
                  [t("operations.col.environment"), "target_environment"],
                  [t("operations.col.status"), "status"],
                ]}
                t={t}
                actions={(row) => {
                  const id = idOf(row);
                  if (!id) return null;
                  const status = String(row.status ?? "");
                  return (
                    <div className="flex flex-wrap justify-end gap-2">
                      {status === "requested" ? (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => act("operations.approve", () => adminConsoleApi.approveRestore(id))}
                        >
                          {t("operations.approve")}
                        </button>
                      ) : null}
                      {status === "approved" ? (
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          onClick={() =>
                            act(
                              "operations.recordExecution",
                              () => adminConsoleApi.executeRestore(id, { verification_status: "completed" }),
                              { title: "operations.confirm.restore", variant: "danger" },
                            )
                          }
                        >
                          {t("operations.recordExecution")}
                        </button>
                      ) : null}
                    </div>
                  );
                }}
              />
            </div>
            <form className="mt-4 grid gap-2 rounded-lg border border-neutral-200 p-3" onSubmit={requestRestore}>
              <Field id="ops-restore-type" label="operations.restoreType">
                <select
                  id="ops-restore-type"
                  className="form-input text-sm"
                  value={restoreForm.restore_type}
                  onChange={(event) => setRestoreForm((prev) => ({ ...prev, restore_type: event.target.value }))}
                >
                  {RESTORE_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`operations.restore.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="ops-restore-env" label="operations.environment">
                <select
                  id="ops-restore-env"
                  className="form-input text-sm"
                  value={restoreForm.target_environment}
                  onChange={(event) => setRestoreForm((prev) => ({ ...prev, target_environment: event.target.value }))}
                >
                  {ENVIRONMENTS.map((value) => (
                    <option key={value} value={value}>
                      {t(`operations.env.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="ops-restore-reason" label="operations.restoreReason">
                <textarea
                  id="ops-restore-reason"
                  className="form-input min-h-20 text-sm"
                  value={restoreForm.reason}
                  onChange={(event) => setRestoreForm((prev) => ({ ...prev, reason: event.target.value }))}
                />
              </Field>
              <button type="submit" className="btn-primary text-xs" disabled={busy}>
                {t("operations.requestRestore")}
              </button>
            </form>
          </Panel>
        </>
      ) : null}

      {section === "support" ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("operations.support")} count={0}>
              <form className="grid gap-3" onSubmit={requestSupport}>
                <Field id="ops-support-ticket" label="operations.ticket">
                  <input
                    id="ops-support-ticket"
                    className="form-input text-sm"
                    value={supportForm.ticket_reference}
                    onChange={(event) => setSupportForm((prev) => ({ ...prev, ticket_reference: event.target.value }))}
                  />
                </Field>
                <Field id="ops-support-reason" label="operations.supportReason">
                  <textarea
                    id="ops-support-reason"
                    className="form-input min-h-24 text-sm"
                    value={supportForm.reason}
                    onChange={(event) => setSupportForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </Field>
                <button type="submit" className="btn-primary text-xs" disabled={busy}>
                  {t("operations.requestSupport")}
                </button>
              </form>
            </Panel>
            <Panel title={t("operations.breakGlass")} count={0}>
              <form className="grid gap-3" onSubmit={requestBreakGlass}>
                <Field id="ops-breakglass-incident" label="operations.incident">
                  <input
                    id="ops-breakglass-incident"
                    className="form-input text-sm"
                    value={breakGlassForm.incident_reference}
                    onChange={(event) => setBreakGlassForm((prev) => ({ ...prev, incident_reference: event.target.value }))}
                  />
                </Field>
                <Field id="ops-breakglass-reason" label="operations.emergencyReason">
                  <textarea
                    id="ops-breakglass-reason"
                    className="form-input min-h-24 text-sm"
                    value={breakGlassForm.reason}
                    onChange={(event) => setBreakGlassForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </Field>
                <button type="submit" className="btn-primary text-xs" disabled={busy}>
                  {t("operations.requestBreakGlass")}
                </button>
              </form>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Panel title={t("operations.dataQuality")} count={state.dataQuality.length}>
              <Table
                rows={state.dataQuality.slice(0, 8)}
                columns={[
                  [t("operations.col.issue"), "reference"],
                  [t("operations.col.module"), "module"],
                  [t("operations.col.severity"), "severity"],
                  [t("operations.col.status"), "status"],
                ]}
                t={t}
              />
            </Panel>
            <Panel title={t("operations.imports")} count={state.imports.length + state.migrations.length}>
              <Table
                rows={[...state.imports.slice(0, 4), ...state.migrations.slice(0, 4)]}
                columns={[
                  [t("operations.col.reference"), "reference"],
                  [t("operations.col.status"), "status"],
                  [t("operations.col.source"), "source_system"],
                  [t("operations.col.type"), "import_type"],
                ]}
                t={t}
              />
            </Panel>
            <Panel title={t("operations.integrations")} count={state.integrations.length}>
              <Table
                rows={state.integrations.slice(0, 8)}
                columns={[
                  [t("operations.col.integration"), "name"],
                  [t("operations.col.status"), "status"],
                  [t("operations.col.secret"), "secret_reference"],
                ]}
                t={t}
              />
            </Panel>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-700">
        {t(label)}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <span className="badge badge-muted text-xs">{count}</span>
    </div>
  );
}

function Panel({
  title,
  count,
  children,
  ...rest
}: {
  title: string;
  count: number;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="card overflow-hidden" {...rest}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <span className="badge badge-muted text-xs">{count}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ActionButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={onClick}>
      {label}
    </button>
  );
}

function RowStatus({ status, t }: { status: unknown; t: (key: string) => string }) {
  return <span className={`badge text-xs capitalize ${statusTone(status)}`}>{display(status, t)}</span>;
}

function display(value: unknown, t: (key: string) => string): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t("operations.yes") : t("operations.no");
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.map((item, idx) => (
      <span key={idx}>
        {display(item, t)}
        {idx < value.length - 1 ? ", " : ""}
      </span>
    ));
  }
  if (typeof value === "object") {
    const asRecord = value as Record<string, unknown>;
    if ("value" in asRecord) return display(asRecord.value, t);
    return <LabelledRecord value={value} nested />;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatDateShort(text);
  return text.replaceAll("_", " ");
}

function Table({
  rows,
  columns,
  actions,
  t,
}: {
  rows: AdminConsoleRow[];
  columns: Array<[string, string]>;
  actions?: (row: AdminConsoleRow) => ReactNode;
  t: (key: string) => string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon="inbox" title="operations.empty" description="operations.emptyHint" className="min-h-[140px] py-8" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
            {actions ? <th className="text-right">{t("operations.action")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map(([label, field]) => (
                <td key={`${label}-${field}`} className="max-w-64 truncate">
                  {field === "status" || field.endsWith("_status") || field === "health_status" || field === "severity" ? (
                    <RowStatus status={row[field]} t={t} />
                  ) : (
                    display(row[field], t)
                  )}
                </td>
              ))}
              {actions ? <td className="text-right">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
