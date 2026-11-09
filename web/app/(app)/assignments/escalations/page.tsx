"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function EscalationsPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.escalations.title")}
      subtitle={t("assignments.escalations.subtitle")}
      queryKey="escalations"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ escalated: "true" }}
    />
  );
}
