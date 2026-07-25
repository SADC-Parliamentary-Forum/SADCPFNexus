"use client";

import Link from "next/link";
import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

/**
 * Pending Principal/SG approval — SA finance-certified queue + link to Approvals inbox.
 */
export default function PendingApprovalPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
            <Link href="/salary-advances" className="hover:text-neutral-700">Salary Advances</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Pending Approval</span>
          </div>
          <h1 className="page-title">Pending Approval</h1>
          <p className="page-subtitle">Finance-certified advances awaiting Director / Secretary General decision.</p>
        </div>
        <Link href="/approvals" className="btn-secondary py-2 px-4 text-sm">Open Approvals inbox</Link>
      </div>

      <AdvanceQueueTable
        queue="pending_approval"
        title="Finance-certified — awaiting Principal / SG"
        subtitle="Applications certified by Finance and waiting on Director or Secretary General."
        showRequester
        emptyHint="No advances awaiting Principal/SG approval."
      />
    </div>
  );
}
