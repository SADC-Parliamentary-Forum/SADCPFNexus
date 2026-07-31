"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";

export default function RecurringAssignmentsPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assignments", "templates"],
    queryFn: async () => {
      const res = await assignmentsApi.list({ per_page: "100", templates_only: "true" });
      const body = res.data as { data?: Assignment[] };
      return body.data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: (id: number) => assignmentsApi.generateFromTemplate(id),
    onSuccess: () => {
      setMsg("Instance generated as a separate assignment.");
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <ModulePageHeader
        title="Recurring Tasks"
        subtitle="Templates generate separate assignment instances — never overwrite history."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Recurring Tasks" }]} />}
      />
        <Link href="/assignments/create" className="btn-primary">
          New Assignment
        </Link>
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}

      {(data ?? []).length === 0 && !isLoading && (
        <div className="card p-8 text-sm text-neutral-500 text-center">
          No recurring templates yet. Create via <code className="font-mono">POST /assignments/templates</code> or the API.
        </div>
      )}

      <div className="space-y-3">
        {(data ?? []).map((t) => (
          <div key={t.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="text-xs text-neutral-500 font-mono">{t.reference_number}</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => generate.mutate(t.id)}
              disabled={generate.isPending}
            >
              Generate instance
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
