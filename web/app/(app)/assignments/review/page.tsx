"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function ReviewQueuePage() {
  const { t } = useI18n();
  return (
    <AssignmentFilteredList
      title={t("assignments.review.title")}
      subtitle={t("assignments.review.subtitle")}
      queryKey="review"
      fetcher={(params) => assignmentsApi.reviewQueue(params)}
    />
  );
}
