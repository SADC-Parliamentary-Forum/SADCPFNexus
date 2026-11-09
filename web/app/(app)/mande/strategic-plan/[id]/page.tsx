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
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type NodeDraft = { title: string; code: string; description: string };

const EMPTY_DRAFT: NodeDraft = { title: "", code: "", description: "" };

const DELETE_TITLE: Record<"goal" | "objective" | "outcome" | "output", string> = {
  goal: "mande.planDetail.deleteGoal",
  objective: "mande.planDetail.deleteObjective",
  outcome: "mande.planDetail.deleteOutcome",
  output: "mande.planDetail.deleteOutput",
};

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
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-neutral-700">{label}</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px]">
        <input
          className="form-input"
          placeholder={t("mande.planDetail.titleRequired")}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className="form-input"
          placeholder={t("fleet.col.code")}
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
        />
      </div>
      <textarea
        className="form-input min-h-[60px]"
        placeholder={t("correspondence.contacts.description")}
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
          {pending ? t("correspondence.saving") : t("common.add")}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>
            {t("common.cancel")}
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
  const { confirm } = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
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
      setActionMsg(t("mande.planDetail.goalAddedMsg"));
      toast.success(t("mande.planDetail.goalAdded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.planDetail.goalNotAdded"), apiErrorMessage(err, t("mande.planDetail.goalFailed"))),
  });

  const addObjectiveMut = useMutation({
    mutationFn: (goalId: number) => mandeApi.addObjective(goalId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingObjectiveFor(null);
      setActionMsg(t("mande.planDetail.objectiveAddedMsg"));
      toast.success(t("mande.planDetail.objectiveAdded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.planDetail.objectiveNotAdded"), apiErrorMessage(err, t("mande.planDetail.objectiveFailed"))),
  });

  const addOutcomeMut = useMutation({
    mutationFn: (objectiveId: number) => mandeApi.addOutcome(objectiveId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingOutcomeFor(null);
      setActionMsg(t("mande.planDetail.outcomeAddedMsg"));
      toast.success(t("mande.planDetail.outcomeAdded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.planDetail.outcomeNotAdded"), apiErrorMessage(err, t("mande.planDetail.outcomeFailed"))),
  });

  const addOutputMut = useMutation({
    mutationFn: (outcomeId: number) => mandeApi.addOutput(outcomeId, payload(childDraft)),
    onSuccess: () => {
      setChildDraft(EMPTY_DRAFT);
      setAddingOutputFor(null);
      setActionMsg(t("mande.planDetail.outputAddedMsg"));
      toast.success(t("mande.planDetail.outputAdded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.planDetail.outputNotAdded"), apiErrorMessage(err, t("mande.planDetail.outputFailed"))),
  });

  const deleteMut = useMutation({
    mutationFn: ({ type, nodeId }: { type: "goal" | "objective" | "outcome" | "output"; nodeId: number }) =>
      mandeApi.deleteNode(type, nodeId),
    onSuccess: () => {
      setActionMsg(t("mande.planDetail.nodeRemoved"));
      toast.success(t("mande.planDetail.itemRemoved"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.planDetail.itemNotRemoved"), apiErrorMessage(err, t("mande.planDetail.removeFailed"))),
  });

  const startChild = (kind: "objective" | "outcome" | "output", parentId: number) => {
    setChildDraft(EMPTY_DRAFT);
    setAddingObjectiveFor(kind === "objective" ? parentId : null);
    setAddingOutcomeFor(kind === "outcome" ? parentId : null);
    setAddingOutputFor(kind === "output" ? parentId : null);
  };

  const confirmDeleteNode = async (
    type: "goal" | "objective" | "outcome" | "output",
    nodeId: number,
    message: string,
  ) => {
    if (await confirm({ title: t(DELETE_TITLE[type]), message, variant: "danger" })) {
      deleteMut.mutate({ type, nodeId });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("mande.planDetail.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.plans.title"), href: "/mande/strategic-plan" }, { label: t("mande.frameworks.plan") }]} />}
        />
        <p className="text-sm text-neutral-400">{t("mande.planDetail.loading")}</p>
      </div>
    );
  }
  if (isError || !plan) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("mande.planDetail.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.plans.title"), href: "/mande/strategic-plan" }, { label: t("mande.frameworks.plan") }]} />}
        />
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{t("mande.planDetail.notFound")}</div>
        <Link href="/mande/strategic-plan" className="btn-secondary text-sm">{t("mande.planDetail.back")}</Link>
      </div>
    );
  }

  const goals = plan.goals ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={plan.name}
        subtitle={`${plan.period ?? t("mande.planDetail.noPeriod")} · ${plan.start_date ? formatDateShort(plan.start_date) : "—"} → ${plan.end_date ? formatDateShort(plan.end_date) : "—"} · ${plan.status === "active" ? t("mande.plans.status.active") : plan.status === "archived" ? t("correspondence.status.archived") : plan.status === "draft" ? t("status.draft") : plan.status}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.mande", href: "/mande" },
              { label: t("mande.plans.title"), href: "/mande/strategic-plan" },
              { label: plan.name },
            ]}
          />
        }
      />

      {actionMsg && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">{actionMsg}</div>
      )}

      {plan.description && (
        <p className="text-sm text-neutral-600">{plan.description}</p>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-neutral-800">{t("mande.planDetail.hierarchy")}</h2>
          <span className="text-xs text-neutral-400">{goals.length === 1 ? t("mande.planDetail.goalOne") : t("mande.planDetail.goalMany", { count: goals.length })}</span>
        </div>

        {goals.length === 0 && (
          <EmptyState
            icon="account_tree"
            title={t("mande.planDetail.noGoals")}
            description={canAdmin ? t("mande.planDetail.noGoalsAdmin") : t("mande.planDetail.noGoalsViewer")}
          />
        )}

        {goals.map((goal: StrategicGoal) => (
          <div key={goal.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("mande.reports.goal")}</p>
                <h3 className="text-base font-semibold text-neutral-900">
                  {goal.code ? `${goal.code} · ` : ""}{goal.title}
                </h3>
                {goal.description && <p className="text-xs text-neutral-500 mt-1">{goal.description}</p>}
              </div>
              {canAdmin && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => startChild("objective", goal.id)}
                  >
                    {t("mande.planDetail.addObjective")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs text-red-600"
                    onClick={() => confirmDeleteNode("goal", goal.id, t("mande.planDetail.deleteGoalMessage"))}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              )}
            </div>

            {addingObjectiveFor === goal.id && (
              <NodeForm
                label={t("mande.planDetail.newObjective")}
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{t("mande.planDetail.objective")}</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {obj.code ? `${obj.code} · ` : ""}{obj.title}
                    </p>
                    {obj.description && <p className="text-xs text-neutral-500">{obj.description}</p>}
                  </div>
                  {canAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => startChild("outcome", obj.id)}
                      >
                        {t("mande.planDetail.addOutcome")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs text-red-600"
                        onClick={() => confirmDeleteNode("objective", obj.id, t("mande.planDetail.deleteObjectiveMessage"))}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>

                {addingOutcomeFor === obj.id && (
                  <NodeForm
                    label={t("mande.planDetail.newOutcome")}
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
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("mande.level.outcome")}</p>
                        <p className="text-sm text-neutral-800">
                          {outcome.code ? `${outcome.code} · ` : ""}{outcome.title}
                        </p>
                        {outcome.description && <p className="text-xs text-neutral-500">{outcome.description}</p>}
                      </div>
                      {canAdmin && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => startChild("output", outcome.id)}
                          >
                            {t("mande.planDetail.addOutput")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-xs text-red-600"
                            onClick={() => confirmDeleteNode("outcome", outcome.id, t("mande.planDetail.deleteOutcomeMessage"))}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      )}
                    </div>

                    {addingOutputFor === outcome.id && (
                      <NodeForm
                        label={t("mande.planDetail.newOutput")}
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
                              <span className="text-[10px] font-semibold uppercase text-neutral-400 mr-2">{t("mande.level.output")}</span>
                              {output.code ? `${output.code} · ` : ""}{output.title}
                            </span>
                            {canAdmin && (
                              <button
                                type="button"
                                className="btn-secondary text-xs text-red-600 shrink-0"
                                onClick={() => confirmDeleteNode("output", output.id, t("mande.planDetail.deleteOutputMessage"))}
                              >
                                {t("common.delete")}
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
              label={t("mande.planDetail.addGoal")}
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
