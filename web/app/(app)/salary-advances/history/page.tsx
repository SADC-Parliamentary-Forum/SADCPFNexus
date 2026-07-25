"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

export default function MyAdvanceHistoryPage() {
  return (
    <AdvanceQueueTable
      queue="history"
      title="My Advance History"
      subtitle="Closed, recovered, rejected, and withdrawn advances."
      showRequester={false}
      emptyHint="No historical advances yet."
    />
  );
}
