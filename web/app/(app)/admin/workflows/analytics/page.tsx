"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";

export default function WorkflowAnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    workflowEngineApi.analytics().then((res) => setData(res.data.data)).catch(() => setData(null));
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <p className="text-sm text-[var(--muted)]">Workflow Engine · Phase 2</p>
      <h1 className="text-2xl font-semibold">Workflow analytics</h1>
      <p className="text-sm">Cycle time by stage, bottlenecks, overdue/return/reject rates, delegation usage, exceptions — not employee leaderboards.</p>
      <Link href="/admin/workflows" className="text-sm underline inline-block">Back</Link>
      <pre className="border rounded p-3 text-xs overflow-auto whitespace-pre-wrap">
        {data ? JSON.stringify(data, null, 2) : "Loading…"}
      </pre>
    </div>
  );
}
