"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

function apiError(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const first = Object.values(ax.response?.data?.errors ?? {})[0]?.[0];
  return first || ax.response?.data?.message || fallback;
}

export default function AuditFindingDetailPage() {
  const params = useParams<{ id: string }>();
  const findingId = Number(params.id);
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const [responseText, setResponseText] = useState("");
  const [agrees, setAgrees] = useState(true);
  const [caTitle, setCaTitle] = useState("");
  const [caDue, setCaDue] = useState("");

  const findingQuery = useQuery({
    queryKey: ["audit", "finding", findingId],
    queryFn: async () => (await auditApi.getFinding(findingId)).data.data,
    enabled: Number.isFinite(findingId),
  });

  const finding = (findingQuery.data ?? {}) as Record<string, unknown>;
  const responses = (finding.management_responses as Array<Record<string, unknown>> | undefined) ?? [];
  const actions = (finding.corrective_actions as Array<Record<string, unknown>> | undefined) ?? [];

  const respond = useMutation({
    mutationFn: () =>
      auditApi.respondFinding(findingId, {
        response_text: responseText.trim(),
        agrees,
      }),
    onSuccess: () => {
      setResponseText("");
      success("Management response recorded. This does not close the finding.");
      qc.invalidateQueries({ queryKey: ["audit", "finding", findingId] });
    },
    onError: (err) => toastError(apiError(err, "Could not record the response.")),
  });

  const createCorrective = useMutation({
    mutationFn: () =>
      auditApi.createCorrective(findingId, {
        title: caTitle.trim(),
        due_date: caDue || undefined,
      }),
    onSuccess: () => {
      setCaTitle("");
      setCaDue("");
      success("Corrective action created. Assignment completion does not close the finding.");
      qc.invalidateQueries({ queryKey: ["audit", "finding", findingId] });
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not create the corrective action.")),
  });

  const issue = useMutation({
    mutationFn: () => auditApi.issueFinding(findingId),
    onSuccess: () => {
      success("Finding issued");
      qc.invalidateQueries({ queryKey: ["audit", "finding", findingId] });
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not issue this finding.")),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title={String(finding.reference_number ?? "Finding")}
        subtitle={`${String(finding.title ?? "")} · ${String(finding.status ?? "")}. Management response and corrective actions do not close the finding.`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Internal Audit", href: "/audit" },
              { label: "Findings", href: "/audit/findings" },
              { label: String(finding.reference_number ?? "Detail") },
            ]}
          />
        }
      />

      {findingQuery.isLoading ? <p className="text-sm text-neutral-500">Loading finding…</p> : null}
      {findingQuery.isError ? <p className="text-sm text-red-600">Failed to load this finding.</p> : null}

      {findingQuery.data ? (
        <>
          <FormSection title="Summary">
            <LabelledRecord
              value={{
                title: finding.title,
                rating: finding.rating,
                status: finding.status,
                confidentiality: finding.confidentiality_level,
                recommendation: finding.recommendation,
              }}
            />
            {finding.status === "draft" ? (
              <button
                type="button"
                className="btn-primary mt-4 text-sm"
                disabled={issue.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Issue this finding?",
                    message: "Issued findings are immutable for management. This never auto-closes.",
                    confirmText: "Issue",
                  });
                  if (ok) issue.mutate();
                }}
              >
                Issue to management
              </button>
            ) : null}
          </FormSection>

          <FormSection title="Management response">
            {responses.length === 0 ? (
              <p className="text-sm text-neutral-500 mb-3">No management responses yet.</p>
            ) : (
              <ul className="mb-4 space-y-2 text-sm">
                {responses.map((row) => (
                  <li key={String(row.id)} className="card p-3">
                    <LabelledRecord
                      value={{
                        agrees: row.agrees ? "Agrees" : "Disagrees",
                        response: row.response_text,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!responseText.trim() || respond.isPending) return;
                respond.mutate();
              }}
            >
              <FormField label="Response" htmlFor="audit-finding-response" required>
                <textarea
                  id="audit-finding-response"
                  className="input w-full"
                  rows={3}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  disabled={respond.isPending}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm" htmlFor="audit-finding-agrees">
                <input
                  id="audit-finding-agrees"
                  type="checkbox"
                  checked={agrees}
                  onChange={(e) => setAgrees(e.target.checked)}
                />
                Management agrees with the finding
              </label>
              <button type="submit" className="btn-secondary text-sm" disabled={respond.isPending || !responseText.trim()}>
                {respond.isPending ? "Saving..." : "Record response"}
              </button>
            </form>
          </FormSection>

          <FormSection title="Corrective actions">
            <p className="text-xs text-neutral-500 mb-3">
              Completing an assignment moves the item to verification. It does not close the finding.
            </p>
            {actions.length === 0 ? (
              <EmptyState title="No corrective actions" description="Create an action after the finding is issued." />
            ) : (
              <ul className="mb-4 space-y-2">
                {actions.map((row) => (
                  <li key={String(row.id)} className="card p-3">
                    <LabelledRecord
                      value={{
                        title: row.title,
                        status: row.status,
                        due: row.due_date,
                        assignment: row.assignment_id ? `Assignment #${row.assignment_id}` : "Not linked",
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!caTitle.trim() || createCorrective.isPending) return;
                createCorrective.mutate();
              }}
            >
              <FormField label="Action title" htmlFor="audit-ca-title" required>
                <input
                  id="audit-ca-title"
                  className="input w-full"
                  value={caTitle}
                  onChange={(e) => setCaTitle(e.target.value)}
                  disabled={createCorrective.isPending}
                />
              </FormField>
              <FormField label="Due date" htmlFor="audit-ca-due">
                <input
                  id="audit-ca-due"
                  type="date"
                  className="input w-full"
                  value={caDue}
                  onChange={(e) => setCaDue(e.target.value)}
                  disabled={createCorrective.isPending}
                />
              </FormField>
              <div>
                <button type="submit" className="btn-primary text-sm" disabled={createCorrective.isPending || !caTitle.trim()}>
                  {createCorrective.isPending ? "Creating..." : "Create corrective action"}
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs">
              <Link className="text-primary" href="/audit/corrective-actions">Open corrective-action queue</Link>
            </p>
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
