"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MyApplicationsPage() {
  const { t } = useI18n();
  return (
    <AdvanceQueueTable
      queue="mine"
      title={t("salaryAdvances.applications.title")}
      subtitle={t("salaryAdvances.applications.subtitle")}
      showRequester={false}
      emptyHint={t("salaryAdvances.applications.empty")}
    />
  );
}
