"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";

export default function TravelDirectorFinanceQueuePage() {
  return (
    <TravelQueueTable
      queue="director-finance"
      variant="director-finance"
      title="Director Finance Queue"
      subtitle="Confirm funds availability after Finance DSA calculation."
      emptyHint="No items are awaiting Director Finance confirmation."
    />
  );
}
