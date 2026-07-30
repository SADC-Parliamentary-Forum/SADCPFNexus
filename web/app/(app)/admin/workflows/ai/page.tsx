"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function WorkflowAiPage() {
  const { toast } = useToast();
  const [guards, setGuards] = useState<Record<string, boolean> | null>(null);
  const [kind, setKind] = useState("config_suggestion");
  const [suggestion, setSuggestion] = useState<any>(null);

  useEffect(() => {
    workflowEngineApi.aiGuards().then((res) => setGuards(res.data.data));
  }, []);

  const suggest = async () => {
    try {
      const res = await workflowEngineApi.aiSuggest({ kind, context: { query: "leave parallel certify" } });
      setSuggestion((res.data as any).data);
      toast("success", "Suggestion ready", "Human confirmation required before apply.");
    } catch {
      toast("error", "Suggest failed", "AI assist unavailable.");
    }
  };

  const applySafe = async () => {
    if (!suggestion?.id) return;
    try {
      await workflowEngineApi.aiApply(suggestion.id, {
        action: "attach_draft_note",
        confirmed: true,
        note: "Human-confirmed draft note only",
      });
      toast("success", "Applied", "Safe draft note attached — AI did not publish or approve.");
    } catch (e: any) {
      toast("error", "Apply blocked", e?.response?.data?.message || "Guard prevented unsafe action.");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <p className="text-sm text-[var(--muted)]">Workflow Engine · Phase 3</p>
      <h1 className="text-2xl font-semibold">AI configuration assist</h1>
      <p className="text-sm">Suggestions only. AI never publishes, approves, grants authority, skips stages, resolves SoD, signs, or accepts exceptions.</p>
      <Link href="/admin/workflows" className="text-sm underline inline-block">Back</Link>

      <pre className="border rounded p-3 text-xs">{JSON.stringify(guards, null, 2)}</pre>

      <div className="flex gap-2 flex-wrap">
        <select className="border rounded px-3 py-2 bg-transparent" value={kind} onChange={(e) => setKind(e.target.value)}>
          {["config_suggestion", "bottleneck_prediction", "approver_resolution_hint", "anomaly_detection", "policy_to_workflow_hint", "nl_workflow_search"].map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <button className="border rounded px-3 py-2" onClick={suggest}>Suggest</button>
        <button className="border rounded px-3 py-2" onClick={applySafe} disabled={!suggestion}>Apply draft note (confirm)</button>
      </div>

      {suggestion && (
        <pre className="border rounded p-3 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(suggestion, null, 2)}</pre>
      )}
    </div>
  );
}
