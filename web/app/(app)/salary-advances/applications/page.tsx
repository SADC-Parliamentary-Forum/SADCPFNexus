"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

export default function MyApplicationsPage() {
  return (
    <AdvanceQueueTable
      queue="mine"
      title="My Applications"
      subtitle="Your salary advance applications (open and in progress)."
      showRequester={false}
      emptyHint="You have not created any salary advance applications yet."
    />
  );
}
