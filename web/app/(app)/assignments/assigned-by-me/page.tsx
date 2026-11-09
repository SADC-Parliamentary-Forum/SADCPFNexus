"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";
import { getStoredUser } from "@/lib/auth";

export default function AssignedByMePage() {
  const { t } = useI18n();
  const user = getStoredUser();
  return (
    <AssignmentFilteredList
      title={t("assignments.assignedByMe.title")}
      subtitle={t("assignments.assignedByMe.subtitle")}
      queryKey={`assigned-by-me-${user?.id ?? 0}`}
      fetcher={(p) => assignmentsApi.list(p)}
      fixedParams={user?.id ? { created_by: String(user.id) } : {}}
    />
  );
}
