"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TravelRetirementQueuePage() {
  const { t } = useI18n();
  return (
    <TravelQueueTable
      queue="retirement"
      variant="retirement"
      title={t("travel.queues.retirement.title")}
      subtitle={t("travel.queues.retirement.subtitle")}
      emptyHint={t("travel.queues.retirement.empty")}
    />
  );
}
