"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleScenariosPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("Future structure draft");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "scenarios"],
    queryFn: async () => (await peopleAuthorityApi.listOrgScenarios()).data,
  });
  const create = useMutation({
    mutationFn: () => peopleAuthorityApi.createOrgScenario({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-authority", "scenarios"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 2</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Organisational scenario planning</h1>
          <p className="text-sm text-neutral-600 mt-1">Draft future org structure versions — not applied to live units.</p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="form-input max-w-md" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-primary text-sm px-4 py-2" disabled={create.isPending} onClick={() => create.mutate()}>
          Create draft scenario
        </button>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load scenarios.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
