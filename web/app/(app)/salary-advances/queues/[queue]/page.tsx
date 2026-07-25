"use client";

import { useParams } from "next/navigation";
import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

const QUEUE_META: Record<string, { title: string; subtitle: string }> = {
  certify: {
    title: "Pending Finance Certification",
    subtitle: "Applications awaiting Finance Part B certification.",
  },
  payment: {
    title: "Approved for Payment",
    subtitle: "Advances ready for disbursement recording.",
  },
  recovery: {
    title: "Payroll Recovery Queue",
    subtitle: "Paid and scheduled advances awaiting recovery recording.",
  },
};

export default function SalaryAdvanceQueuePage() {
  const params = useParams();
  const queue = String(params.queue ?? "certify");
  const meta = QUEUE_META[queue] ?? {
    title: "Salary Advance Queue",
    subtitle: `Queue: ${queue}`,
  };

  return (
    <AdvanceQueueTable
      queue={queue}
      title={meta.title}
      subtitle={meta.subtitle}
      showRequester
    />
  );
}
