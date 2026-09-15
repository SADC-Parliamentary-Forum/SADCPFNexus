"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { timesheetImportApi, type TimesheetImportBatch } from "@/lib/api";
import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/ui/ListPagination";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

export default function TimesheetImportHistoryPage() {
  const { t } = useI18n();
  const [batches, setBatches] = useState<TimesheetImportBatch[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    timesheetImportApi.list({ page, per_page: 20 })
      .then((res) => {
        setBatches(res.data.data ?? []);
        setLastPage(res.data.meta?.last_page ?? 1);
      })
      .catch(() => setError(t("common.error")));
  }, [page, t]);

  if (!canAccessRoute(getStoredUser(), "/hr/timesheets/import")) {
    return (
      <ContentCanvas>
        <ModulePageHeader title="timesheet.import.historyTitle" subtitle="timesheet.import.denied" />
      </ContentCanvas>
    );
  }

  return (
    <ContentCanvas>
      <ModulePageHeader
        title="timesheet.import.historyTitle"
        subtitle="timesheet.import.historySubtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "timesheet.import.title", href: "/hr/timesheets/import" },
              { label: "timesheet.import.historyTitle" },
            ]}
          />
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {batches.length === 0 ? (
        <EmptyState
          icon="history"
          title="timesheet.import.emptyHistory"
          description="timesheet.import.emptyHistoryHint"
          action={
            <Link href="/hr/timesheets/import" className="btn-primary text-sm">
              {t("timesheet.import.cta")}
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>{t("timesheet.import.file")}</th>
                <th>{t("timesheet.import.colStatus")}</th>
                <th>{t("timesheet.import.counts.valid")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link href={`/hr/timesheets/import?batch=${batch.id}`} className="text-primary">
                      {batch.reference}
                    </Link>
                  </td>
                  <td>{batch.filename}</td>
                  <td>{batch.status}</td>
                  <td>{batch.valid_rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPagination page={page} lastPage={lastPage} onPageChange={setPage} />
        </div>
      )}
    </ContentCanvas>
  );
}
