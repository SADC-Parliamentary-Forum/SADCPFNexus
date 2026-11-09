"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetChangeRequest } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function BudgetChangeDetailPage() {
  const { t, localeTag } = useI18n();
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);
  const isSg = isSystemAdmin(user) || Boolean(user?.roles?.includes("Secretary General"));
  const canApply =
    isSystemAdmin(user) ||
    hasPermission(user, ["finance.admin"]) ||
    Boolean(user?.roles?.includes("Finance Controller"));

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["budget", "changes", id],
    queryFn: () => budgetApi.getChange(id).then((r) => r.data.data as BudgetChangeRequest),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget", "changes", id] });

  const submitMut = useMutation({
    mutationFn: () => budgetApi.submitChange(id),
    onSuccess: () => {
      setMessage(t("budget.change.submittedToFinance"));
      toast.success(t("budget.change.submitted"), t("budget.change.submittedToFinance"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.change.submitFailed"));
      toast.error(t("budget.change.notSubmitted"), apiErrorMessage(err, t("budget.change.submitFailed")));
    },
  });
  const financeMut = useMutation({
    mutationFn: (decision: "approve" | "return" | "reject") =>
      budgetApi.financeDecideChange(id, { decision }),
    onSuccess: () => {
      setMessage(t("budget.change.financeRecordedDot"));
      toast.success(t("budget.change.financeRecorded"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.change.financeFailed"));
      toast.error(t("budget.change.financeNotRecorded"), apiErrorMessage(err, t("budget.change.financeFailed")));
    },
  });
  const sgMut = useMutation({
    mutationFn: (decision: "approve" | "return" | "reject") => budgetApi.sgDecideChange(id, { decision }),
    onSuccess: () => {
      setMessage(t("budget.change.sgRecordedDot"));
      toast.success(t("budget.change.sgRecorded"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.change.sgFailed"));
      toast.error(t("budget.change.sgNotRecorded"), apiErrorMessage(err, t("budget.change.sgFailed")));
    },
  });
  const applyMut = useMutation({
    mutationFn: () => budgetApi.applyChange(id),
    onSuccess: () => {
      setMessage(t("budget.change.appliedToLines"));
      toast.success(t("budget.change.applied"), t("budget.change.appliedToLines"));
      invalidate();
      qc.invalidateQueries({ queryKey: ["budget", "lines"] });
    },
    onError: (err) => {
      setError(t("budget.change.applyFailed"));
      toast.error(t("budget.change.notApplied"), apiErrorMessage(err, t("budget.change.applyFailed")));
    },
  });

  const row = query.data;

  if (query.isLoading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.change.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.changes.title", href: "/budget/changes" }, { label: "budget.change.crumb" }]} />}
        />
        <p className="text-sm text-neutral-400">{t("common.loading")}</p>
      </div>
    );
  }
  if (!row) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.change.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.changes.title", href: "/budget/changes" }, { label: "budget.change.crumb" }]} />}
        />
        <p className="text-sm text-red-700">{t("srhr.notFound")}</p>
        <Link href="/budget/changes" className="btn-secondary text-sm">{t("budget.change.back")}</Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={row.title}
        subtitle={`${row.type} · ${row.status.replaceAll("_", " ")}${row.requires_sg ? t("budget.change.requiresSg") : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "budget.changes.title", href: "/budget/changes" },
              { label: row.title },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
          {["draft", "returned"].includes(row.status) && (
            <button type="button" className="btn-primary text-sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              {t("common.submit")}
            </button>
          )}
          {canFinance && row.status === "pending_finance" && (
            <>
              <button type="button" className="btn-primary text-sm" onClick={() => financeMut.mutate("approve")}>
                {t("budget.change.financeApprove")}
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => financeMut.mutate("return")}>
                {t("common.return")}
              </button>
            </>
          )}
          {(isSg || canFinance) && row.status === "pending_sg" && (
            <button type="button" className="btn-primary text-sm" onClick={() => sgMut.mutate("approve")}>
              {t("budget.change.sgApprove")}
            </button>
          )}
          {canApply && row.status === "approved" && (
            <button type="button" className="btn-primary text-sm" onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              {t("hr.timesheets.apply")}
            </button>
          )}
          </div>
        }
      />

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {row.justification && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
          <div className="mb-1 font-semibold">{t("budget.change.justification")}</div>
          {row.justification}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{t("budget.change.items")}</div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 font-medium">{t("budget.fx.from")}</th>
              <th className="px-4 py-2 font-medium">{t("budget.change.toNew")}</th>
              <th className="px-4 py-2 font-medium text-right">{t("budget.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {(row.items ?? []).map((item, idx) => (
              <tr key={item.id ?? idx} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2">{item.source_line?.code || item.source_budget_line_id || "—"}</td>
                <td className="px-4 py-2">
                  {item.target_line?.code ||
                    item.target_budget_line_id ||
                    item.new_line_name ||
                    item.new_line_code ||
                    "—"}
                  {item.is_decrease ? t("budget.change.decrease") : ""}
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(item.amount).toLocaleString(localeTag, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
