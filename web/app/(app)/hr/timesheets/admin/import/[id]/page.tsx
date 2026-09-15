"use client";

import { useParams } from "next/navigation";
import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TimesheetImportWizard } from "@/components/timesheets/TimesheetImportWizard";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

export default function TimesheetAdminImportDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  if (!canAccessRoute(getStoredUser(), "/hr/timesheets/admin/import")) {
    return (
      <ContentCanvas>
        <ModulePageHeader title="timesheet.import.adminTitle" subtitle="timesheet.import.denied" />
      </ContentCanvas>
    );
  }

  return (
    <ContentCanvas>
      <ModulePageHeader
        title="timesheet.import.adminTitle"
        subtitle="timesheet.import.adminSubtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "timesheet.import.adminTitle", href: "/hr/timesheets/admin/import" },
              { label: Number.isNaN(id) ? "…" : String(id) },
            ]}
          />
        }
      />
      {!Number.isNaN(id) ? <TimesheetImportWizard variant="admin" initialBatchId={id} /> : null}
    </ContentCanvas>
  );
}
