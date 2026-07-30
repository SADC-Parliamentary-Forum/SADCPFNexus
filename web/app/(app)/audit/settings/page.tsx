"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "settings"],
    queryFn: async () => (await auditApi.settings()).data.data,
  });

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Audit Settings / Charter</h1>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/audit/qa">QA reviews</Link>
        <Link className="underline" href="/audit/ai">AI assist</Link>
        <Link className="underline" href="/audit/templates">Donor templates</Link>
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="border rounded p-4 bg-white space-y-2 text-sm">
          <div className="font-medium text-amber-800">Governance Configuration Pending</div>
          <p>Audit Charter is not yet configured for this tenant.</p>
          <p>Plan approval mode: <strong>{String((data as { plan_approval_mode?: string })?.plan_approval_mode ?? "sg")}</strong></p>
          <p className="text-neutral-600">
            {(data as { charter_notes?: string })?.charter_notes
              ?? "Governance Configuration Pending — Audit Charter not yet configured."}
          </p>
        </div>
      )}
    </div>
  );
}
