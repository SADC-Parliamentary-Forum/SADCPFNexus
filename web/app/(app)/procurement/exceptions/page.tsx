"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { procurementWorkbenchApi } from "@/lib/api";

export default function ProcurementExceptionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "exceptions"],
    queryFn: () => procurementWorkbenchApi.exceptions().then((r) => r.data),
  });
  const approve = useMutation({
    mutationFn: (id: number) => procurementWorkbenchApi.approveException(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "exceptions"] }),
  });
  const rows = (data as { data?: Array<{ id: number; exception_type: string; reason: string; status: string }> })?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Procurement exception register"
        subtitle="Retrospective invoice-to-LPO, sole source, emergency, void and related controls."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Procurement", href: "/procurement" }, { label: "Exceptions" }]} />}
      />
      {isLoading && <p className="text-sm text-neutral-500">Loading exceptions…</p>}
      {isError && <p className="text-sm text-rose-700">Could not load the exception register.</p>}
      {!isLoading && rows.length === 0 && <p className="text-sm text-neutral-500">No exceptions recorded.</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{row.exception_type}</p>
              <p className="text-neutral-600">{row.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-neutral-500">{row.status}</span>
              {row.status === "requested" && (
                <button type="button" className="btn-primary text-xs" onClick={() => approve.mutate(row.id)}>Approve</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link href="/procurement" className="text-sm text-primary">Back to procurement</Link>
    </div>
  );
}
