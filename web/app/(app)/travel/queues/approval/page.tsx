"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";

export default function TravelApprovalQueuePage() {
  return (
    <TravelQueueTable
      queue="approval"
      variant="approval"
      title="Pending My Approval"
      subtitle="Travel requisitions awaiting recommendation or approval."
      emptyHint="No travel requests are waiting for your recommendation or approval."
    />
  );
}
