"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useQuery } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";

export default function BidSubmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "bid-submissions"],
    queryFn: () => tendersApi.bidSubmissions().then((r) => r.data.data),
  });

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title="Bid Submissions"
        subtitle="Sealed financials stay hidden until bid opening."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Bid Submissions" }]} />}
      />
      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                <th className="px-4 py-3">Tender</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row, i) => (
                <tr key={i} className="border-b border-neutral-50">
                  <td className="px-4 py-3">{String(row.tender_reference ?? "")}</td>
                  <td className="px-4 py-3">{String(row.vendor_name ?? "")}</td>
                  <td className="px-4 py-3">{String(row.version ?? "")}</td>
                  <td className="px-4 py-3">
                    {row.financials_sealed ? <span className="text-neutral-400 italic">Sealed</span> : String(row.quoted_amount ?? "—")}
                  </td>
                  <td className="px-4 py-3">{String(row.status ?? "")}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No bid submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
