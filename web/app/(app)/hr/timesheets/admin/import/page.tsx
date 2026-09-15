"use client";

import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { TimesheetImportWizard } from "@/components/timesheets/TimesheetImportWizard";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

export default function TimesheetAdminImportPage() {
  if (!canAccessRoute(getStoredUser(), "/hr/timesheets/admin/import")) {
    return (
      <ContentCanvas>
        <ModulePageHeader
          title="timesheet.import.adminTitle"
          subtitle="timesheet.import.denied"
          breadcrumbs={
            <PageBreadcrumbs
              items={[
                { label: "nav.timesheets", href: "/hr/timesheets" },
                { label: "timesheet.import.adminTitle" },
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
        title="timesheet.import.adminTitle"
        subtitle="timesheet.import.adminSubtitle"
        titleTestId="timesheet-admin-import-title"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "timesheet.import.adminTitle" },
            ]}
          />
        }
      />
      <TimesheetImportWizard variant="admin" />
    </ContentCanvas>
  );
}
