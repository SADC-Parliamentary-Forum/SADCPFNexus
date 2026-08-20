"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { adminConsoleApi, type AdminConsoleDashboard, type AdminConsoleRow } from "@/lib/api";

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
  deadLetters: [],
  dataQuality: [],
  backups: [],
  restoreRequests: [],
  imports: [],
  migrations: [],
};

async function safeLoad<T, F = T>(loader: () => Promise<{ data: { data: T } }>, fallback: F): Promise<T | F> {
  try {
    const response = await loader();
    return response.data.data;
  } catch {
    return fallback;
  }
}

function display(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "-";
    return value.map((item, idx) => (
      <span key={idx}>
        {display(item)}
        {idx < value.length - 1 ? ", " : ""}
      </span>
    ));
  }
  if (typeof value === "object") {
    const asRecord = value as Record<string, unknown>;
    if ("value" in asRecord) return display(asRecord.value);
    return <LabelledRecord value={value} nested />;
  }
  return String(value).replaceAll("_", " ");
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

function RowStatus({ status }: { status: unknown }) {
  return <span className={`badge text-xs capitalize ${statusTone(status)}`}>{display(status)}</span>;
}

export default function AdminOperationsPage() {
  const [state, setState] = useState<ResourceState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ definitionId: "", proposedValue: "", reason: "" });
  const [supportForm, setSupportForm] = useState({ ticket_reference: "", reason: "" });
  const [breakGlassForm, setBreakGlassForm] = useState({ incident_reference: "", reason: "" });
  const [restoreForm, setRestoreForm] = useState({
    restore_type: "test_restoration",
    target_environment: "staging",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
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
    ] = await Promise.all([
      safeLoad(() => adminConsoleApi.dashboard(), null),
      safeLoad(() => adminConsoleApi.modules(), []),
      safeLoad(() => adminConsoleApi.configurations(), []),
      safeLoad(() => adminConsoleApi.referenceData(), []),
      safeLoad(() => adminConsoleApi.featureFlags(), []),
      safeLoad(() => adminConsoleApi.calendars(), []),
      safeLoad(() => adminConsoleApi.numberingSchemes(), []),
      safeLoad(() => adminConsoleApi.localisation(), []),
      safeLoad(() => adminConsoleApi.integrations(), []),
      safeLoad(() => adminConsoleApi.jobs(), []),
      safeLoad(() => adminConsoleApi.jobRuns(), []),
      safeLoad(() => adminConsoleApi.queues(), { snapshots: [], audit_outbox: {} }),
      safeLoad(() => adminConsoleApi.deadLetters(), []),
      safeLoad(() => adminConsoleApi.dataQualityIssues(), []),
      safeLoad(() => adminConsoleApi.backups(), []),
      safeLoad(() => adminConsoleApi.restoreRequests(), []),
      safeLoad(() => adminConsoleApi.imports(), []),
      safeLoad(() => adminConsoleApi.migrations(), []),
    ]);

    setState({
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
      queues: queues.snapshots,
      deadLetters,
      dataQuality,
      backups,
      restoreRequests,
      imports,
      migrations,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(label: string, callback: () => Promise<unknown>) {
    setSaving(label);
    setNotice(null);
    try {
      await callback();
      setNotice(`${label} completed.`);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The operation failed.";
      setNotice(message);
    } finally {
      setSaving(null);
    }
  }

  function proposeConfig(event: FormEvent) {
    event.preventDefault();
    const definitionId = Number(configForm.definitionId);
    if (!definitionId || !configForm.proposedValue.trim() || !configForm.reason.trim()) return;
    act("Configuration proposal", () =>
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
    act("Support session request", () => adminConsoleApi.createSupportSession(supportForm)).then(() =>
      setSupportForm({ ticket_reference: "", reason: "" }),
    );
  }

  function requestBreakGlass(event: FormEvent) {
    event.preventDefault();
    if (!breakGlassForm.incident_reference.trim() || !breakGlassForm.reason.trim()) return;
    act("Break-glass request", () =>
      adminConsoleApi.requestBreakGlass({
        ...breakGlassForm,
        requested_permissions: ["admin-console.view", "admin-console.view-health"],
      }),
    ).then(() => setBreakGlassForm({ incident_reference: "", reason: "" }));
  }

  function requestRestore(event: FormEvent) {
    event.preventDefault();
    if (!restoreForm.reason.trim()) return;
    act("Restore request", () => adminConsoleApi.requestRestore(restoreForm)).then(() =>
      setRestoreForm({ restore_type: "test_restoration", target_environment: "staging", reason: "" }),
    );
  }

  const cards = state.dashboard?.cards ?? {};
  const services = state.dashboard ? Object.values(state.dashboard.health.services) : [];

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Operational Control"
        subtitle="Controlled platform administration, configuration governance, health, queues, and support access."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Operational Control" }]} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={load} disabled={loading}>
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refresh
            </button>
            <Link href="/admin/audit-trail" className="btn-secondary text-xs">
              <span className="material-symbols-outlined text-[16px]">policy</span>
              Audit Trail
            </Link>
          </div>
        }
      />

      {notice ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{notice}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Platform", state.dashboard?.status ?? (loading ? "Loading" : "Unavailable")],
          ["Active modules", cards.modules_active],
          ["Pending config", cards.configuration_pending],
          ["Open dead letters", cards.dead_letters_open],
          ["Data issues", cards.data_quality_open],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-lg font-semibold capitalize text-neutral-900">{display(value)}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <SectionHeader title="Platform Status" count={services.length} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div key={service.name} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-900">{service.name}</p>
                <RowStatus status={service.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{display(service.meta ?? {})}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Module Registry" count={state.modules.length}>
          <Table
            rows={state.modules.slice(0, 10)}
            columns={[
              ["Module", "name"],
              ["Status", "status"],
              ["Health", "health_status"],
              ["Dependencies", "required_permissions"],
            ]}
            actions={(row) => {
              const id = idOf(row);
              if (!id) return null;
              const target = row.status === "active" ? "read_only" : "active";
              return (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={saving !== null}
                  onClick={() =>
                    act("Module status change", () =>
                      adminConsoleApi.changeModuleStatus(id, {
                        status: target,
                        reason: `Operational Control changed status to ${target}.`,
                      }),
                    )
                  }
                >
                  {target === "read_only" ? "Read-only" : "Activate"}
                </button>
              );
            }}
          />
        </Panel>

        <Panel title="Configuration Governance" count={state.configurations.length}>
          <form className="mb-4 grid gap-2 rounded-lg border border-neutral-200 p-3" onSubmit={proposeConfig}>
            <select
              className="form-input text-sm"
              value={configForm.definitionId}
              onChange={(event) => setConfigForm((prev) => ({ ...prev, definitionId: event.target.value }))}
              aria-label="Configuration item"
            >
              <option value="">Select configuration item</option>
              {state.configurations.map((config) => (
                <option key={String(config.id)} value={String(config.id)}>
                  {display(config.config_key)} - current {display((config.current_version as Record<string, unknown> | undefined)?.value)}
                </option>
              ))}
            </select>
            <input
              className="form-input text-sm"
              value={configForm.proposedValue}
              onChange={(event) => setConfigForm((prev) => ({ ...prev, proposedValue: event.target.value }))}
              placeholder="Proposed value"
            />
            <input
              className="form-input text-sm"
              value={configForm.reason}
              onChange={(event) => setConfigForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Reason"
            />
            <button type="submit" className="btn-primary text-xs" disabled={saving !== null}>
              Propose Change
            </button>
          </form>
          <Table
            rows={state.configurations.slice(0, 8)}
            columns={[
              ["Key", "config_key"],
              ["Domain", "domain"],
              ["Sensitivity", "sensitivity"],
              ["Pending", "pending_changes"],
            ]}
          />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Feature Flags" count={state.featureFlags.length}>
          <Table
            rows={state.featureFlags.slice(0, 8)}
            columns={[
              ["Flag", "flag_key"],
              ["Type", "flag_type"],
              ["Status", "status"],
            ]}
            actions={(row) => {
              const id = idOf(row);
              if (!id) return null;
              if (row.status === "approved") {
                return <ActionButton label="Activate" busy={saving !== null} onClick={() => act("Feature flag activation", () => adminConsoleApi.activateFeatureFlag(id))} />;
              }
              if (row.status === "draft") {
                return <ActionButton label="Approve" busy={saving !== null} onClick={() => act("Feature flag approval", () => adminConsoleApi.approveFeatureFlag(id))} />;
              }
              if (row.status === "active") {
                return <ActionButton label="Disable" busy={saving !== null} onClick={() => act("Feature flag disablement", () => adminConsoleApi.disableFeatureFlag(id))} />;
              }
              return null;
            }}
          />
        </Panel>

        <Panel title="Scheduled Jobs" count={state.jobs.length}>
          <Table
            rows={state.jobs.slice(0, 8)}
            columns={[
              ["Job", "job_key"],
              ["Enabled", "enabled"],
              ["Last", "last_result"],
            ]}
            actions={(row) => {
              const id = idOf(row);
              if (!id) return null;
              return <ActionButton label="Run" busy={saving !== null} onClick={() => act("Manual job run", () => adminConsoleApi.runJob(id, { reason: "Manual run from Operational Control." }))} />;
            }}
          />
        </Panel>

        <Panel title="Dead-Letter Queue" count={state.deadLetters.length}>
          <Table
            rows={state.deadLetters.slice(0, 8)}
            columns={[
              ["Source", "source_service"],
              ["Severity", "severity"],
              ["Status", "status"],
            ]}
            actions={(row) => {
              const id = idOf(row);
              if (!id) return null;
              if (row.replay_safe === true) {
                return <ActionButton label="Replay" busy={saving !== null} onClick={() => act("Dead-letter replay", () => adminConsoleApi.replayDeadLetter(id))} />;
              }
              return <ActionButton label="Close" busy={saving !== null} onClick={() => act("Dead-letter resolution", () => adminConsoleApi.resolveDeadLetter(id, { reason: "Closed as accepted exception from Operational Control." }))} />;
            }}
          />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Reference Data" count={state.referenceData.length}>
          <Table rows={state.referenceData.slice(0, 8)} columns={[["Set", "set_key"], ["Domain", "domain"], ["Items", "items_count"]]} />
        </Panel>
        <Panel title="Integrations" count={state.integrations.length}>
          <Table rows={state.integrations.slice(0, 8)} columns={[["Integration", "name"], ["Status", "status"], ["Secret", "secret_reference"]]} />
        </Panel>
        <Panel title="Backup & Recovery" count={state.backups.length}>
          <Table rows={state.backups.slice(0, 8)} columns={[["Type", "backup_type"], ["Status", "status"], ["Verified", "last_verification_at"]]} />
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Restore requests</h3>
              <span className="text-xs text-neutral-500">{state.restoreRequests.length} tracked</span>
            </div>
            <Table
              rows={state.restoreRequests.slice(0, 8)}
              columns={[["Reference", "reference"], ["Type", "restore_type"], ["Environment", "target_environment"], ["Status", "status"]]}
              actions={(row) => {
                const id = idOf(row);
                if (!id) return null;
                const status = String(row.status ?? "");
                return (
                  <div className="flex flex-wrap justify-end gap-2">
                    {status === "requested" ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => act("Restore approval", () => adminConsoleApi.approveRestore(id))}>
                        Approve
                      </button>
                    ) : null}
                    {status === "approved" ? (
                      <button type="button" className="btn-primary text-xs" onClick={() => act("Restore execution", () => adminConsoleApi.executeRestore(id, { verification_status: "completed" }))}>
                        Record execution
                      </button>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>
          <form className="mt-4 grid gap-2 rounded-lg border border-neutral-200 p-3" onSubmit={requestRestore}>
            <select
              className="form-input text-sm"
              value={restoreForm.restore_type}
              onChange={(event) => setRestoreForm((prev) => ({ ...prev, restore_type: event.target.value }))}
              aria-label="Restore type"
            >
              <option value="test_restoration">Test restoration</option>
              <option value="single_document_restoration">Single document restoration</option>
              <option value="record_recovery">Record recovery</option>
              <option value="point_in_time_database_recovery">Point-in-time database recovery</option>
              <option value="disaster_recovery">Disaster recovery</option>
            </select>
            <select
              className="form-input text-sm"
              value={restoreForm.target_environment}
              onChange={(event) => setRestoreForm((prev) => ({ ...prev, target_environment: event.target.value }))}
              aria-label="Target environment"
            >
              <option value="staging">Staging</option>
              <option value="testing">Testing</option>
              <option value="user_acceptance_testing">UAT</option>
              <option value="production">Production</option>
              <option value="disaster_recovery">Disaster recovery</option>
            </select>
            <textarea
              className="form-input min-h-20 text-sm"
              value={restoreForm.reason}
              onChange={(event) => setRestoreForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Restore reason and scope"
            />
            <button type="submit" className="btn-primary text-xs" disabled={saving !== null}>
              Request Restore
            </button>
          </form>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Calendars" count={state.calendars.length}>
          <Table rows={state.calendars.slice(0, 6)} columns={[["Calendar", "name"], ["Year", "effective_year"], ["Days", "days_count"]]} />
        </Panel>
        <Panel title="Numbering Schemes" count={state.numbering.length}>
          <Table rows={state.numbering.slice(0, 6)} columns={[["Scheme", "scheme_key"], ["Prefix", "prefix"], ["Example", "example"]]} />
        </Panel>
        <Panel title="Localisation" count={state.localisation.length}>
          <Table rows={state.localisation.slice(0, 6)} columns={[["Key", "translation_key"], ["Module", "module"], ["Status", "status"]]} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Data Quality" count={state.dataQuality.length}>
          <Table rows={state.dataQuality.slice(0, 8)} columns={[["Issue", "reference"], ["Module", "module"], ["Severity", "severity"], ["Status", "status"]]} />
        </Panel>
        <Panel title="Imports & Migrations" count={state.imports.length + state.migrations.length}>
          <Table rows={[...state.imports.slice(0, 4), ...state.migrations.slice(0, 4)]} columns={[["Reference", "reference"], ["Status", "status"], ["Source", "source_system"], ["Type", "import_type"]]} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Support Access" count={0}>
          <form className="grid gap-3" onSubmit={requestSupport}>
            <input
              className="form-input text-sm"
              value={supportForm.ticket_reference}
              onChange={(event) => setSupportForm((prev) => ({ ...prev, ticket_reference: event.target.value }))}
              placeholder="Ticket reference"
            />
            <textarea
              className="form-input min-h-24 text-sm"
              value={supportForm.reason}
              onChange={(event) => setSupportForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Reason and scope"
            />
            <button type="submit" className="btn-primary text-xs" disabled={saving !== null}>
              Request Support Session
            </button>
          </form>
        </Panel>
        <Panel title="Break-Glass" count={0}>
          <form className="grid gap-3" onSubmit={requestBreakGlass}>
            <input
              className="form-input text-sm"
              value={breakGlassForm.incident_reference}
              onChange={(event) => setBreakGlassForm((prev) => ({ ...prev, incident_reference: event.target.value }))}
              placeholder="Incident or change reference"
            />
            <textarea
              className="form-input min-h-24 text-sm"
              value={breakGlassForm.reason}
              onChange={(event) => setBreakGlassForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Emergency reason"
            />
            <button type="submit" className="btn-primary text-xs" disabled={saving !== null}>
              Request Break-Glass
            </button>
          </form>
        </Panel>
      </section>
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

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
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

function Table({
  rows,
  columns,
  actions,
}: {
  rows: AdminConsoleRow[];
  columns: Array<[string, string]>;
  actions?: (row: AdminConsoleRow) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500">No records available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
            {actions ? <th className="text-right">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map(([label, field]) => (
                <td key={`${label}-${field}`} className="max-w-64 truncate">
                  {field === "status" || field.endsWith("_status") || field === "health_status" || field === "severity" ? (
                    <RowStatus status={row[field]} />
                  ) : (
                    display(row[field])
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
