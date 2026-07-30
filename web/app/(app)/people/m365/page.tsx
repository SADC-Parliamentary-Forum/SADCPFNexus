"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleM365Page() {
  const qc = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "directory-sync"],
    queryFn: async () => (await peopleAuthorityApi.listDirectorySync()).data,
  });
  const run = useMutation({
    mutationFn: () => peopleAuthorityApi.runDirectorySync({ dry_run: dryRun, driver: "fixture" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-authority", "directory-sync"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 2</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Microsoft 365 / directory sync</h1>
          <p className="text-sm text-neutral-600 mt-1">Read-only people/org sync. Dry-run by default. Secrets stay in server env.</p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run
        </label>
        <button type="button" className="btn-primary text-sm px-4 py-2" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Running…" : "Run sync (fixture driver)"}
        </button>
      </div>
      {run.isError && <p className="text-sm text-red-600">Sync failed — check M365/fixture credentials on the server.</p>}

      {isLoading && <p className="text-sm text-neutral-500">Loading runs…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load sync runs.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
