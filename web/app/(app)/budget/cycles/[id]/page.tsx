"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetCycle, type BudgetSubmissionPack } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function BudgetCycleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);
  const isSg =
    isSystemAdmin(user) || Boolean(user?.roles?.includes("Secretary General"));
  const canRecordDecision =
    canFinance ||
    isSystemAdmin(user) ||
    Boolean(user?.roles?.includes("Governance Officer")) ||
    hasPermission(user, ["finance.admin"]);

  const [assumptions, setAssumptions] = useState("");
  const [inflation, setInflation] = useState("5");
  const [deadline, setDeadline] = useState("");
  const [packTitle, setPackTitle] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [decisionBody, setDecisionBody] = useState<"fsc" | "exco" | "plenary">("fsc");
  const [decisionOutcome, setDecisionOutcome] = useState("approved");
  const [meetingOn, setMeetingOn] = useState("");
  const [minuteRef, setMinuteRef] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [decisionFile, setDecisionFile] = useState<File | null>(null);

  const cycleQuery = useQuery({
    queryKey: ["budget", "cycles", id],
    queryFn: () => budgetApi.getCycle(id).then((r) => r.data.data as BudgetCycle),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget", "cycles", id] });

  const guidelinesMut = useMutation({
    mutationFn: () =>
      budgetApi.publishGuidelines(id, {
        assumptions: assumptions.trim() || undefined,
        inflation_rate: inflation ? Number(inflation) : undefined,
        department_deadline: deadline || undefined,
      }),
    onSuccess: () => {
      setMessage(t("budget.cycle.guidelinesPublishedMsg"));
      toast.success(t("budget.cycle.guidelinesPublished"));
      setError("");
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.cycle.guidelinesFailed"));
      toast.error(t("budget.cycle.guidelinesNotPublished"), apiErrorMessage(err, t("budget.cycle.guidelinesFailed")));
    },
  });

  const advanceMut = useMutation({
    mutationFn: () => budgetApi.advanceCycle(id),
    onSuccess: () => {
      setMessage(t("budget.cycle.advancedMsg"));
      toast.success(t("budget.cycle.advanced"));
      setError("");
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.cycle.advanceFailed"));
      toast.error(t("budget.cycle.notAdvanced"), apiErrorMessage(err, t("budget.cycle.advanceFailed")));
    },
  });

  const returnMut = useMutation({
    mutationFn: () => budgetApi.returnCycle(id, { reason: returnReason.trim() }),
    onSuccess: () => {
      setMessage(t("budget.cycle.returnedMsg"));
      toast.success(t("budget.cycle.returned"));
      setReturnReason("");
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.submission.returnFailed"));
      toast.error(t("budget.cycle.notReturned"), apiErrorMessage(err, t("budget.submission.returnFailed")));
    },
  });

  const sgMut = useMutation({
    mutationFn: () => budgetApi.sgApproveCycle(id, { comments: "SG approved" }),
    onSuccess: () => {
      setMessage(t("budget.cycle.sgApprovedMsg"));
      toast.success(t("budget.cycle.approved"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.cycle.sgApproveFailed"));
      toast.error(t("budget.cycle.notApproved"), apiErrorMessage(err, t("budget.cycle.sgApproveFailed")));
    },
  });

  const lockMut = useMutation({
    mutationFn: () => budgetApi.lockCycle(id),
    onSuccess: () => {
      setMessage(t("budget.cycle.lockedMsg"));
      toast.success(t("budget.cycle.locked"));
      invalidate();
      qc.invalidateQueries({ queryKey: ["budget", "lines"] });
    },
    onError: (err) => {
      setError(t("budget.cycle.lockFailed"));
      toast.error(t("budget.cycle.notLocked"), apiErrorMessage(err, t("budget.cycle.lockFailed")));
    },
  });

  const decisionMut = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("body", decisionBody);
      form.append("decision", decisionOutcome);
      if (meetingOn) form.append("meeting_on", meetingOn);
      if (minuteRef.trim()) form.append("minute_reference", minuteRef.trim());
      if (decisionComments.trim()) form.append("comments", decisionComments.trim());
      if (decisionFile) form.append("attachment", decisionFile);
      return budgetApi.recordDecision(id, form);
    },
    onSuccess: () => {
      setMessage(t("budget.cycle.decisionRecordedMsg"));
      toast.success(t("budget.cycle.decisionRecorded"));
      setError("");
      setDecisionComments("");
      setMinuteRef("");
      setDecisionFile(null);
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.cycle.decisionFailed"));
      toast.error(t("budget.cycle.decisionNotRecorded"), apiErrorMessage(err, t("budget.cycle.decisionFailed")));
    },
  });

  const createPackMut = useMutation({
    mutationFn: () =>
      budgetApi.createSubmission({
        budget_cycle_id: id,
        title: packTitle.trim(),
        items: [
          {
            code: itemCode.trim() || undefined,
            name: itemName.trim(),
            requested_amount: Number(itemAmount),
          },
        ],
      }),
    onSuccess: () => {
      setPackTitle("");
      setItemCode("");
      setItemName("");
      setItemAmount("");
      setMessage(t("budget.cycle.packCreatedMsg"));
      toast.success(t("budget.cycle.packCreated"));
      invalidate();
    },
    onError: (err) => {
      setError(t("budget.cycle.packFailed"));
      toast.error(t("budget.cycle.packNotCreated"), apiErrorMessage(err, t("budget.cycle.packFailed")));
    },
  });

  const cycle = cycleQuery.data;
  const submissions: BudgetSubmissionPack[] = useMemo(() => cycle?.submissions ?? [], [cycle]);
  const institutionalStatuses = ["fsc_review", "exco_review", "plenary_review", "plenary_approved"];
  const canAdvance =
    canFinance &&
    ["planning", "department_preparation", "submitted_to_finance", "finance_review"].includes(cycle?.status ?? "");

  if (cycleQuery.isLoading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.cycle.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.cycles.title", href: "/budget/cycles" }, { label: "budget.submission.cycle" }]} />}
        />
        <p className="text-sm text-neutral-400">{t("budget.cycle.loading")}</p>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title="budget.cycle.title"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "budget.cycles.title", href: "/budget/cycles" }, { label: "budget.submission.cycle" }]} />}
        />
        <p className="text-sm text-red-700">{t("budget.cycle.notFound")}</p>
        <Link href="/budget/cycles" className="btn-secondary text-sm">{t("budget.submission.backToCycles")}</Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={cycle.financial_year?.label || cycle.financial_year?.code || t("budget.cycle.numbered", { id: cycle.id })}
        subtitle={t("budget.cycle.statusLine", { status: statusLabel(cycle.status) })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.finance", href: "/finance" },
              { label: "budget.cycles.title", href: "/budget/cycles" },
              { label: cycle.financial_year?.label || cycle.financial_year?.code || t("budget.cycle.numbered", { id: cycle.id }) },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
          {canAdvance && (
            <button type="button" className="btn-secondary text-sm" onClick={() => advanceMut.mutate()} disabled={advanceMut.isPending}>
              {t("budget.cycle.advanceStage")}
            </button>
          )}
          {(isSg || canFinance) && cycle.status === "management_review" && (
            <button type="button" className="btn-primary text-sm" onClick={() => sgMut.mutate()} disabled={sgMut.isPending}>
              {t("budget.change.sgApprove")}
            </button>
          )}
          {canFinance && cycle.status === "plenary_approved" && (
            <button type="button" className="btn-primary text-sm" onClick={() => lockMut.mutate()} disabled={lockMut.isPending}>
              {t("budget.cycle.lockActivate")}
            </button>
          )}
          </div>
        }
      />

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">{error}</div>}

      {canFinance && cycle.status !== "active" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.publishGuidelines")}</h2>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
            rows={3}
            placeholder={t("budget.cycle.assumptions")}
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <label htmlFor="cycle-inflation" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.inflation")}
              <input
                id="cycle-inflation"
                className="ml-2 w-24 rounded-lg border border-[var(--border)] px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={inflation}
                onChange={(e) => setInflation(e.target.value)}
              />
            </label>
            <label htmlFor="cycle-deadline" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.departmentDeadline")}
              <input
                id="cycle-deadline"
                type="date"
                className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <button type="button" className="btn-secondary text-sm" onClick={() => guidelinesMut.mutate()} disabled={guidelinesMut.isPending}>
              {t("budget.cycle.publish")}
            </button>
          </div>
          {cycle.guideline?.assumptions && (
            <p className="text-xs text-[var(--muted)] dark:text-neutral-400">{t("budget.cycle.current", { value: cycle.guideline.assumptions })}</p>
          )}
        </div>
      )}

      {canFinance && cycle.status === "finance_review" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-2 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.returnToDepartments")}</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
            placeholder={t("common.reason")}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!returnReason.trim() || returnMut.isPending}
            onClick={() => returnMut.mutate()}
          >
            {t("budget.cycle.returnAllPacks")}
          </button>
        </div>
      )}

      {["planning", "department_preparation"].includes(cycle.status) && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.newPack")}</h2>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
            placeholder={t("budget.cycle.packTitle")}
            value={packTitle}
            onChange={(e) => setPackTitle(e.target.value)}
          />
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
              placeholder={t("budget.cycle.lineCode")}
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
              placeholder={t("budget.cycle.lineName")}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
              placeholder={t("budget.cycle.requestedAmount")}
              value={itemAmount}
              onChange={(e) => setItemAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!packTitle.trim() || !itemName.trim() || !itemAmount || createPackMut.isPending}
            onClick={() => createPackMut.mutate()}
          >
            {t("budget.cycle.createPack")}
          </button>
        </div>
      )}

      {canRecordDecision && institutionalStatuses.includes(cycle.status) && cycle.status !== "plenary_approved" && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.decisionTitle")}</h2>
          <p className="text-xs text-[var(--muted)] dark:text-neutral-400">
            {t("budget.cycle.currentStage")} <span className="capitalize">{statusLabel(cycle.status)}</span>. {t("budget.cycle.decisionHint")}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <label htmlFor="cycle-decision-body" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.body")}
              <select
                id="cycle-decision-body"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={decisionBody}
                onChange={(e) => setDecisionBody(e.target.value as "fsc" | "exco" | "plenary")}
              >
                <option value="fsc">{t("budget.cycle.body.fsc")}</option>
                <option value="exco">{t("budget.cycle.body.exco")}</option>
                <option value="plenary">{t("budget.cycle.body.plenary")}</option>
              </select>
            </label>
            <label htmlFor="cycle-decision-outcome" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.decision")}
              <select
                id="cycle-decision-outcome"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={decisionOutcome}
                onChange={(e) => setDecisionOutcome(e.target.value)}
              >
                <option value="approved">{t("status.approved")}</option>
                <option value="approved_with_amendments">{t("budget.cycle.outcome.approvedWithAmendments")}</option>
                <option value="deferred">{t("budget.cycle.outcome.deferred")}</option>
                <option value="rejected">{t("status.rejected")}</option>
              </select>
            </label>
            <label htmlFor="cycle-meeting-on" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.meetingDate")}
              <input
                id="cycle-meeting-on"
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                value={meetingOn}
                onChange={(e) => setMeetingOn(e.target.value)}
              />
            </label>
            <label htmlFor="cycle-minute-ref" className="text-sm dark:text-neutral-200">
              {t("budget.cycle.minuteRef")}
              <input
                id="cycle-minute-ref"
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
                value={minuteRef}
                onChange={(e) => setMinuteRef(e.target.value)}
                placeholder={t("budget.cycle.minuteRefPlaceholder")}
              />
            </label>
          </div>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
            rows={2}
            placeholder={t("budget.cycle.comments")}
            value={decisionComments}
            onChange={(e) => setDecisionComments(e.target.value)}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="block w-full text-sm dark:text-neutral-300"
            onChange={(e) => setDecisionFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={decisionMut.isPending}
            onClick={() => decisionMut.mutate()}
          >
            {t("budget.cycle.recordDecision")}
          </button>
        </div>
      )}

      {(cycle.decisions?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-2 text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.decisions")}</h2>
          <ul className="space-y-1 text-sm text-[var(--muted)] dark:text-neutral-400">
            {cycle.decisions?.map((d) => (
              <li key={d.id}>
                <span className="uppercase text-[var(--foreground)] dark:text-neutral-100">{d.body}</span> — {statusLabel(d.decision)}
                {d.minute_reference ? ` (${d.minute_reference})` : ""}
                {d.comments ? `: ${d.comments}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold dark:border-neutral-700 dark:text-neutral-100">{t("budget.reports.col.submissions")}</div>
        {submissions.length === 0 ? (
          <EmptyState icon="folder_open" title={t("budget.cycle.noPacks")} />
        ) : (
          <table className="w-full text-left text-sm dark:text-neutral-200">
            <thead className="border-b border-[var(--border)] text-[var(--muted)] dark:border-neutral-700 dark:bg-neutral-950/60 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-2 font-medium">{t("budget.reports.col.title")}</th>
                <th className="px-4 py-2 font-medium">{t("budget.reports.col.status")}</th>
                <th className="px-4 py-2 font-medium">{t("budget.change.items")}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0 dark:border-neutral-800">
                  <td className="px-4 py-2">{s.title}</td>
                  <td className="px-4 py-2 capitalize">{statusLabel(s.status)}</td>
                  <td className="px-4 py-2">{s.items?.length ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/budget/submissions/${s.id}`} className="btn-secondary text-xs">
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(cycle.approvals?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-2 text-sm font-semibold dark:text-neutral-100">{t("budget.cycle.stageHistory")}</h2>
          <ul className="space-y-1 text-sm text-[var(--muted)] dark:text-neutral-400">
            {cycle.approvals?.map((a) => (
              <li key={a.id}>
                <span className="capitalize text-[var(--foreground)] dark:text-neutral-100">{statusLabel(a.stage)}</span> — {a.decision}
                {a.comments ? `: ${a.comments}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
