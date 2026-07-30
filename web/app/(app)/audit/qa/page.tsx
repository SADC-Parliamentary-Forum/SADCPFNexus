"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditQaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "qa"],
    queryFn: async () => (await auditApi.listQaReviews({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [outcome, setOutcome] = useState("satisfactory");
  const [summary, setSummary] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createQaReview({
        review_type: "engagement_qa",
        outcome,
        findings_summary: summary || "QA peer review recorded",
      }),
    onSuccess: () => {
      setSummary("");
      qc.invalidateQueries({ queryKey: ["audit", "qa"] });
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">QA reviews</h1>
      <p className="text-sm text-neutral-600">
        Quality-assurance reviews are separate from supervisory workpaper review notes.
      </p>

      <div className="border rounded p-4 bg-white space-y-3 text-sm">
        <label className="block">
          Outcome
          <select className="mt-1 border rounded px-2 py-1 w-full" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="satisfactory">Satisfactory</option>
            <option value="needs_improvement">Needs improvement</option>
            <option value="unsatisfactory">Unsatisfactory</option>
          </select>
        </label>
        <label className="block">
          Summary
          <textarea className="mt-1 border rounded px-2 py-1 w-full" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <button type="button" className="px-3 py-1.5 bg-neutral-900 text-white rounded" onClick={() => create.mutate()} disabled={create.isPending}>
          Record QA review
        </button>
      </div>

      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">ID</th>
              <th className="p-2">Type</th>
              <th className="p-2">Outcome</th>
              <th className="p-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.id)}</td>
                <td className="p-2">{String(r.review_type)}</td>
                <td className="p-2">{String(r.outcome)}</td>
                <td className="p-2">{String(r.findings_summary ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
