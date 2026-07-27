"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";

export default function TravelRetirementQueuePage() {
  return (
    <TravelQueueTable
      queue="retirement"
      variant="retirement"
      title="Travel Retirement"
      subtitle="Mission report required within 5 working days of return. Linked imprest remains optional in Phase 1."
      emptyHint="No travel retirements are pending right now."
    />
  );
}
