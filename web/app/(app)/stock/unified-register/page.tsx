"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";

export default function UnifiedInventoryRegisterPage() {
  const query = useQuery({
    queryKey: ["inventory", "unified-register"],
    queryFn: () => inventoryApi.unifiedRegister({ per_page: 50 }).then((r) => r.data.data ?? []),
  });
  const rows = query.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Unified inventory register"
        subtitle="Linked fixed-asset and stock rows from GRN handoff (including split). This is not a merged accounting ledger."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock", href: "/stock" }, { label: "Unified register" }]} />}
      />
      <div className="card overflow-x-auto p-4">
        {query.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
        {query.isError && <p className="text-sm text-red-700">Failed to load unified register.</p>}
        {!query.isLoading && !query.isError && (
          <table className="min-w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">Stock item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{String(r.source ?? "—")}</td>
                  <td className="py-2 pr-3">{String(r.label ?? "—")}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.asset_id ? String(r.asset_id) : "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.stock_item_id ? String(r.stock_item_id) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-neutral-400">No linked register entries yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
