"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function RegisterPage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.register.title")}
      subtitle={t("assignments.register.subtitle")}
      queryKey="register"
      fetcher={(params) => assignmentsApi.register(params)}
    />
  );
}
