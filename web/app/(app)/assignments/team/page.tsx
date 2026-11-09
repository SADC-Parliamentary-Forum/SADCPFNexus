"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function TeamAssignmentsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.team.title")}
      subtitle={t("assignments.team.subtitle")}
      queryKey="team"
      fetcher={(params) => assignmentsApi.team(params)}
    />
  );
}
