"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminApi,
  workflowEngineApi,
  type User,
  type WorkflowSimulationField,
  type WorkflowSimulationModule,
  type WorkflowSimulationResult,
  type WorkflowSimulationStage,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { getStoredUser } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatApplicablePath, parseSimulationResponse } from "@/lib/workflowSimulation";

type FieldValue = string | boolean;
type FieldValues = Record<string, FieldValue>;

function valuesFromPreset(module: WorkflowSimulationModule, presetKey?: string | null): FieldValues {
  const preset = module.presets.find((item) => item.key === presetKey) ?? module.presets[0];
  const context = preset?.context ?? {};
  const next: FieldValues = {};
  for (const field of module.fields) {
    const raw = context[field.key] ?? field.default;
    if (field.type === "boolean") {
      next[field.key] = Boolean(raw);
    } else if (raw == null) {
      next[field.key] = "";
    } else {
      next[field.key] = String(raw);
    }
  }
  return next;
}

function contextFromValues(fields: WorkflowSimulationField[], values: FieldValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key];
    if (field.type === "boolean") {
      out[field.key] = Boolean(raw);
      continue;
    }
    if (raw === "" || raw == null) continue;
    if (field.type === "number") {
      const n = Number(raw);
      if (!Number.isNaN(n)) out[field.key] = n;
      continue;
    }
    out[field.key] = raw;
  }
  return out;
}

