"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "settings"],
    queryFn: async () => (await auditApi.settings()).data.data,
  });
  const configured = Boolean((data as { charter_configured?: boolean } | undefined)?.charter_configured);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("sg");

  const save = useMutation({
    mutationFn: () =>
      auditApi.updateSettings({
        charter_configured: true,
        charter_notes: notes || String((data as { charter_notes?: string })?.charter_notes ?? ""),
        plan_approval_mode: mode || String((data as { plan_approval_mode?: string })?.plan_approval_mode ?? "sg"),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", "settings"] }),
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
        <div className="border rounded p-4 bg-white space-y-3 text-sm">
          {configured ? (
            <div className="font-medium text-emerald-800">Audit Charter configured</div>
          ) : (
            <div className="font-medium text-amber-800">Governance Configuration Pending</div>
          )}
          <p>
            {configured
              ? "The charter record for this tenant is stored. Operator sign-off evidence remains outside this product."
              : "Audit Charter is not yet configured for this tenant."}
          </p>
          <p>Plan approval mode: <strong>{String((data as { plan_approval_mode?: string })?.plan_approval_mode ?? "sg")}</strong></p>
          <p className="text-neutral-600">
            {(data as { charter_notes?: string })?.charter_notes
              ?? "Governance Configuration Pending — Audit Charter not yet configured."}
          </p>
          <label className="block text-xs text-neutral-600">
            Plan approval mode
            <select className="form-input mt-1" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="sg">sg</option>
              <option value="governance">governance</option>
              <option value="configurable">configurable</option>
            </select>
          </label>
          <label className="block text-xs text-neutral-600">
            Charter notes
            <textarea className="form-input mt-1 w-full" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="button" className="btn-primary text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Record charter configured"}
          </button>
        </div>
      )}
    </div>
  );
}
