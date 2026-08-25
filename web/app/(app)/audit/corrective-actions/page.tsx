"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authAccess";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
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

export default function AuditCorrectiveActionsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();
  const user = getStoredUser();
  const canComplete = hasPermission(user, ["audit.corrective.manage", "audit.admin"]);
  const canVerify = hasPermission(user, ["audit.corrective.verify", "audit.admin"]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "findings", "ca"],
    queryFn: async () =>
      (await auditApi.listFindings({
        per_page: 100,
        status: "corrective_in_progress,due_for_verification,reopened",
      })).data,
  });
  const rows = paginatedRows(data);

  const complete = useMutation({
    mutationFn: (id: number) => auditApi.completeCorrective(id),
    onSuccess: () => {
      success("Marked complete. This does not close the finding.");
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not complete this action.")),
  });

  const verify = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: string }) =>
      auditApi.verifyCorrective(id, { outcome, notes: "Verified from corrective-action queue" }),
    onSuccess: () => {
      success("Verification recorded. Closing still requires the verified_closed outcome.");
      qc.invalidateQueries({ queryKey: ["audit", "findings"] });
    },
    onError: (err) => toastError(apiError(err, "Could not verify this action.")),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Corrective actions"
        subtitle="Corrective actions create Assignments. Assignment completion moves items to Due for Audit Verification — it does not close the finding."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Internal Audit", href: "/audit" }, { label: "Corrective actions" }]} />
        }
      />

      <FormSection title="Open remediation">
        {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : null}
        {isError ? <p className="text-sm text-red-600">Failed to load corrective actions.</p> : null}
        {!isLoading && rows.length === 0 ? (
          <EmptyState title="No open corrective-action findings" description="Issued findings with remediation in progress appear here." />
        ) : (
          <ul className="space-y-3">
            {rows.filter((r) => !r.redacted).map((r) => {
              const actions = (r.corrective_actions as Array<Record<string, unknown>> | undefined) ?? [];
              return (
                <li key={String(r.id)} className="card p-4 space-y-3">
                  <div>
                    <Link className="font-medium text-primary" href={`/audit/findings/${r.id}`}>
                      {String(r.reference_number)} — {String(r.title)}
                    </Link>
                    <p className="text-xs text-neutral-500 mt-1">Finding status: {String(r.status)}</p>
                  </div>
                  {actions.length === 0 ? (
                    <p className="text-sm text-neutral-500">No corrective actions loaded for this finding.</p>
                  ) : (
                    actions.map((action) => (
                      <div key={String(action.id)} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
                        <LabelledRecord
                          value={{
                            title: action.title,
                            status: action.status,
                            due: action.due_date,
                          }}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canComplete && action.status !== "due_for_verification" && action.status !== "verified_closed" ? (
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={complete.isPending || verify.isPending}
                              onClick={() => complete.mutate(Number(action.id))}
                            >
                              Mark complete
                            </button>
                          ) : null}
                          {canVerify && action.status === "due_for_verification" ? (
                            <>
                              <button
                                type="button"
                                className="btn-primary text-xs"
                                disabled={complete.isPending || verify.isPending}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: "Verify and close this action?",
                                    message: "verified_closed records auditor verification. It does not close the finding by itself if other actions remain.",
                                    confirmText: "Verify closed",
                                  });
                                  if (ok) verify.mutate({ id: Number(action.id), outcome: "verified_closed" });
                                }}
                              >
                                Verify closed
                              </button>
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={complete.isPending || verify.isPending}
                                onClick={() => verify.mutate({ id: Number(action.id), outcome: "reopened" })}
                              >
                                Reopen
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
