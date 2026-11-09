"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TravelDirectorFinanceQueuePage() {
  const { t } = useI18n();
  return (
    <TravelQueueTable
      queue="director-finance"
      variant="director-finance"
      title={t("travel.queues.directorFinance.title")}
      subtitle={t("travel.queues.directorFinance.subtitle")}
      emptyHint={t("travel.queues.directorFinance.empty")}
    />
  );
}
