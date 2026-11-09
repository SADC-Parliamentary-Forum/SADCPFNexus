"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MyAdvanceHistoryPage() {
  const { t } = useI18n();
  return (
    <AdvanceQueueTable
      queue="history"
      title={t("salaryAdvances.history.title")}
      subtitle={t("salaryAdvances.history.subtitle")}
      showRequester={false}
      emptyHint={t("salaryAdvances.history.empty")}
    />
  );
}
