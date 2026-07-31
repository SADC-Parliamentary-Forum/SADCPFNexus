"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { procurementPlansApi } from "@/lib/api";

export default function PlanningPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "plans"],
    queryFn: () => procurementPlansApi.list().then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => procurementPlansApi.create({ plan_year: year, title }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["procurement", "plans"] });
    },
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <ModulePageHeader
        title="Annual Procurement Planning"
        subtitle="Plan year CRUD with line items for upcoming procurements."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Annual Procurement Planning" }]} />}
      />

      <div className="card p-4 grid gap-3 sm:grid-cols-[120px_1fr_auto] items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Year</label>
          <input type="number" className="form-input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Title</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="APP 2026" />
        </div>
        <button type="button" className="btn-primary" disabled={!title || createMut.isPending} onClick={() => createMut.mutate()}>
          Create plan
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <div key={String(p.id)} className="card p-4 flex justify-between">
              <div>
                <p className="text-sm font-semibold">{String(p.title)}</p>
                <p className="text-xs text-neutral-500">Year {String(p.plan_year)} · Items: {String(p.items_count ?? 0)}</p>
              </div>
              <span className="text-xs uppercase">{String(p.status)}</span>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="card p-8 text-center text-sm text-neutral-400">No plans yet.</div>}
        </div>
      )}
    </div>
  );
}
