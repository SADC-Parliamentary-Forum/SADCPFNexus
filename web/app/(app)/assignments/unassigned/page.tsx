"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function UnassignedPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.unassigned.title")}
      subtitle={t("assignments.unassigned.subtitle")}
      queryKey="unassigned"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ unassigned: "true" }}
    />
  );
}
