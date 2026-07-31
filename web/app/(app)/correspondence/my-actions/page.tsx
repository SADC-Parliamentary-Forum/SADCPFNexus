"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";

export default function MyCorrespondenceActionsPage() {
  const [items, setItems] = useState<CorrespondenceLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    correspondenceApi
      .myActions({ per_page: 50 })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="My Action Items"
        subtitle="Correspondence where you are the primary or supporting action owner."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "My Action Items" }]} />}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">No open action items.</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/correspondence/${item.id}`} className="text-primary hover:underline">
                    {item.registry_reference || item.reference_number || `#${item.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3"><span className="badge-muted">{item.status}</span></td>
                <td className="px-4 py-3 text-neutral-500">{item.final_deadline || item.internal_deadline || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
