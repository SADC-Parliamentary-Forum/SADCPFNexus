"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

/**
 * Pending Principal/SG approval — SA finance-certified queue + link to Approvals inbox.
 */
export default function PendingApprovalPage() {
  return (
    <AdvanceQueueTable
      queue="pending_approval"
      title="Pending Approval"
      subtitle="Finance-certified advances awaiting Director / Secretary General decision."
      showRequester
      emptyHint="No advances awaiting Principal/SG approval."
    />
  );
}
