"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decisionsApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const TYPE_LABEL: Record<string, string> = {
  resolution: "decisions.type.resolution",
  management_decision: "decisions.type.management_decision",
};

const OP_LABEL: Record<string, { success: string; error: string }> = {
  adopt: { success: "decisions.detail.op.adopted", error: "decisions.detail.op.adoptFailed" },
  start: { success: "decisions.detail.op.started", error: "decisions.detail.op.startFailed" },
  implemented: { success: "decisions.detail.op.implemented", error: "decisions.detail.op.implementedFailed" },
  close: { success: "decisions.detail.op.closed", error: "decisions.detail.op.closeFailed" },
  assignment: { success: "decisions.detail.op.assignmentCreated", error: "decisions.detail.op.assignmentFailed" },
  action: { success: "decisions.detail.op.actionAdded", error: "decisions.detail.op.actionFailed" },
};

const STATUS_LABEL: Record<string, string> = {
  draft: "decisions.status.draft",
  adopted: "decisions.status.adopted",
  in_progress: "decisions.status.inProgress",
  implemented: "decisions.status.implemented",
  closed: "decisions.status.closed",
  superseded: "decisions.status.superseded",
};

export default function DecisionDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const toast = useToast();
  const [actionDesc, setActionDesc] = useState("");
  const [actionPriority, setActionPriority] = useState<"medium" | "critical">("medium");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", id],
    queryFn: async () => (await decisionsApi.get(id)).data.data,
    enabled: Number.isFinite(id),
  });

  const { data: history } = useQuery({
    queryKey: ["decisions", id, "history"],
    queryFn: async () => (await decisionsApi.history(id)).data.data,
    enabled: Number.isFinite(id),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["decisions", id] });
    qc.invalidateQueries({ queryKey: ["decisions", id, "history"] });
    qc.invalidateQueries({ queryKey: ["decisions", "list"] });
  }

  const run = useMutation({
    mutationFn: async (op: string) => {
      setErr(null);
      setMsg(null);
      if (op === "adopt") return decisionsApi.adopt(id, { adoption_notes: notes || undefined });
      if (op === "start") return decisionsApi.startProgress(id);
      if (op === "implemented") return decisionsApi.markImplemented(id, { notes: notes || undefined });
      if (op === "close") return decisionsApi.close(id, { closure_notes: notes || undefined });
      if (op === "assignment") return decisionsApi.createAssignment(id, {});
      if (op === "action") {
        return decisionsApi.addAction(id, {
          description: actionDesc,
          priority: actionPriority,
          create_assignment: false,
        });
      }
      throw new Error("Unknown op");
    },
    onSuccess: (_res, op) => {
      setMsg(op === "action" ? t("decisions.detail.actionAddedMsg") : t("decisions.detail.updatedMsg"));
      if (op === "action") setActionDesc("");
      toast.success(t(OP_LABEL[op]?.success ?? "decisions.detail.op.updated"));
      refresh();
    },
    onError: (e: unknown, op) => {
      const message = apiErrorMessage(e, t("decisions.detail.actionFailedMsg"));
      setErr(message);
      toast.error(t(OP_LABEL[op]?.error ?? "decisions.detail.op.updateFailed"), message);
    },
  });

  if (isLoading) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full min-w-0 space-y-5">
        <ModulePageHeader
          title="decisions.detail.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "decisions.register.title", href: "/decisions" }, { label: "decisions.detail.notFoundCrumb" }]} />}
        />
        <div className="card overflow-hidden">
          <EmptyState icon="error" title="decisions.detail.notFound" description="decisions.detail.notFoundHint" />
        </div>
      </div>
    );
  }

  const minutesHref = data.minutes?.id ? `/governance/minutes/${data.minutes.id}` : null;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={data.title}
        subtitle={`${data.reference_number} · ${TYPE_LABEL[data.decision_type] ? t(TYPE_LABEL[data.decision_type]) : data.decision_type} · ${STATUS_LABEL[data.status] ? t(STATUS_LABEL[data.status]) : data.status}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "decisions.crumb.governance", href: "/governance" },
              { label: "decisions.register.title", href: "/decisions" },
              { label: data.reference_number },
            ]}
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span>{t("decisions.detail.owner", { name: data.owner?.name ?? "—" })}</span>
            <span>{t("decisions.detail.due", { date: data.due_date ? formatDateShort(data.due_date) : "—" })}</span>
            {data.is_confidential ? <span className="text-amber-600 dark:text-amber-400">{t("decisions.confidential")}</span> : null}
          </div>
        }
      />

      {data.body ? (
        <FormSection title="decisions.detail.text" icon="description">
          <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{data.body}</p>
        </FormSection>
      ) : null}

      {data.minutes && minutesHref ? (
        <FormSection title="decisions.detail.linkedMinutes" icon="meeting_room">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <Link href={minutesHref} className="font-medium text-primary">
              {data.minutes.title}
            </Link>
            {data.minutes.meeting_date ? ` (${formatDateShort(data.minutes.meeting_date)})` : ""}
          </p>
        </FormSection>
      ) : null}

      <FormSection title="decisions.detail.workflow" icon="account_tree" description="decisions.detail.workflowHint">
        <div className="flex flex-wrap gap-2">
          {data.status === "draft" && (
            <button type="button" className="btn-primary" onClick={() => run.mutate("adopt")} disabled={run.isPending}>
              {t("decisions.detail.adopt")}
            </button>
          )}
          {data.status === "adopted" && (
            <button type="button" className="btn-primary" onClick={() => run.mutate("start")} disabled={run.isPending}>
              {t("decisions.detail.startProgress")}
            </button>
          )}
          {(data.status === "adopted" || data.status === "in_progress") && (
            <>
              <button type="button" className="btn-secondary" onClick={() => run.mutate("implemented")} disabled={run.isPending}>
                {t("decisions.detail.markImplemented")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => run.mutate("assignment")} disabled={run.isPending}>
                {t("decisions.detail.createAssignment")}
              </button>
            </>
          )}
          {(data.status === "implemented" || data.status === "in_progress") && (
            <button type="button" className="btn-secondary" onClick={() => run.mutate("close")} disabled={run.isPending}>
              {t("common.close")}
            </button>
          )}
        </div>
        <FormField label="decisions.detail.notes" htmlFor="decision-notes" className="mt-4 max-w-xl">
          <textarea
            id="decision-notes"
            className="form-input min-h-20 resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("decisions.detail.notesPlaceholder")}
          />
        </FormField>
        {msg ? <p className="mt-2 text-sm text-green-700">{msg}</p> : null}
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      </FormSection>

      <FormSection title="decisions.detail.followUp" icon="task_alt">
        <ul className="space-y-2">
          {(data.actions ?? []).map((a) => (
            <li key={a.id} className="flex justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
              <div>
                <div className="font-medium">{a.description}</div>
                <div className="text-xs text-neutral-500">
                  {a.priority} · {a.status}
                  {a.assignment ? ` · ${a.assignment.reference_number}` : ""}
                </div>
              </div>
              <div className="text-xs text-neutral-500">{a.owner?.name ?? "—"}</div>
            </li>
          ))}
          {(data.actions ?? []).length === 0 ? <li className="text-sm text-neutral-500">{t("decisions.detail.noActions")}</li> : null}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <FormField label="decisions.detail.newAction" htmlFor="decision-action-desc" className="min-w-[220px] flex-1">
            <input
              id="decision-action-desc"
              className="form-input"
              placeholder={t("decisions.detail.newActionPlaceholder")}
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
            />
          </FormField>
          <FormField label="decisions.detail.priority" htmlFor="decision-action-priority">
            <select
              id="decision-action-priority"
              className="form-input"
              value={actionPriority}
              onChange={(e) => setActionPriority(e.target.value as "medium" | "critical")}
            >
              <option value="medium">{t("decisions.detail.priorityMedium")}</option>
              <option value="critical">{t("decisions.detail.priorityCritical")}</option>
            </select>
          </FormField>
          <button
            type="button"
            className="btn-secondary"
            disabled={!actionDesc.trim() || run.isPending}
            onClick={() => run.mutate("action")}
          >
            {t("decisions.detail.addAction")}
          </button>
        </div>
      </FormSection>

      <FormSection title="decisions.detail.history" icon="history">
        <ul className="space-y-1 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id} className="text-neutral-600">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{h.change_type}</span>
              {h.from_status || h.to_status ? ` (${h.from_status ?? "—"} → ${h.to_status ?? "—"})` : ""}
              {h.actor ? ` · ${h.actor.name}` : ""}
              {h.created_at ? ` · ${formatDateShort(h.created_at)}` : ""}
            </li>
          ))}
          {(history ?? []).length === 0 ? <li className="text-neutral-500">{t("decisions.detail.noHistory")}</li> : null}
        </ul>
      </FormSection>
    </div>
  );
}
