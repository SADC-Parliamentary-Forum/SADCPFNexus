"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function PendingAcceptancePage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.pending.title")}
      subtitle={t("assignments.pending.subtitle")}
      queryKey="awaiting_acceptance"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "awaiting_acceptance" }}
      emptyTitle={t("assignments.pending.empty")}
      emptyIcon="pending_actions"
    />
  );
}
