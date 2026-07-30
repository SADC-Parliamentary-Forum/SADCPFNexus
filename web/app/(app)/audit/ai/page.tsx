"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditAiAssistPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("duplicate_findings");
  const [last, setLast] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");

  const suggest = useMutation({
    mutationFn: async () => (await auditApi.aiSuggest({ kind })).data.data as Record<string, unknown>,
    onSuccess: (row) => setLast(row),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!last?.id) throw new Error("No suggestion");
      return (await auditApi.aiApply(Number(last.id), {
        action: "attach_note",
        confirmed: true,
        note: note || "Human-confirmed AI suggestion note",
      })).data.data;
    },
    onSuccess: (row) => {
      setLast(row as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">AI assist</h1>
      <div className="border border-amber-300 bg-amber-50 text-amber-950 text-sm p-3 rounded space-y-1">
        <p>Suggestions only. Human confirmation is required before apply.</p>
        <p>AI must never issue findings, assign blame, approve management responses, close findings, verify implementation, determine misconduct, or modify final conclusions.</p>
      </div>

      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <label className="block">
          Suggestion kind
          <select className="mt-1 border rounded px-2 py-1 w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="workpaper_summary">Workpaper summary</option>
            <option value="duplicate_findings">Duplicate findings</option>
            <option value="root_cause">Root-cause suggestions</option>
            <option value="draft_report">Draft report assistance</option>
            <option value="evidence_index">Evidence indexing hints</option>
            <option value="nl_search">NL search suggestions</option>
          </select>
        </label>
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
          Generate suggestion
        </button>
      </div>

      {last && (
        <div className="border rounded p-4 bg-white space-y-3 text-sm">
          <div>Status: <strong>{String(last.status)}</strong> · Provider: {String(last.provider)}</div>
          <pre className="text-xs bg-neutral-50 p-3 rounded overflow-auto max-h-64">{JSON.stringify(last.suggestion, null, 2)}</pre>
          {last.status === "pending_confirmation" && (
            <>
              <label className="block">
                Confirmation note
                <input className="mt-1 border rounded px-2 py-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="button" className="px-3 py-1.5 border border-neutral-900 rounded" onClick={() => apply.mutate()} disabled={apply.isPending}>
                Confirm &amp; attach note only
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
