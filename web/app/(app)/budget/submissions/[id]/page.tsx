"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetSubmissionPack } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function money(n: number, localeTag?: string): string {
  return n.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetSubmissionDetailPage() {
  const { t, localeTag } = useI18n();
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);

  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["budget", "submissions", id],
    queryFn: () => budgetApi.getSubmission(id).then((r) => r.data.data as BudgetSubmissionPack),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget", "submissions", id] });
    if (query.data?.budget_cycle_id) {
      qc.invalidateQueries({ queryKey: ["budget", "cycles", query.data.budget_cycle_id] });
    }
  };

  const submitMut = useMutation({
    mutationFn: () => budgetApi.submitSubmission(id),
    onSuccess: () => {
      setMessage(t("budget.submission.submittedMsg"));
      toast.success(t("budget.submission.submitted"));
      setError("");
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.change.submitFailed"));
      toast.error(t("budget.submission.notSubmitted"), apiErrorMessage(err, t("budget.change.submitFailed")));
    },
  });

  const acceptMut = useMutation({
    mutationFn: () => budgetApi.acceptSubmission(id),
    onSuccess: () => {
      setMessage(t("budget.submission.acceptedMsg"));
      toast.success(t("budget.submission.accepted"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.submission.acceptFailed"));
      toast.error(t("budget.submission.notAccepted"), apiErrorMessage(err, t("budget.submission.acceptFailed")));
    },
  });

  const returnMut = useMutation({
    mutationFn: () => budgetApi.returnSubmission(id, { reason: reason.trim() }),
    onSuccess: () => {
      setMessage(t("budget.submission.returnedMsg"));
      toast.success(t("budget.submission.returned"));
      setReason("");
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.submission.returnFailed"));
      toast.error(t("budget.submission.notReturned"), apiErrorMessage(err, t("budget.submission.returnFailed")));
    },
  });

  const pack = query.data;

  if (query.isLoading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.submission.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.cycles.title", href: "/budget/cycles" }, { label: "budget.submission.crumb" }]} />}
        />
        <p className="text-sm text-neutral-400">{t("budget.submission.loading")}</p>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.submission.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.cycles.title", href: "/budget/cycles" }, { label: "budget.submission.crumb" }]} />}
        />
        <p className="text-sm text-red-700">{t("budget.submission.notFound")}</p>
        <Link href="/budget/cycles" className="btn-secondary text-sm">{t("budget.submission.backToCycles")}</Link>
      </div>
    );
  }

  const total = (pack.items ?? []).reduce((sum, i) => sum + Number(i.requested_amount || 0), 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={pack.title}
        subtitle={`${pack.type} · ${pack.status.replaceAll("_", " ")}${pack.preparer?.name ? t("budget.submission.preparedBy", { name: pack.preparer.name }) : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "budget.cycles.title", href: "/budget/cycles" },
              { label: "budget.submission.cycle", href: `/budget/cycles/${pack.budget_cycle_id}` },
              { label: pack.title },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
          {["draft", "returned"].includes(pack.status) && (
            <button type="button" className="btn-primary text-sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              {t("common.submit")}
            </button>
          )}
          {canFinance && pack.status === "submitted" && (
            <button type="button" className="btn-primary text-sm" onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
              {t("budget.submission.accept")}
            </button>
          )}
          </div>
        }
      />

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {pack.returned_reason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("budget.submission.returnedReason", { reason: pack.returned_reason })}
        </div>
      )}
      {pack.motivation && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          <div className="mb-1 font-semibold">{t("budget.submission.motivation")}</div>
          {pack.motivation}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-semibold">{t("budget.submission.lineItems")}</span>
          <span className="text-sm text-[var(--muted)]">{t("budget.submission.total", { amount: money(total, localeTag) })}</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">{t("hr.timesheets.templates.code")}</th>
              <th className="px-4 py-2 font-medium">{t("hr.timesheets.templates.name")}</th>
              <th className="px-4 py-2 font-medium text-right">{t("budget.submission.requested")}</th>
            </tr>
          </thead>
          <tbody>
            {(pack.items ?? []).map((item, idx) => (
              <tr key={item.id ?? idx} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2">{item.code || "—"}</td>
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-right">{money(Number(item.requested_amount), localeTag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canFinance && ["submitted", "accepted", "pending_hod"].includes(pack.status) && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("budget.submission.returnTitle")}</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t("common.reason")} aria-label={t("common.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!reason.trim() || returnMut.isPending}
            onClick={() => returnMut.mutate()}
          >
            {t("common.return")}
          </button>
        </div>
      )}
    </div>
  );
}
