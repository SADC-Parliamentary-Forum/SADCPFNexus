"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi } from "@/lib/api";

export default function CorrespondenceReportsPage() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    correspondenceApi.reportSummary().then((res) => setSummary(res.data.data)).catch(() => setSummary({}));
  }, []);

  const cards = [
    { key: "incoming_pending_routing", label: "Pending SG routing", href: "/correspondence/pending-routing" },
    { key: "incoming_in_progress", label: "Incoming in progress", href: "/correspondence/registry?direction=incoming" },
    { key: "outgoing_pending_approval", label: "Pending approval", href: "/correspondence/registry?direction=outgoing&status=pending_approval" },
    { key: "ready_for_dispatch", label: "Ready for dispatch", href: "/correspondence/registry?direction=outgoing" },
    { key: "overdue", label: "Overdue responses", href: "/correspondence/my-actions" },
    { key: "my_open_actions", label: "My open actions", href: "/correspondence/my-actions" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Correspondence Reports"
        subtitle="Operational summary for the register (access-scoped)."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Correspondence Reports" }]} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="card p-5 hover:border-primary/40 transition-colors">
            <p className="text-xs text-neutral-500">{c.label}</p>
            <p className="text-2xl font-bold text-neutral-900 mt-2">
              {summary ? summary[c.key] ?? 0 : "—"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
