"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TimesheetImportWizard } from "@/components/timesheets/TimesheetImportWizard";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

function TimesheetSelfImportBody() {
  const search = useSearchParams();
  const batchId = Number(search.get("batch") ?? "");
  if (!canAccessRoute(getStoredUser(), "/hr/timesheets/import")) {
    return (
      <ContentCanvas>
        <ModulePageHeader
          title="timesheet.import.title"
          subtitle="timesheet.import.denied"
          titleTestId="timesheet-import-title"
          breadcrumbs={
            <PageBreadcrumbs
              items={[
                { label: "nav.timesheets", href: "/hr/timesheets" },
                { label: "timesheet.import.title" },
              ]}
            />
          }
        />
      </ContentCanvas>
    );
  }

  return (
    <ContentCanvas>
      <ModulePageHeader
        title="timesheet.import.title"
        subtitle="timesheet.import.subtitle"
        titleTestId="timesheet-import-title"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "timesheet.import.title" },
            ]}
          />
        }
      />
      <TimesheetImportWizard variant="self" initialBatchId={Number.isFinite(batchId) && batchId > 0 ? batchId : undefined} />
    </ContentCanvas>
  );
}

export default function TimesheetSelfImportPage() {
  return (
    <Suspense>
      <TimesheetSelfImportBody />
    </Suspense>
  );
}
