"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function OverdueAssignmentsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.overdue.title")}
      subtitle={t("assignments.overdue.subtitle")}
      queryKey="overdue"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ overdue: "true" }}
      emptyTitle={t("assignments.overdue.empty")}
      emptyIcon="event_busy"
    />
  );
}
