"use client";

import { TravelQueueTable } from "@/components/travel/TravelQueueTable";

export default function TravelAdminQueuePage() {
  return (
    <TravelQueueTable
      queue="admin"
      variant="admin"
      title="Administration / Logistics Queue"
      subtitle="Travel requests awaiting administration review and logistics preparation."
      emptyHint="No travel requests are awaiting administration or logistics action."
    />
  );
}
