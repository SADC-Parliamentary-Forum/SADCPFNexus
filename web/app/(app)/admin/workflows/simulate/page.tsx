"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi, type ApprovalWorkflow } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { useToast } from "@/components/ui/Toast";

export default function WorkflowSimulatePage() {
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<ApprovalWorkflow[]>([]);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [amount, setAmount] = useState("1000");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workflowEngineApi
      .definitions()
      .then((res) => setDefinitions(res.data.data || []))
      .catch(() => toast("error", "Could not load workflows"))
      .finally(() => setLoading(false));
  }, [toast]);

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
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="Workflow Simulation"
        subtitle="Dry-run a workflow definition against test context without creating production approvals."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Workflows", href: "/admin/workflows" },
              { label: "Simulation" },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            Back to workflows
          </Link>
        }
      />

      <FormSection title="Test context" description="Select a workflow and enter the sample amount." icon="science" dense>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_auto] sm:items-end">
          <FormField label="Workflow" htmlFor="workflow-id" required>
            <select
              id="workflow-id"
              className="form-input"
              value={workflowId ?? ""}
              onChange={(e) => setWorkflowId(Number(e.target.value) || null)}
              disabled={loading}
            >
              <option value="">{loading ? "Loading workflows..." : "Select workflow..."}</option>
              {definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount" htmlFor="test-amount" required>
            <input
              id="test-amount"
              className="form-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Test amount"
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={!workflowId}>
            Simulate
          </button>
        </div>
      </FormSection>

      {result ? (
        <FormSection title="Simulation result" icon="rule">
          <ObjectSummary value={result} />
        </FormSection>
      ) : null}
    </div>
  );
}
