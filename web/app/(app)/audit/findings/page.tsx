"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
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
    <div className="page-container">
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
              className="form-input w-full"
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
              className="form-input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={create.isPending}
            />
          </FormField>
          <FormField label="Rating" htmlFor="audit-finding-rating">
            <select
              id="audit-finding-rating"
              className="form-input w-full"
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
        <QueryStatus isLoading={findingsQuery.isLoading} isError={findingsQuery.isError} error="Failed to load findings." />
        {!findingsQuery.isLoading && !findingsQuery.isError && rows.length === 0 ? (
          <EmptyState title="No findings" description="Create a draft against an engagement, then issue it to management." />
        ) : null}
        {!findingsQuery.isLoading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Confidentiality</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{String(r.reference_number ?? "—")}</td>
                    <td>
                      {r.redacted ? (
                        <span>{String(r.title)}</span>
                      ) : (
                        <Link className="text-primary font-medium" href={`/audit/findings/${r.id}`}>
                          {String(r.title)}
                        </Link>
                      )}
                    </td>
                    <td>
                      <StatusPill value={String(r.rating ?? "")} />
                    </td>
                    <td>
                      <StatusPill value={String(r.status ?? "")} />
                    </td>
                    <td>{String(r.confidentiality_level)}</td>
                    <td>
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
        ) : null}
      </FormSection>
    </div>
  );
}
