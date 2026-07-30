"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi, type ApprovalWorkflow } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function WorkflowSimulatePage() {
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<ApprovalWorkflow[]>([]);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [amount, setAmount] = useState("1000");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    workflowEngineApi.definitions().then((res) => setDefinitions(res.data.data || []));
  }, []);

  const run = async () => {
    if (!workflowId) return;
    try {
      const res = await workflowEngineApi.simulate(workflowId, {
        test_context: { amount: Number(amount), currency: "NAD" },
      });
      setResult(res.data);
      toast("success", "Simulation complete", "No production approvals were created.");
    } catch {
      toast("error", "Simulation failed", "Could not simulate definition.");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <p className="text-sm text-[var(--muted)]">Workflow Engine · Phase 2</p>
      <h1 className="text-2xl font-semibold">Workflow simulation</h1>
      <p className="text-sm">Dry-run a definition against test context. Shows stages, actors, conditions, deadlines — never creates production approvals.</p>
      <Link href="/admin/workflows" className="text-sm underline inline-block">Back</Link>
      <div className="flex flex-wrap gap-2">
        <select className="border rounded px-3 py-2 bg-transparent" value={workflowId ?? ""} onChange={(e) => setWorkflowId(Number(e.target.value) || null)}>
          <option value="">Select workflow…</option>
          {definitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="border rounded px-3 py-2 bg-transparent" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Test amount" />
        <button className="border rounded px-3 py-2" onClick={run}>Simulate</button>
      </div>
      {result && (
        <pre className="border rounded p-3 text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
