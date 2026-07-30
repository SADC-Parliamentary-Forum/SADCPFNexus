"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { programmeApi } from "@/lib/api";
import { PIF_STRATEGIC_PILLARS, DEPARTMENTS } from "@/lib/constants";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { unwrapEntity } from "@/lib/unwrapEntity";

const STRATEGIC_PILLARS = [...PIF_STRATEGIC_PILLARS] as string[];
const IMPLEMENTING_DEPARTMENTS = [...DEPARTMENTS] as string[];

// Minimal draft starter — full sections continue on /pif/[id]/edit.
export default function PifCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [strategicPillar, setStrategicPillar] = useState("");
  const [implementingDepartment, setImplementingDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Programme title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await programmeApi.create({
        title: title.trim(),
        strategic_pillar: strategicPillar || undefined,
        implementing_department: implementingDepartment || undefined,
      });
      const created = unwrapEntity<{ id?: number }>(res.data);
      const newId = created?.id ?? (res.data as { id?: number }).id;
      if (!newId) {
        throw new Error("Programme created but no id was returned.");
      }
      router.push(`/pif/${newId}/edit`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg =
        ax.response?.data?.message ??
        (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0]) ??
        (err instanceof Error ? err.message : null) ??
        "Failed to create programme. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ModulePageHeader
        title="Start a Programme Implementation Form"
        subtitle="Give the programme a title to create a draft. You will complete objectives, activities, budget, travel, procurement and documents on the next screen."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Programmes", href: "/pif" },
              { label: "New PIF" },
            ]}
          />
        }
      />

      <form onSubmit={handleCreate}>
        <FormSection
          title="Draft basics"
          description="Only a title is required to open the multi-step editor."
          icon="account_tree"
        >
          <div className="space-y-5">
            <FormField label="Programme title" required>
              <input
                className="form-input"
                placeholder="Short, descriptive title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Strategic pillar">
                <select
                  className="form-input"
                  value={strategicPillar}
                  onChange={(e) => setStrategicPillar(e.target.value)}
                >
                  <option value="">— Select later —</option>
                  {STRATEGIC_PILLARS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Implementing department">
                <select
                  className="form-input"
                  value={implementingDepartment}
                  onChange={(e) => setImplementingDepartment(e.target.value)}
                >
                  <option value="">— Select later —</option>
                  {IMPLEMENTING_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )}
                {submitting ? "Creating…" : "Create draft & continue"}
              </button>
              <Link href="/pif" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
