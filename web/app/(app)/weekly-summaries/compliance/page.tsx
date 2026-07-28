"use client";

import { useEffect, useState } from "react";
import { weeklyReportsApi } from "@/lib/api";

export default function WeeklyCompliancePage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void weeklyReportsApi.dashboard().then(({ data }) => setDashboard(data.data));
  }, []);

  const compliance = (dashboard?.compliance as Record<string, number> | undefined) ?? {};
  const missing = (dashboard?.missing_reports as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Weekly report compliance</h1>
      <p className="text-sm text-neutral-600">
        Submitted: {compliance.submitted ?? 0} · Exempted: {compliance.exempted ?? 0}
      </p>
      <h2 className="text-lg font-medium">Missing</h2>
      <ul className="space-y-1 text-sm">
        {missing.map((m) => (
          <li key={String(m.id)}>{String(m.name)}</li>
        ))}
        {missing.length === 0 && <li className="text-neutral-500">No missing reports in scope.</li>}
      </ul>
    </div>
  );
}
