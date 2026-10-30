"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ActionQueuePanel } from "@/components/workqueue/ActionQueuePanel";

export default function MyActionsPage() {
  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="Needs my action"
        subtitle="Approvals, returned requests, assignments and tasks currently waiting on you, across modules."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Needs my action" }]} />}
      />
      <ActionQueuePanel />
    </div>
  );
}