export default function WorkflowSimulatePage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [modules, setModules] = useState<WorkflowSimulationModule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [moduleType, setModuleType] = useState("");
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [requesterId, setRequesterId] = useState<number | "">("");
  const [scenarioKey, setScenarioKey] = useState("");
  const [values, setValues] = useState<FieldValues>({});
  const [result, setResult] = useState<WorkflowSimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [browseModules, setBrowseModules] = useState(true);

  const selected = useMemo(
    () => modules.find((item) => item.module_type === moduleType) ?? null,
    [modules, moduleType],
  );

  useEffect(() => {
    const me = getStoredUser();
    if (me?.id) setRequesterId(me.id);
    Promise.all([
      workflowEngineApi.simulationCatalog(),
      adminApi.listUsers({ per_page: 200 }).catch(() => null),
    ])
      .then(([catalogRes, userRes]) => {
        const body = catalogRes.data as { data?: { modules?: WorkflowSimulationModule[] }; modules?: WorkflowSimulationModule[] };
        const rows = body.data?.modules ?? body.modules ?? [];
        setModules(rows);
        const listed = userRes?.data?.data ?? [];
        setUsers(listed);
        if (me?.id && !listed.some((user) => user.id === me.id)) {
          setUsers((prev) => [{ id: me.id, name: me.name, email: me.email } as User, ...prev]);
        }
      })
      .catch((err: unknown) => {
        toast("error", t("workflows.simulate.loadError"), apiErrorMessage(err, t("workflows.simulate.loadError")));
      })
      .finally(() => setLoading(false));
  }, [toast, t]);

  const applyModule = useCallback((nextType: string) => {
    setModuleType(nextType);
    setResult(null);
    setBrowseModules(!nextType);
    const next = modules.find((item) => item.module_type === nextType);
    if (!next) {
      setWorkflowId(null);
      setScenarioKey("");
      setValues({});
      return;
    }
    setWorkflowId(next.workflows[0]?.id ?? null);
    const firstPreset = next.presets[0]?.key ?? "";
    setScenarioKey(firstPreset);
    setValues(valuesFromPreset(next, firstPreset));
  }, [modules]);

  const applyPreset = (key: string) => {
    if (!selected) return;
    setScenarioKey(key);
    setValues(valuesFromPreset(selected, key));
    setResult(null);
  };

  const run = async () => {
    if (!selected || !workflowId) return;
    setRunning(true);
    try {
      const res = await workflowEngineApi.simulate(workflowId, {
        test_context: contextFromValues(selected.fields, values),
        scenario_key: scenarioKey || undefined,
        requester_user_id: requesterId === "" ? undefined : Number(requesterId),
      });
      const parsed = parseSimulationResponse(res.data) ?? parseSimulationResponse(res);
      if (!parsed) {
        toast("error", "workflows.simulate.parseError", "workflows.simulate.successHint");
        return;
      }
      setResult(parsed as WorkflowSimulationResult);
      const path = formatApplicablePath(parsed);
      toast(
        "success",
        path ? t("workflows.simulate.successPath", { path }) : "workflows.simulate.success",
        "workflows.simulate.successHint",
      );
      window.setTimeout(() => {
        document.getElementById("wf-sim-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err: unknown) {
      toast("error", t("workflows.simulate.failed"), apiErrorMessage(err, t("workflows.simulate.failed")));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="workflows.simulate.title"
        subtitle="workflows.simulate.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.admin", href: "/admin" },
              { label: "workflows.simulate.breadcrumb.workflows", href: "/admin/workflows" },
              { label: "workflows.simulate.title" },
            ]}
          />
        }
        meta={<Badge variant="info">{t("workflows.simulate.dryRun")}</Badge>}
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            {t("workflows.simulate.back")}
          </Link>
        }
      />

      <FormSection title="workflows.simulate.module" description="workflows.simulate.modulePickerHint" icon="view_module" dense>
          <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="wf-sim-module" className="mb-1 block text-xs font-semibold text-neutral-700">
                {t("workflows.simulate.module")}
              </label>
              <select
                id="wf-sim-module"
                className="form-input max-w-md"
                value={moduleType}
                disabled={loading}
                onChange={(e) => applyModule(e.target.value)}
              >
                <option value="">{loading ? t("common.loading") : t("workflows.simulate.selectModuleFirst")}</option>
                {modules.map((item) => (
                  <option key={item.module_type} value={item.module_type}>
                    {t(item.label_key)}
                  </option>
                ))}
              </select>
            </div>
            {selected && !browseModules ? (
              <button
                id="wf-sim-change-module"
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setBrowseModules(true)}
              >
                {t("workflows.simulate.changeModule")}
              </button>
            ) : null}
          </div>
          {browseModules ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((item) => {
                const active = item.module_type === moduleType;
                return (
                  <button
                    key={item.module_type}
                    type="button"
                    onClick={() => applyModule(item.module_type)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-neutral-200 bg-white hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{t(item.label_key)}</p>
                    <p className="mt-1 text-xs text-neutral-500">{t(item.description_key)}</p>
                    <p className="mt-2 text-[11px] text-neutral-400">
                      {item.workflows.length} {t("workflows.simulate.workflowCount")}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
          {!loading && modules.length === 0 ? (
            <EmptyState icon="account_tree" title="workflows.simulate.noCatalog" description="workflows.simulate.noCatalogHint" />
          ) : null}
        </div>
      </FormSection>

      {selected ? (
        <>
          <FormSection title="workflows.simulate.scenario" description={selected.description_key} icon="science" dense>
            <div className="flex flex-wrap gap-2">
              {selected.presets.map((preset) => {
                const active = preset.key === scenarioKey;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      active ? "bg-primary text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {t(preset.label_key)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-neutral-500">{t("workflows.simulate.scenarioHint")}</p>
          </FormSection>

          <FormSection title="workflows.simulate.context" icon="tune" dense>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wf-sim-workflow" className="mb-1 block text-xs font-semibold text-neutral-700">
                  {t("workflows.simulate.workflow")}
                </label>
                <select
                  id="wf-sim-workflow"
                  className="form-input"
                  value={workflowId ?? ""}
                  onChange={(e) => setWorkflowId(Number(e.target.value) || null)}
                >
                  <option value="">{t("workflows.simulate.workflowPlaceholder")}</option>
                  {selected.workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wf-sim-requester" className="mb-1 block text-xs font-semibold text-neutral-700">
                  {t("workflows.simulate.requester")}
                </label>
                <select
                  id="wf-sim-requester"
                  className="form-input"
                  value={requesterId}
                  onChange={(e) => setRequesterId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">{t("workflows.simulate.requesterMe")}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">{t("workflows.simulate.requesterHint")}</p>
              </div>
              {selected.fields.map((field) => {
                const id = `wf-sim-field-${field.key}`;
                if (field.type === "boolean") {
                  return (
                    <div key={field.key} className="flex items-center gap-2 pt-5">
                      <input
                        id={id}
                        type="checkbox"
                        className="h-4 w-4 rounded text-primary focus:ring-primary"
                        checked={Boolean(values[field.key])}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                      />
                      <label htmlFor={id} className="text-sm text-neutral-700">
                        {t(field.label_key)}
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={field.key}>
                    <label htmlFor={id} className="mb-1 block text-xs font-semibold text-neutral-700">
                      {t(field.label_key)}
                      {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                    </label>
                    {field.type === "select" ? (
                      <select
                        id={id}
                        className="form-input"
                        value={String(values[field.key] ?? "")}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value=""></option>
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label_key)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        className="form-input"
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        inputMode={field.type === "number" ? "decimal" : undefined}
                        min={field.min}
                        step={field.step}
                        value={String(values[field.key] ?? "")}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary text-sm" onClick={run} disabled={!workflowId || running}>
                {running ? t("workflows.simulate.running") : t("workflows.simulate.run")}
              </button>
              <p className="text-xs text-neutral-500">{t("workflows.simulate.dryRun")}</p>
            </div>
          </FormSection>
          {result ? <SimulationResult result={result} /> : null}
        </>
      ) : (
        !loading ? (
          <div className="card">
            <EmptyState icon="science" title="workflows.simulate.emptyModule" description="workflows.simulate.emptyModuleHint" />
          </div>
        ) : null
      )}

      {selected && selected.workflows.length === 0 ? (
        <div className="card">
          <EmptyState icon="account_tree" title="workflows.simulate.noWorkflows" description="workflows.simulate.noWorkflowsHint" />
        </div>
      ) : null}
    </div>
  );
}

function SimulationResult({ result }: { result: WorkflowSimulationResult }) {
  const { t } = useI18n();
  const stages = result.stages ?? [];
  const path = formatApplicablePath(result);
  const contextEntries = Object.entries(result.normalized_context ?? {});

  return (
    <div id="wf-sim-result">
      <FormSection title="workflows.simulate.path" icon="route">
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {result.module_type ? <Badge variant="primary">{t(`workflows.simulate.module.${result.module_type}`)}</Badge> : null}
        {result.scenario_label_key ? <Badge variant="info">{t(result.scenario_label_key)}</Badge> : null}
        <Badge variant="success">{t("workflows.simulate.dryRun")}</Badge>
      </div>

      {path ? (
        <p className="mb-4 text-base font-semibold text-neutral-900">{path}</p>
      ) : null}

      <ol className="space-y-3">
        {stages.map((stage) => (
          <StageRow key={`${stage.step_index}-${stage.step_order}`} stage={stage} />
        ))}
      </ol>

      {contextEntries.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("workflows.simulate.contextUsed")}
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {contextEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg bg-neutral-50 px-3 py-2">
                <dt className="text-[11px] font-semibold text-neutral-500">
                  {t(`workflows.simulate.field.${key}`) === `workflows.simulate.field.${key}` ? key : t(`workflows.simulate.field.${key}`)}
                </dt>
                <dd className="text-sm text-neutral-800">{formatContextValue(value, t)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {result.requester ? (
        <p className="mt-4 text-xs text-neutral-500">
          {t("workflows.simulate.requester")}: {result.requester.name}
        </p>
      ) : null}
      </FormSection>
    </div>
  );
}

function StageRow({ stage }: { stage: WorkflowSimulationStage }) {
  const { t } = useI18n();
  const applies = stage.applies;
  return (
    <li
      className={`rounded-xl border px-4 py-3 ${
        applies ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-semibold ${applies ? "text-neutral-900" : "text-neutral-500"}`}>
            {stage.step_name || t("workflows.simulate.stages")}
          </p>
          <p className="text-xs capitalize text-neutral-500">{stage.stage_type}</p>
        </div>
        <Badge variant={applies ? "success" : "muted"}>
          {applies ? t("workflows.simulate.applies") : t("workflows.simulate.skipped")}
        </Badge>
      </div>
      {stage.skip_reason ? (
        <p className="mt-2 text-xs text-neutral-500">
          {t(`workflows.simulate.skip.${stage.skip_reason}`)}
          {stage.condition_summary ? ` · ${stage.condition_summary}` : ""}
        </p>
      ) : null}
      {applies ? (
        <div className="mt-2 text-xs text-neutral-600">
          <p className="font-semibold text-neutral-500">{t("workflows.simulate.actors")}</p>
          {stage.actors && stage.actors.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {stage.actors.map((actor) => (
                <li key={actor.id}>{actor.name}</li>
              ))}
            </ul>
          ) : (
            <p>{stage.actor_reason || t("workflows.simulate.noActors")}</p>
          )}
          {stage.due_at ? (
            <p className="mt-1 text-neutral-500">
              {t("workflows.simulate.due")}: {stage.due_at}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function formatContextValue(value: unknown, t: (key: string) => string): string {
  if (typeof value === "boolean") return value ? t("workflows.simulate.yes") : t("workflows.simulate.no");
  if (value == null || value === "") return "—";
  return String(value);
}
