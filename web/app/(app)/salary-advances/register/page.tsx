"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function SalaryAdvanceRegisterPage() {
  const { t } = useI18n();
  return (
    <AdvanceQueueTable
      queue="register"
      title={t("salaryAdvances.register.title")}
      subtitle={t("salaryAdvances.register.subtitle")}
      showRequester
      emptyHint={t("salaryAdvances.register.empty")}
    />
  );
}
