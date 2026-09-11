"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { PEOPLE_SETTINGS_HUB_CARDS } from "@/lib/hubs/people";

export default function Page() {
  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="People Settings"
        subtitle="Phase 2/3 integrations are env-gated. Operator credential status lives under Admin → System Settings."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "People Settings" },
            ]}
          />
        }
      />
      <ModuleHubCards cards={PEOPLE_SETTINGS_HUB_CARDS} />
    </div>
  );
}
