"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function BlockedAssignmentsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.blocked.title")}
      subtitle={t("assignments.blocked.subtitle")}
      queryKey="blocked"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "blocked" }}
      emptyTitle={t("assignments.blocked.empty")}
      emptyIcon="block"
    />
  );
}
