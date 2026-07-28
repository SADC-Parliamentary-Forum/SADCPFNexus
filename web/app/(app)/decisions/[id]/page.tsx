"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decisionsApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { useState } from "react";

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
      const axiosErr = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errors = axiosErr.response?.data?.errors;
      const first = errors ? Object.values(errors).flat()[0] : null;
      setErr(first || axiosErr.response?.data?.message || "Action failed.");
    },
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Decision not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/decisions" className="text-sm text-neutral-500 hover:text-primary">← Decision Register</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-neutral-500">{data.reference_number}</p>
            <h1 className="text-2xl font-semibold">{data.title}</h1>
            <p className="mt-1 text-sm text-neutral-500 capitalize">{data.decision_type.replace("_", " ")} · {data.status.replace("_", " ")}</p>
          </div>
          <div className="text-sm text-neutral-600 space-y-1 text-right">
            <div>Owner: {data.owner?.name ?? "—"}</div>
            <div>Due: {data.due_date ? formatDateShort(data.due_date) : "—"}</div>
            {data.is_confidential && <div className="text-amber-600">Confidential</div>}
          </div>
        </div>
      </div>

      {data.body && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 whitespace-pre-wrap text-sm">
          {data.body}
        </div>
      )}

      {data.minutes && (
        <p className="text-sm text-neutral-600">
          Linked minutes: <span className="font-medium">{data.minutes.title}</span>
          {data.minutes.meeting_date ? ` (${formatDateShort(data.minutes.meeting_date)})` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {data.status === "draft" && (
          <button type="button" className="btn-primary" onClick={() => run.mutate("adopt")} disabled={run.isPending}>Adopt</button>
        )}
        {data.status === "adopted" && (
          <button type="button" className="btn-primary" onClick={() => run.mutate("start")} disabled={run.isPending}>Start progress</button>
        )}
        {(data.status === "adopted" || data.status === "in_progress") && (
          <>
            <button type="button" className="btn-secondary" onClick={() => run.mutate("implemented")} disabled={run.isPending}>Mark implemented</button>
            <button type="button" className="btn-secondary" onClick={() => run.mutate("assignment")} disabled={run.isPending}>Create assignment</button>
          </>
        )}
        {(data.status === "implemented" || data.status === "in_progress") && (
          <button type="button" className="btn-secondary" onClick={() => run.mutate("close")} disabled={run.isPending}>Close</button>
        )}
      </div>

      <label className="block space-y-1 max-w-xl">
        <span className="text-sm font-medium">Workflow notes</span>
        <textarea className="input w-full min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adoption / implementation / closure notes" />
      </label>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Follow-up actions</h2>
        <ul className="space-y-2">
          {(data.actions ?? []).map((a) => (
            <li key={a.id} className="rounded border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm flex justify-between gap-3">
              <div>
                <div className="font-medium">{a.description}</div>
                <div className="text-neutral-500 text-xs">{a.priority} · {a.status}{a.assignment ? ` · ${a.assignment.reference_number}` : ""}</div>
              </div>
              <div className="text-neutral-500 text-xs">{a.owner?.name ?? "—"}</div>
            </li>
          ))}
          {(data.actions ?? []).length === 0 && <li className="text-sm text-neutral-500">No follow-up actions yet.</li>}
        </ul>
        <div className="flex flex-wrap gap-2 items-end">
          <input className="input flex-1 min-w-[220px]" placeholder="New action description" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} />
          <select className="input" value={actionPriority} onChange={(e) => setActionPriority(e.target.value as "medium" | "critical")}>
            <option value="medium">Medium</option>
            <option value="critical">Critical</option>
          </select>
          <button type="button" className="btn-secondary" disabled={!actionDesc.trim() || run.isPending} onClick={() => run.mutate("action")}>
            Add action
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Audit history</h2>
        <ul className="space-y-1 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id} className="text-neutral-600">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{h.change_type}</span>
              {h.from_status || h.to_status ? ` (${h.from_status ?? "—"} → ${h.to_status ?? "—"})` : ""}
              {h.actor ? ` · ${h.actor.name}` : ""}
              {h.created_at ? ` · ${formatDateShort(h.created_at)}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
