"use client";

import { useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";

export default function AccessSimulatorPage() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await api.post<{ data: Record<string, unknown> }>(`/admin/access/users/${userId}/simulate`);
      setResult(res.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Access simulator"
        subtitle="Preview what a user can see and do. Does not create a live impersonation session."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Simulator" },
            ]}
          />
        }
      />

      <FormSection title="Simulate user" description="Enter a user ID to compute effective navigation and permissions." icon="science" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="User ID" htmlFor="sim-user" required className="w-40">
            <input
              id="sim-user"
              className="form-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={!userId || busy}>
            {busy ? "Running…" : "Simulate"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </FormSection>

      {result ? (
        <FormSection title="Simulation result" icon="terminal">
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </FormSection>
      ) : null}
    </div>
  );
}
