"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TravelAdminQueuePage() {
  const { t } = useI18n();
  return (
    <TravelQueueTable
      queue="admin"
      variant="admin"
      title={t("travel.queues.admin.title")}
      subtitle={t("travel.queues.admin.subtitle")}
      emptyHint={t("travel.queues.admin.empty")}
    />
  );
}
