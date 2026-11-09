"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TravelFinanceQueuePage() {
  const { t } = useI18n();
  return (
    <TravelQueueTable
      queue="finance"
      variant="finance"
      title={t("travel.queues.finance.title")}
      subtitle={t("travel.queues.finance.subtitle")}
      emptyHint={t("travel.queues.finance.empty")}
    />
  );
}
