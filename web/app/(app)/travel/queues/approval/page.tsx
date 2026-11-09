"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TravelApprovalQueuePage() {
  const { t } = useI18n();
  return (
    <TravelQueueTable
      queue="approval"
      variant="approval"
      title={t("travel.queues.approval.title")}
      subtitle={t("travel.queues.approval.subtitle")}
      emptyHint={t("travel.queues.approval.empty")}
    />
  );
}
