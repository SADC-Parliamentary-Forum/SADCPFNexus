"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/**
 * Pending Principal/SG approval — SA finance-certified queue + link to Approvals inbox.
 */
export default function PendingApprovalPage() {
  const { t } = useI18n();
  return (
    <AdvanceQueueTable
      queue="pending_approval"
      title={t("salaryAdvances.pendingApproval.title")}
      subtitle={t("salaryAdvances.pendingApproval.subtitle")}
      showRequester
      emptyHint={t("salaryAdvances.pendingApproval.empty")}
    />
  );
}
