"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

function apiError(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const first = Object.values(ax.response?.data?.errors ?? {})[0]?.[0];
  return first || ax.response?.data?.message || fallback;
}

function paginatedRows(payload: unknown): Array<Record<string, unknown>> {
  const data = payload as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | undefined;
  if (Array.isArray(data)) return data;
  return data?.data ?? [];
}

export default function AuditFindingsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const [engagementId, setEngagementId] = useState("");
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState("medium");

  const findingsQuery = useQuery({
    queryKey: ["audit", "findings"],
    queryFn: async () => (await auditApi.listFindings({ per_page: 100 })).data,
  });
  const engagementsQuery = useQuery({
    queryKey: ["audit", "engagements", "picker"],
    queryFn: async () => (await auditApi.listEngagements({ per_page: 100 })).data,
  });

  const rows = paginatedRows(findingsQuery.data);
  const engagements = paginatedRows(engagementsQuery.data);

  const create = useMutation({
    mutationFn: () =>
      auditApi.createFinding({
        engagement_id: Number(engagementId),
        title: title.trim(),
        rating,
      }),
    onSuccess: () => {
      setTitle("");
      success("Draft finding created. Issue it separately — this never auto-closes.");
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not create the finding.")),
  });

  const issue = useMutation({
    mutationFn: (id: number) => auditApi.issueFinding(id),
    onSuccess: () => {
      success("Finding issued to management");
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not issue this finding.")),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Findings"
        subtitle="Draft, issue, and track findings. Issuing does not close work. Never auto-closes."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Internal Audit", href: "/audit" }, { label: "Findings" }]} />}
      />

      <FormSection title="Create draft finding">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!engagementId || !title.trim() || create.isPending) return;
            create.mutate();
          }}
        >
          <FormField label="Engagement" htmlFor="audit-finding-engagement" required>
            <select
              id="audit-finding-engagement"
              className="input w-full"
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              disabled={create.isPending}
            >
              <option value="">Select engagement</option>
              {engagements.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.reference_number ?? row.title ?? row.id)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Title" htmlFor="audit-finding-title" required>
            <input
              id="audit-finding-title"
              className="input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={create.isPending}
            />
          </FormField>
          <FormField label="Rating" htmlFor="audit-finding-rating">
            <select
              id="audit-finding-rating"
              className="input w-full"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              disabled={create.isPending}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>
          <div className="flex items-end">
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={create.isPending || !engagementId || !title.trim()}
            >
              {create.isPending ? "Creating..." : "Create draft"}
            </button>
          </div>
        </form>
      </FormSection>

      <FormSection title="Register">
        {findingsQuery.isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
        {findingsQuery.isError ? <p className="text-sm text-red-600">Failed to load findings.</p> : null}
        {!findingsQuery.isLoading && rows.length === 0 ? (
          <EmptyState title="No findings" description="Create a draft against an engagement, then issue it to management." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b">
                  <th className="p-2">Reference</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Rating</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Confidentiality</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-b border-neutral-100">
                    <td className="p-2">{String(r.reference_number ?? "—")}</td>
                    <td className="p-2">
                      {r.redacted ? (
                        <span>{String(r.title)}</span>
                      ) : (
                        <Link className="text-primary font-medium" href={`/audit/findings/${r.id}`}>
                          {String(r.title)}
                        </Link>
                      )}
                    </td>
                    <td className="p-2 capitalize">{String(r.rating ?? "—")}</td>
                    <td className="p-2">{String(r.status)}</td>
                    <td className="p-2">{String(r.confidentiality_level)}</td>
                    <td className="p-2">
                      {r.status === "draft" && !r.redacted ? (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={issue.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Issue this finding?",
                              message: "Issued findings are immutable for management. This never auto-closes the finding.",
                              confirmText: "Issue",
                            });
                            if (ok) issue.mutate(Number(r.id));
                          }}
                        >
                          Issue
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400 capitalize">{String(r.status).replaceAll("_", " ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
