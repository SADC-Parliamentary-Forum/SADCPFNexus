"use client";

import { useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";

export default function PermissionExplorerPage() {
  const [permission, setPermission] = useState("leave.request.authorise.assigned");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.get<{ data: Record<string, unknown> }>("/admin/access/explore", {
        params: { permission },
      });
      setResult(res.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Explore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Permission explorer"
        subtitle="Which roles contain a permission, and who holds direct grants or denials."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Explorer" },
            ]}
          />
        }
      />

      <FormSection title="Explore permission" icon="manage_search" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Permission key" htmlFor="perm-key" required className="min-w-[280px] flex-1">
            <input
              id="perm-key"
              className="form-input"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={busy || !permission}>
            {busy ? "Exploring…" : "Explore"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </FormSection>

      {result ? (
        <FormSection title="Explorer result" icon="terminal">
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </FormSection>
      ) : null}
    </div>
  );
}
