"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

function getListData(payload: unknown): ProcurementRequest[] {
  if (Array.isArray(payload)) return payload as ProcurementRequest[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as ProcurementRequest[];
  }
  return [];
}

export default function ProcurementIntakePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "intake"],
    queryFn: () =>
      procurementApi.list({ has_programme: 1, per_page: 100 }).then((res) => getListData(res.data)),
    staleTime: 20_000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Procurement Intake</h1>
        <p className="page-subtitle">
          PIF-linked procurement packages transferred from approved programmes.
        </p>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load intake queue.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">inbox</span>
            <p className="text-sm font-semibold text-neutral-600">No PIF-linked requests yet</p>
            <p className="text-xs text-neutral-400 mt-2 max-w-md mx-auto">
              Use the Procurement tab on an approved programme to batch selected items into one request.
              One transfer creates one package; send a subset again if you need separate lots.
            </p>
            <Link href="/pif" className="btn-secondary inline-flex mt-4 text-sm">
              Browse Programmes
            </Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>PIF</th>
                <th>Status</th>
                <th>Value</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.reference_number}</td>
                  <td className="font-medium text-neutral-900 max-w-sm">
                    <span className="line-clamp-2">{row.title}</span>
                  </td>
                  <td className="text-xs">
                    {row.programme ? (
                      <Link href={`/pif/${row.programme.id}`} className="text-primary hover:underline font-mono">
                        {row.programme.reference_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className="badge badge-muted capitalize">{row.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="font-mono text-sm whitespace-nowrap">
                    {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                  </td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={`/procurement/${row.id}`} className="text-primary text-xs hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
