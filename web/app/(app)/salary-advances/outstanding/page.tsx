"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

export default function OutstandingAdvancesPage() {
  return (
    <AdvanceQueueTable
      queue="outstanding"
      title="Outstanding Advances"
      subtitle="Advances with a positive BCRE balance."
      showRequester
      emptyHint="No outstanding salary advance balances."
    />
  );
}
