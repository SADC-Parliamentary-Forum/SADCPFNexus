"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function CorrespondenceReportsPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    correspondenceApi.reportSummary().then((res) => setSummary(res.data.data)).catch(() => setSummary({}));
  }, []);

  const cards = [
    { key: "incoming_pending_routing", label: "correspondence.reports.pendingRouting", href: "/correspondence/pending-routing" },
    { key: "incoming_in_progress", label: "correspondence.reports.incomingInProgress", href: "/correspondence/registry?direction=incoming" },
    { key: "outgoing_pending_approval", label: "correspondence.reports.pendingApproval", href: "/correspondence/registry?direction=outgoing&status=pending_approval" },
    { key: "ready_for_dispatch", label: "correspondence.reports.readyForDispatch", href: "/correspondence/registry?direction=outgoing" },
    { key: "overdue", label: "correspondence.reports.overdue", href: "/correspondence/my-actions" },
    { key: "my_open_actions", label: "correspondence.reports.myOpenActions", href: "/correspondence/my-actions" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("correspondence.reports.title")}
        subtitle={t("correspondence.reports.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.reports.title") }]} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="card p-5 hover:border-primary/40 transition-colors">
            <p className="text-xs text-neutral-500">{t(c.label)}</p>
            <p className="text-2xl font-bold text-neutral-900 mt-2">
              {summary ? summary[c.key] ?? 0 : "—"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
