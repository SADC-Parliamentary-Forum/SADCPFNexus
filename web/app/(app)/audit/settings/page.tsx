"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

function SettingsInner() {
  const params = useSearchParams();
  const stub = params.get("stub");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "settings"],
    queryFn: async () => (await auditApi.settings()).data.data,
  });

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Audit Settings / Charter</h1>
      {stub === "qa" && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 rounded">
          QA peer reviews are Phase 2 — stub only.
        </div>
      )}
      {stub === "ai" && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 rounded">
          AI assistance is Phase 3 and must not issue findings, verify, close, or blame — stub only.
        </div>
      )}
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

export default function AuditSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
