"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi, type ApprovalWorkflow } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

type StageDraft = {
  step_order: number;
  step_name?: string;
  stage_type: string;
  actor_selector: string;
  role_id?: number | null;
  completion_rule?: string;
  quorum_count?: number | null;
  quorum_percentage?: number | null;
  parallel_group?: string | null;
  routing_strategy?: string;
  sla_hours?: number | null;
  governance_body_name?: string | null;
  requires_comment?: boolean;
  allow_return?: boolean;
  condition_expression?: unknown;
};

const ACTOR_SELECTORS = [
  { value: "supervisor", label: "Direct supervisor" },
  { value: "hod", label: "Head of department (up the chain)" },
  { value: "director_finance", label: "Director of Finance" },
  { value: "sg", label: "Secretary General" },
  { value: "specific_role", label: "Specific role (set Role ID)" },
  { value: "specific_user", label: "Specific user" },
  { value: "position", label: "Position holder" },
  { value: "queue", label: "Shared queue" },
  { value: "authority_holder", label: "Authority-action holder" },
];

export default function WorkflowDesignerPage() {
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<ApprovalWorkflow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [lint, setLint] = useState<{ hard: string[]; soft: string[]; valid: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfApprovalPolicy, setSelfApprovalPolicy] = useState("denied");
  const [conditionDrafts, setConditionDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    workflowEngineApi.definitions().then((res) => setDefinitions(res.data.data || [])).catch(() => {
      toast("error", "Load failed", "Could not load workflow definitions.");
    });
  }, [toast]);

  const loadDraft = async (workflowId: number) => {
    setBusy(true);
    setSelectedId(workflowId);
    setSelfApprovalPolicy(definitions.find((d) => d.id === workflowId)?.self_approval_policy ?? "denied");
    try {
      const created = await workflowEngineApi.createVersion(workflowId);
      const version = (created.data as any).data;
      setVersionId(version.id);
      const loadedStages = (version.stages_snapshot || []).map((s: StageDraft, i: number) => ({
        ...s,
        step_order: s.step_order ?? i,
      }));
      setStages(loadedStages);
      setConditionDrafts(
        Object.fromEntries(
          loadedStages.map((s: StageDraft, i: number) => [i, s.condition_expression ? JSON.stringify(s.condition_expression) : ""]),
        ),
      );
      setLint(null);
    } catch {
      toast("error", "Draft failed", "Could not create draft version.");
    } finally {
      setBusy(false);
    }
  };

  const saveSelfApprovalPolicy = async (policy: string) => {
    if (!selectedId) return;
    setSelfApprovalPolicy(policy);
    try {
      await workflowEngineApi.updatePolicy(selectedId, policy);
      setDefinitions((prev) => prev.map((d) => (d.id === selectedId ? { ...d, self_approval_policy: policy } : d)));
      toast("success", "Policy updated", "Self-approval policy saved.");
    } catch {
      toast("error", "Save failed", "Could not update self-approval policy.");
    }
  };

  const applyConditionDraft = (index: number, raw: string) => {
    setConditionDrafts((prev) => ({ ...prev, [index]: raw }));
    if (raw.trim() === "") {
      updateStage(index, { condition_expression: null });
      return;
    }
    try {
      updateStage(index, { condition_expression: JSON.parse(raw) });
    } catch {
      // Leave the stage's last-valid condition_expression in place while the JSON is mid-edit/invalid.
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStages(next.map((s, i) => ({ ...s, step_order: i })));
  };

  const updateStage = (index: number, patch: Partial<StageDraft>) => {
    const next = [...stages];
    next[index] = { ...next[index], ...patch };
    setStages(next);
  };

  const saveAndLint = async () => {
    if (!versionId) return;
    setBusy(true);
    try {
      await workflowEngineApi.updateDraft(versionId, { stages });
      const res = await workflowEngineApi.lint(versionId);
      setLint(res.data.data);
      toast(res.data.data.valid ? "success" : "error", "Lint complete", res.data.data.valid ? "No hard failures." : "Hard failures block publish.");
    } catch {
      toast("error", "Save failed", "Could not save draft or lint.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!versionId) return;
    setBusy(true);
    try {
      await workflowEngineApi.updateDraft(versionId, { stages });
      await workflowEngineApi.approveVersion(versionId);
      await workflowEngineApi.publishVersion(versionId);
      toast("success", "Published", "Definition version published after lint.");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.definition?.[0] || "Publish blocked.";
      toast("error", "Publish blocked", String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <ModulePageHeader
        title="Visual Workflow Designer"
        subtitle="Edit stages, transitions, conditions, and actor selectors. Validate before publish."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Workflows", href: "/admin/workflows" },
              { label: "Designer" },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            Back to Workflows
          </Link>
        }
      />

      <div className="hidden">
        <p className="text-sm text-[var(--muted)]">Workflow Engine · Phase 2</p>
        <h1 className="text-2xl font-semibold">Visual workflow designer</h1>
        <p className="text-sm mt-1">Edit stages, transitions, conditions, and actor selectors. Validate before publish.</p>
        <Link href="/admin/workflows" className="text-sm underline mt-2 inline-block">Back to Workflows</Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          className="border rounded px-3 py-2 bg-transparent"
          value={selectedId ?? ""}
          onChange={(e) => e.target.value && loadDraft(Number(e.target.value))}
        >
          <option value="">Select definition…</option>
          {definitions.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.module_type})</option>
          ))}
        </select>
        <button disabled={!versionId || busy} onClick={saveAndLint} className="px-3 py-2 border rounded">Save & lint</button>
        <button disabled={!versionId || busy || Boolean(lint && !lint.valid)} onClick={publish} className="px-3 py-2 border rounded">Approve & publish</button>
      </div>

      {selectedId && (
        <div className="border rounded p-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Self-approval policy</label>
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={selfApprovalPolicy}
            onChange={(e) => saveSelfApprovalPolicy(e.target.value)}
          >
            <option value="denied">Denied — always blocked</option>
            <option value="allow_with_controls">Allow with controls — mandatory comment + audit flag</option>
            <option value="require_external_approver">Require external approver — routes to an outside authority</option>
          </select>
          <span className="text-xs text-[var(--muted)]">
            Governs what happens when the applicant is also a resolved approver on this workflow (PRD §10-11).
          </span>
        </div>
      )}

      {lint && (
        <div className="border rounded p-3 text-sm space-y-1">
          <div>Valid: {lint.valid ? "yes" : "no"}</div>
          {lint.hard.map((h) => <div key={h} className="text-red-700">Hard: {h}</div>)}
          {lint.soft.map((s) => <div key={s} className="text-amber-700">Soft: {s}</div>)}
        </div>
      )}

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div key={`${stage.step_order}-${index}`} className="border rounded p-3 grid gap-2 md:grid-cols-2">
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => move(index, -1)} className="border px-2">↑</button>
              <button type="button" onClick={() => move(index, 1)} className="border px-2">↓</button>
              <span className="text-sm">Order {stage.step_order}</span>
            </div>
            <input className="border rounded px-2 py-1 bg-transparent" placeholder="Step name" value={stage.step_name || ""} onChange={(e) => updateStage(index, { step_name: e.target.value })} />
            <select className="border rounded px-2 py-1 bg-transparent" value={stage.stage_type} onChange={(e) => updateStage(index, { stage_type: e.target.value })}>
              {["review", "recommend", "verify", "certify", "authorise", "approve", "sign", "release"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="border rounded px-2 py-1 bg-transparent"
              value={ACTOR_SELECTORS.some((s) => s.value === stage.actor_selector) ? stage.actor_selector : "specific_role"}
              onChange={(e) => updateStage(index, { actor_selector: e.target.value })}
            >
              {ACTOR_SELECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {(stage.actor_selector === "specific_role" || stage.actor_selector === "specific_user") && (
              <input
                className="border rounded px-2 py-1 bg-transparent"
                type="number"
                placeholder={stage.actor_selector === "specific_role" ? "Role ID" : "User ID"}
                value={stage.role_id ?? ""}
                onChange={(e) => updateStage(index, { role_id: e.target.value ? Number(e.target.value) : null })}
              />
            )}
            <select className="border rounded px-2 py-1 bg-transparent" value={stage.completion_rule || "any"} onChange={(e) => updateStage(index, { completion_rule: e.target.value })}>
              {["any", "all", "quorum", "percentage", "lead_plus_support"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="border rounded px-2 py-1 bg-transparent" type="number" placeholder="Quorum N" value={stage.quorum_count ?? ""} onChange={(e) => updateStage(index, { quorum_count: e.target.value ? Number(e.target.value) : null })} />
            <input className="border rounded px-2 py-1 bg-transparent" placeholder="Parallel group" value={stage.parallel_group || ""} onChange={(e) => updateStage(index, { parallel_group: e.target.value || null })} />
            <select className="border rounded px-2 py-1 bg-transparent" value={stage.routing_strategy || "primary"} onChange={(e) => updateStage(index, { routing_strategy: e.target.value })}>
              {["primary", "queue_claim", "workload", "deterministic_fallback"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="border rounded px-2 py-1 bg-transparent" type="number" placeholder="SLA hours" value={stage.sla_hours ?? ""} onChange={(e) => updateStage(index, { sla_hours: e.target.value ? Number(e.target.value) : null })} />
            <input className="border rounded px-2 py-1 bg-transparent" placeholder="Governance body" value={stage.governance_body_name || ""} onChange={(e) => updateStage(index, { governance_body_name: e.target.value || null })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(stage.requires_comment)} onChange={(e) => updateStage(index, { requires_comment: e.target.checked })} />
              Requires comment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(stage.allow_return)} onChange={(e) => updateStage(index, { allow_return: e.target.checked })} />
              Allow return for correction
            </label>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--muted)] block mb-1">
                Condition expression (JSON — e.g. {"{"}"field":"amount","op":"gte","value":5000{"}"}, empty = always run)
              </label>
              <textarea
                className="border rounded px-2 py-1 bg-transparent w-full font-mono text-xs"
                rows={2}
                placeholder='{"field":"amount","op":"gte","value":5000}'
                value={conditionDrafts[index] ?? ""}
                onChange={(e) => applyConditionDraft(index, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
