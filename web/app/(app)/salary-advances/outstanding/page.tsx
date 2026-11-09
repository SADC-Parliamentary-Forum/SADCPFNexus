"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function OutstandingAdvancesPage() {
  const { t } = useI18n();
  return (
    <AdvanceQueueTable
      queue="outstanding"
      title={t("salaryAdvances.outstanding.title")}
      subtitle={t("salaryAdvances.outstanding.subtitle")}
      showRequester
      emptyHint={t("salaryAdvances.outstanding.empty")}
    />
  );
}
