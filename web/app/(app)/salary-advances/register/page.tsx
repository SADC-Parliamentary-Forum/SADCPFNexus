"use client";

import { AdvanceQueueTable } from "@/components/salary-advance/AdvanceQueueTable";

export default function SalaryAdvanceRegisterPage() {
  return (
    <AdvanceQueueTable
      queue="register"
      title="Salary Advance Register"
      subtitle="Full tenant register of salary advance applications."
      showRequester
      emptyHint="No salary advances recorded yet."
    />
  );
}
