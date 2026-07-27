"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";

export default function TravelFinanceQueuePage() {
  return (
    <TravelQueueTable
      queue="finance"
      variant="finance"
      title="Finance Review Queue (DSA)"
      subtitle="Finance Controller calculates authoritative DSA (Rate Types 1/2/3). Traveller estimates are not authoritative."
      emptyHint="No travel requests are awaiting Finance DSA calculation."
    />
  );
}
