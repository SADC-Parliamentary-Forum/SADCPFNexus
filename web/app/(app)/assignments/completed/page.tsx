"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function CompletedAssignmentsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.completed.title")}
      subtitle={t("assignments.completed.subtitle")}
      queryKey="completed"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "completed,closed" }}
    />
  );
}
