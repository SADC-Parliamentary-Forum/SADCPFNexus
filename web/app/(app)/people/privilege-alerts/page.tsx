"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeoplePrivilegeAlertsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "privilege-alerts"],
    queryFn: async () => (await peopleAuthorityApi.listPrivilegeAlerts()).data,
  });
  const detect = useMutation({
    mutationFn: () => peopleAuthorityApi.detectPrivilegeAlerts(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-authority", "privilege-alerts"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 3</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Anomalous privilege detection</h1>
          <p className="text-sm text-neutral-600 mt-1">Alerts and suggestions only — never auto-revoke or auto-grant.</p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      <button type="button" className="btn-primary text-sm px-4 py-2" disabled={detect.isPending} onClick={() => detect.mutate()}>
        {detect.isPending ? "Detecting…" : "Run detection"}
      </button>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load alerts.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
