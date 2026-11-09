"use client";

import { useParams } from "next/navigation";
import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Catalog keys for each queue's heading; translated where they render. */
const QUEUE_META: Record<string, { title: string; subtitle: string }> = {
  certify: {
    title: "salaryAdvances.queues.certify.title",
    subtitle: "salaryAdvances.queues.certify.subtitle",
  },
  payment: {
    title: "salaryAdvances.queues.payment.title",
    subtitle: "salaryAdvances.queues.payment.subtitle",
  },
  recovery: {
    title: "salaryAdvances.queues.recovery.title",
    subtitle: "salaryAdvances.queues.recovery.subtitle",
  },
};

export default function SalaryAdvanceQueuePage() {
  const { t } = useI18n();
  const params = useParams();
  const queue = String(params.queue ?? "certify");
  const meta = QUEUE_META[queue];
  const title = meta ? t(meta.title) : t("salaryAdvances.queues.fallback.title");
  const subtitle = meta ? t(meta.subtitle) : t("salaryAdvances.queues.fallback.subtitle", { queue });

  return (
    <AdvanceQueueTable
      queue={queue}
      title={title}
      subtitle={subtitle}
      showRequester
    />
  );
}
