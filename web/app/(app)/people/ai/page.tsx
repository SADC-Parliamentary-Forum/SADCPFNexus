"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleAiPage() {
  const [kind, setKind] = useState("access_recommendation");
  const suggest = useMutation({
    mutationFn: () => peopleAuthorityApi.aiSuggest({ kind, context: {} }),
  });
  const apply = useMutation({
    mutationFn: (id: number) =>
      peopleAuthorityApi.aiApply(id, { action: "attach_note", confirmed: true, note: "Human confirmed note only" }),
  });

  const suggestionId = (suggest.data?.data as { data?: { id?: number } } | undefined)?.data?.id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 3</p>
          <h1 className="text-2xl font-semibold text-neutral-900">AI assist</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Suggestions only. Never auto-grants access, authority, delegation, signing rights, or privileged roles.
          </p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="form-input max-w-xs" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="access_recommendation">Access recommendation</option>
          <option value="anomalous_privilege">Anomalous privilege</option>
          <option value="nl_org_search">NL org search</option>
          <option value="succession_hint">Succession hint</option>
          <option value="skills_gap">Skills gap</option>
        </select>
        <button type="button" className="btn-primary text-sm px-4 py-2" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
          Request suggestion
        </button>
        {suggestionId ? (
          <button
            type="button"
            className="btn-secondary text-sm px-4 py-2"
            disabled={apply.isPending}
            onClick={() => apply.mutate(suggestionId)}
          >
            Confirm attach note
          </button>
        ) : null}
      </div>
      {suggest.data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[50vh]">
          {JSON.stringify(suggest.data.data, null, 2)}
        </pre>
      )}
      {apply.data && (
        <pre className="text-xs bg-emerald-50 border border-emerald-200 rounded p-4 overflow-auto max-h-[30vh]">
          {JSON.stringify(apply.data.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
