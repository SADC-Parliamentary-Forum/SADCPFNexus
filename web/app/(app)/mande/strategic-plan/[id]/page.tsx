"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mandeApi,
  type StrategicGoal,
  type StrategicObjective,
  type StrategicOutcome,
  type StrategicPlan,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

type NodeDraft = { title: string; code: string; description: string };

const EMPTY_DRAFT: NodeDraft = { title: "", code: "", description: "" };

function NodeForm({
  label,
  draft,
  setDraft,
  onSubmit,
  pending,
  onCancel,
}: {
  label: string;
  draft: NodeDraft;
  setDraft: (d: NodeDraft) => void;
  onSubmit: () => void;
  pending: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-neutral-700">{label}</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px]">
        <input
          className="form-input"
          placeholder="Title *"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className="form-input"
          placeholder="Code"
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
        />
      </div>
      <textarea
        className="form-input min-h-[60px]"
        placeholder="Description"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary text-xs disabled:opacity-40"
          disabled={!draft.title.trim() || pending}
          onClick={onSubmit}
        >
          {pending ? "Saving…" : "Add"}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function StrategicPlanDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");

  const [goalDraft, setGoalDraft] = useState<NodeDraft>(EMPTY_DRAFT);
  const [addingObjectiveFor, setAddingObjectiveFor] = useState<number | null>(null);
  const [addingOutcomeFor, setAddingOutcomeFor] = useState<number | null>(null);
  const [addingOutputFor, setAddingOutputFor] = useState<number | null>(null);
  const [childDraft, setChildDraft] = useState<NodeDraft>(EMPTY_DRAFT);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ["mande", "strategic-plan", id],
    queryFn: () => mandeApi.getPlan(id).then((r) => r.data.data as StrategicPlan),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mande", "strategic-plan", id] });
    qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
  };

  const payload = (d: NodeDraft) => ({
    title: d.title.trim(),
    code: d.code.trim() || undefined,
    description: d.description.trim() || undefined,
  });

  const addGoalMut = useMutation({
    mutationFn: () => mandeApi.addGoal(id, payload(goalDraft)),
    onSuccess: () => {
      setGoalDraft(EMPTY_DRAFT);
      setActionMsg("Goal added.");
      invalidate();
    },
  });

  const addObjectiveMut = useMutation({
    mutationFn: (goalId: number) => mandeApi.addObjective(goalId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingObjectiveFor(null);
      setActionMsg("Objective added.");
      invalidate();
    },
  });

  const addOutcomeMut = useMutation({
    mutationFn: (objectiveId: number) => mandeApi.addOutcome(objectiveId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingOutcomeFor(null);
      setActionMsg("Outcome added.");
      invalidate();
    },
  });

  const addOutputMut = useMutation({
    mutationFn: (outcomeId: number) => mandeApi.addOutput(outcomeId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingOutputFor(null);
      setActionMsg("Output added.");
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ type, nodeId }: { type: "goal" | "objective" | "outcome" | "output"; nodeId: number }) =>
      mandeApi.deleteNode(type, nodeId),
    onSuccess: () => {
      setActionMsg("Node removed.");
      invalidate();
    },
  });

  const startChild = (kind: "objective" | "outcome" | "output", parentId: number) => {
    setChildDraft(EMPTY_DRAFT);
    setAddingObjectiveFor(kind === "objective" ? parentId : null);
    setAddingOutcomeFor(kind === "outcome" ? parentId : null);
    setAddingOutputFor(kind === "output" ? parentId : null);
  };

  if (isLoading) {
    return <div className="px-5 py-10 text-sm text-neutral-400">Loading plan…</div>;
  }
  if (isError || !plan) {
    return (
      <div className="space-y-3">
        <Link href="/mande/strategic-plan" className="text-xs text-primary hover:underline">← Strategic plans</Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Plan not found.</div>
      </div>
    );
  }

  const goals = plan.goals ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/mande/strategic-plan" className="text-xs text-primary hover:underline">← Strategic plans</Link>
        <h1 className="page-title mt-1">{plan.name}</h1>
        <p className="page-subtitle">
          {plan.period ?? "No period"}
          {" · "}
          {plan.start_date ? formatDateShort(plan.start_date) : "—"}
          {" → "}
          {plan.end_date ? formatDateShort(plan.end_date) : "—"}
          {" · "}
          <span className="capitalize">{plan.status}</span>
        </p>
      </div>

      {actionMsg && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">{actionMsg}</div>
      )}

      {plan.description && (
        <p className="text-sm text-neutral-600">{plan.description}</p>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-neutral-800">Results hierarchy</h2>
          <span className="text-xs text-neutral-400">{goals.length} goal{goals.length === 1 ? "" : "s"}</span>
        </div>

        {goals.length === 0 && (
          <div className="card px-5 py-8 text-center text-sm text-neutral-500">
            No goals yet. {canAdmin ? "Add a goal below to start the hierarchy." : "An administrator can add goals."}
          </div>
        )}

        {goals.map((goal: StrategicGoal) => (
          <div key={goal.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Goal</p>
                <h3 className="text-base font-semibold text-neutral-900">
                  {goal.code ? `${goal.code} · ` : ""}{goal.title}
                </h3>
                {goal.description && <p className="text-xs text-neutral-500 mt-1">{goal.description}</p>}
              </div>
              {canAdmin && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-primary text-xs hover:underline"
                    onClick={() => startChild("objective", goal.id)}
                  >
                    + Objective
                  </button>
                  <button
                    type="button"
                    className="text-red-500 text-xs hover:underline"
                    onClick={() => {
                      if (confirm("Delete this goal and its children?")) {
                        deleteMut.mutate({ type: "goal", nodeId: goal.id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {addingObjectiveFor === goal.id && (
              <NodeForm
                label="New objective"
                draft={childDraft}
                setDraft={setChildDraft}
                pending={addObjectiveMut.isPending}
                onSubmit={() => addObjectiveMut.mutate(goal.id)}
                onCancel={() => setAddingObjectiveFor(null)}
              />
            )}

            {(goal.objectives ?? []).map((obj: StrategicObjective) => (
              <div key={obj.id} className="ml-3 border-l-2 border-neutral-200 pl-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Objective</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {obj.code ? `${obj.code} · ` : ""}{obj.title}
                    </p>
                    {obj.description && <p className="text-xs text-neutral-500">{obj.description}</p>}
                  </div>
                  {canAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-primary text-xs hover:underline"
                        onClick={() => startChild("outcome", obj.id)}
                      >
                        + Outcome
                      </button>
                      <button
                        type="button"
                        className="text-red-500 text-xs hover:underline"
                        onClick={() => {
                          if (confirm("Delete this objective?")) {
                            deleteMut.mutate({ type: "objective", nodeId: obj.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {addingOutcomeFor === obj.id && (
                  <NodeForm
                    label="New outcome"
                    draft={childDraft}
                    setDraft={setChildDraft}
                    pending={addOutcomeMut.isPending}
                    onSubmit={() => addOutcomeMut.mutate(obj.id)}
                    onCancel={() => setAddingOutcomeFor(null)}
                  />
                )}

                {(obj.outcomes ?? []).map((outcome: StrategicOutcome) => (
                  <div key={outcome.id} className="ml-3 border-l-2 border-neutral-100 pl-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Outcome</p>
                        <p className="text-sm text-neutral-800">
                          {outcome.code ? `${outcome.code} · ` : ""}{outcome.title}
                        </p>
                        {outcome.description && <p className="text-xs text-neutral-500">{outcome.description}</p>}
                      </div>
                      {canAdmin && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            className="text-primary text-xs hover:underline"
                            onClick={() => startChild("output", outcome.id)}
                          >
                            + Output
                          </button>
                          <button
                            type="button"
                            className="text-red-500 text-xs hover:underline"
                            onClick={() => {
                              if (confirm("Delete this outcome?")) {
                                deleteMut.mutate({ type: "outcome", nodeId: outcome.id });
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {addingOutputFor === outcome.id && (
                      <NodeForm
                        label="New output"
                        draft={childDraft}
                        setDraft={setChildDraft}
                        pending={addOutputMut.isPending}
                        onSubmit={() => addOutputMut.mutate(outcome.id)}
                        onCancel={() => setAddingOutputFor(null)}
                      />
                    )}

                    {(outcome.outputs ?? []).length > 0 && (
                      <ul className="ml-3 space-y-1.5">
                        {outcome.outputs!.map((output) => (
                          <li
                            key={output.id}
                            className="flex items-start justify-between gap-3 text-sm text-neutral-700"
                          >
                            <span>
                              <span className="text-[10px] font-semibold uppercase text-neutral-400 mr-2">Output</span>
                              {output.code ? `${output.code} · ` : ""}{output.title}
                            </span>
                            {canAdmin && (
                              <button
                                type="button"
                                className="text-red-500 text-xs hover:underline shrink-0"
                                onClick={() => {
                                  if (confirm("Delete this output?")) {
                                    deleteMut.mutate({ type: "output", nodeId: output.id });
                                  }
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {canAdmin && (
          <div className="card p-4">
            <NodeForm
              label="Add strategic goal"
              draft={goalDraft}
              setDraft={setGoalDraft}
              pending={addGoalMut.isPending}
              onSubmit={() => addGoalMut.mutate()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
