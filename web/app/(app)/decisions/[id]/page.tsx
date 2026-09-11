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

const TYPE_LABEL: Record<string, string> = {
  resolution: "Resolution",
  management_decision: "Management decision",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  adopted: "Adopted",
  in_progress: "In progress",
  implemented: "Implemented",
  closed: "Closed",
  superseded: "Superseded",
};

export default function DecisionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
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
      setMsg(op === "action" ? "Action added." : "Updated.");
      if (op === "action") setActionDesc("");
      refresh();
    },
    onError: (e: unknown) => {
      setErr(apiErrorMessage(e, "Action failed."));
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
          title="Decision"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Decision Register", href: "/decisions" }, { label: "Not found" }]} />}
        />
        <div className="card overflow-hidden">
          <EmptyState icon="error" title="Decision not found" description="It may have been removed or you may not have access." />
        </div>
      </div>
    );
  }

  const minutesHref = data.minutes?.id ? `/governance/minutes/${data.minutes.id}` : null;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={data.title}
        subtitle={`${data.reference_number} · ${TYPE_LABEL[data.decision_type] ?? data.decision_type} · ${STATUS_LABEL[data.status] ?? data.status}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Governance", href: "/governance" },
              { label: "Decision Register", href: "/decisions" },
              { label: data.reference_number },
            ]}
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span>Owner: {data.owner?.name ?? "—"}</span>
            <span>Due: {data.due_date ? formatDateShort(data.due_date) : "—"}</span>
            {data.is_confidential ? <span className="text-amber-600 dark:text-amber-400">Confidential</span> : null}
          </div>
        }
      />

      {data.body ? (
        <FormSection title="Decision text" icon="description">
          <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{data.body}</p>
        </FormSection>
      ) : null}

      {data.minutes && minutesHref ? (
        <FormSection title="Linked minutes" icon="meeting_room">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <Link href={minutesHref} className="font-medium text-primary hover:underline">
              {data.minutes.title}
            </Link>
            {data.minutes.meeting_date ? ` (${formatDateShort(data.minutes.meeting_date)})` : ""}
          </p>
        </FormSection>
      ) : null}

      <FormSection title="Workflow" icon="account_tree" description="Advance the decision and add optional notes for the next step.">
        <div className="flex flex-wrap gap-2">
          {data.status === "draft" && (
            <button type="button" className="btn-primary" onClick={() => run.mutate("adopt")} disabled={run.isPending}>
              Adopt
            </button>
          )}
          {data.status === "adopted" && (
            <button type="button" className="btn-primary" onClick={() => run.mutate("start")} disabled={run.isPending}>
              Start progress
            </button>
          )}
          {(data.status === "adopted" || data.status === "in_progress") && (
            <>
              <button type="button" className="btn-secondary" onClick={() => run.mutate("implemented")} disabled={run.isPending}>
                Mark implemented
              </button>
              <button type="button" className="btn-secondary" onClick={() => run.mutate("assignment")} disabled={run.isPending}>
                Create assignment
              </button>
            </>
          )}
          {(data.status === "implemented" || data.status === "in_progress") && (
            <button type="button" className="btn-secondary" onClick={() => run.mutate("close")} disabled={run.isPending}>
              Close
            </button>
          )}
        </div>
        <FormField label="Workflow notes" htmlFor="decision-notes" className="mt-4 max-w-xl">
          <textarea
            id="decision-notes"
            className="form-input min-h-20 resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adoption / implementation / closure notes"
          />
        </FormField>
        {msg ? <p className="mt-2 text-sm text-green-700">{msg}</p> : null}
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      </FormSection>

      <FormSection title="Follow-up actions" icon="task_alt">
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
          {(data.actions ?? []).length === 0 ? <li className="text-sm text-neutral-500">No follow-up actions yet.</li> : null}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <FormField label="New action" htmlFor="decision-action-desc" className="min-w-[220px] flex-1">
            <input
              id="decision-action-desc"
              className="form-input"
              placeholder="New action description"
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
            />
          </FormField>
          <FormField label="Priority" htmlFor="decision-action-priority">
            <select
              id="decision-action-priority"
              className="form-input"
              value={actionPriority}
              onChange={(e) => setActionPriority(e.target.value as "medium" | "critical")}
            >
              <option value="medium">Medium</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>
          <button
            type="button"
            className="btn-secondary"
            disabled={!actionDesc.trim() || run.isPending}
            onClick={() => run.mutate("action")}
          >
            Add action
          </button>
        </div>
      </FormSection>

      <FormSection title="Audit history" icon="history">
        <ul className="space-y-1 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id} className="text-neutral-600">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{h.change_type}</span>
              {h.from_status || h.to_status ? ` (${h.from_status ?? "—"} → ${h.to_status ?? "—"})` : ""}
              {h.actor ? ` · ${h.actor.name}` : ""}
              {h.created_at ? ` · ${formatDateShort(h.created_at)}` : ""}
            </li>
          ))}
          {(history ?? []).length === 0 ? <li className="text-neutral-500">No history yet.</li> : null}
        </ul>
      </FormSection>
    </div>
  );
}
