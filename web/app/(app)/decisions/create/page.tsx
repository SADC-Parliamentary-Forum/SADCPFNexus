"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decisionsApi } from "@/lib/api";

export default function CreateDecisionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [decisionType, setDecisionType] = useState<"resolution" | "management_decision">("resolution");
  const [dueDate, setDueDate] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await decisionsApi.create({
        title,
        body: body || null,
        decision_type: decisionType,
        due_date: dueDate || null,
        is_confidential: confidential,
      });
      router.push(`/decisions/${res.data.data.id}`);
    } catch {
      setError("Could not create the decision. Check required fields and try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/decisions" className="text-sm text-neutral-500 hover:text-primary">← Decision Register</Link>
        <h1 className="mt-2 text-2xl font-semibold">New decision</h1>
        <p className="text-sm text-neutral-500">Capture a meeting resolution or management decision as a draft.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Type</span>
          <select className="input w-full" value={decisionType} onChange={(e) => setDecisionType(e.target.value as typeof decisionType)}>
            <option value="resolution">Resolution</option>
            <option value="management_decision">Management decision</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input className="input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Decision text</span>
          <textarea className="input w-full min-h-32" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Due date</span>
          <input type="date" className="input w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
          Mark confidential
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Create draft"}</button>
          <Link href="/decisions" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
