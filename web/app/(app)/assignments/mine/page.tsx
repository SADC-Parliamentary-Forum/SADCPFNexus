"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function MyAssignmentsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.mine.title")}
      subtitle={t("assignments.mine.subtitle")}
      queryKey="mine"
      fetcher={(params) => assignmentsApi.mine(params)}
    />
  );
}
