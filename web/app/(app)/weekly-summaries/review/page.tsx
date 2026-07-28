"use client";

import { useEffect, useState } from "react";
import { weeklyReportsApi } from "@/lib/api";

export default function WeeklySummariesReviewPage() {
  const [pending, setPending] = useState(0);
  const [missing, setMissing] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void weeklyReportsApi.dashboard().then(({ data }) => {
      setPending(Number(data.data.team_pending_review ?? 0));
      setMissing((data.data.missing_reports as Array<Record<string, unknown>>) ?? []);
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Team review</h1>
      <p className="text-sm text-neutral-600">Pending review: {pending}</p>
      <h2 className="text-lg font-medium">Missing reports</h2>
      <ul className="space-y-1 text-sm">
        {missing.map((m) => (
          <li key={String(m.id)}>{String(m.name)}</li>
        ))}
        {missing.length === 0 && <li className="text-neutral-500">None listed for your scope.</li>}
      </ul>
    </div>
  );
}
