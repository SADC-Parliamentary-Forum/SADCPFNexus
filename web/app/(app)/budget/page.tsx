"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  budgetApi,
  type BudgetAvailability,
  type OrgBudgetLine,
} from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";

function unwrapLines(payload: unknown): OrgBudgetLine[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as OrgBudgetLine[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as OrgBudgetLine[];
  }
  return [];
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetControlPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [lines, setLines] = useState<OrgBudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [availabilityById, setAvailabilityById] = useState<Record<number, BudgetAvailability>>({});
  const [journalLineId, setJournalLineId] = useState("");
  const [journalAmount, setJournalAmount] = useState("");
  const [journalMemo, setJournalMemo] = useState("");
  const [journalMsg, setJournalMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    budgetApi
      .lines({ active_only: true, per_page: 200, ...(q.trim() ? { q: q.trim() } : {}) })
      .then(async (res) => {
        const list = unwrapLines(res.data);
        setLines(list);
        setError("");
        const checks = await Promise.all(
          list.slice(0, 40).map(async (line) => {
            try {
              const avail = await budgetApi.availability(line.id);
              return [line.id, avail.data.data] as const;
            } catch {
              return null;
            }
          }),
        );
        const map: Record<number, BudgetAvailability> = {};
        for (const row of checks) {
          if (row) map[row[0]] = row[1];
        }
        setAvailabilityById(map);
      })
      .catch(() => setError(t("budget.home.loadFailed")))
      .finally(() => setLoading(false));
  }, [q]);

  const totals = useMemo(() => {
    const values = Object.values(availabilityById);
    return values.reduce(
      (acc, row) => {
        acc.approved += row.approved;
        acc.actual += row.actual;
        acc.commitments += row.commitments;
        acc.available += row.available;
        return acc;
      },
      { approved: 0, actual: 0, commitments: 0, available: 0 },
    );
  }, [availabilityById]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title={t("budget.home.title")}
        subtitle={t("budget.home.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("budget.home.title") }]} />}
      />
        <div className="flex items-center gap-2">
          <Link href="/budget/cycles" className="btn-secondary text-sm">
            {t("budget.home.cycles")}
          </Link>
          <Link href="/budget/changes" className="btn-secondary text-sm">
            {t("budget.home.changes")}
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            {t("budget.home.variance")}
          </Link>
          <Link href="/budget/reports" className="btn-secondary text-sm">
            {t("budget.home.reports")}
          </Link>
          <Link href="/finance/budget" className="btn-secondary text-sm">
            {t("budget.home.legacy")}
          </Link>
          <Link href="/procurement/budget" className="btn-primary text-sm">
            {t("budget.home.reserves")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: t("budget.home.card.approved"), value: totals.approved },
          { label: t("budget.home.card.actual"), value: totals.actual },
          { label: t("budget.home.card.commitments"), value: totals.commitments },
          { label: t("budget.home.card.available"), value: totals.available },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <div className="text-sm font-medium text-neutral-500 mb-1">{card.label}</div>
            <div className="text-xl font-bold text-neutral-900">{t("budget.home.amountNad", { amount: money(card.value) })}</div>
          </div>
        ))}
      </div>

      <form
        className="card space-y-3 p-5 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setJournalMsg("");
          try {
            const amount = Number(journalAmount);
            await budgetApi.postJournal({
              budget_line_id: Number(journalLineId),
              memo: journalMemo,
              source_module: "manual",
              debit: amount,
              credit: amount,
            });
            setJournalMsg(t("budget.home.journalPostedMsg"));
            toast.success(t("budget.home.journalPosted"));
          } catch (err) {
            const message = t("budget.home.journalFailed");
            setJournalMsg(message);
            toast.error(t("budget.home.journalNotPosted"), apiErrorMessage(err, message));
          }
        }}
      >
        <h2 className="text-lg font-semibold text-neutral-800">{t("budget.home.journalTitle")}</h2>
        <p className="text-neutral-600">{t("budget.home.journalHint")}</p>
        <div className="flex flex-wrap gap-3">
          <select
            className="form-input min-w-[16rem]"
            value={journalLineId}
            data-testid="budget-journal-line"
            onChange={(e) => setJournalLineId(e.target.value)}
            required
          >
            <option value="">{t("budget.journal.line")}</option>
            {lines.map((line) => (
              <option key={line.id} value={String(line.id)}>
                {line.code ?? `BL-${line.id}`} — {line.name ?? line.category}
              </option>
            ))}
          </select>
          <input className="form-input w-40" placeholder={t("budget.home.amount")} value={journalAmount} onChange={(e) => setJournalAmount(e.target.value)} />
          <input className="form-input min-w-[12rem] flex-1" placeholder={t("budget.home.memo")} value={journalMemo} onChange={(e) => setJournalMemo(e.target.value)} />
          <button type="submit" className="btn-primary">{t("budget.home.postJournal")}</button>
        </div>
        {journalMsg ? <p className="text-xs text-neutral-600">{journalMsg}</p> : null}
      </form>

      <div className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-800">{t("budget.home.activeLines")}</h2>
          <input
            className="form-input max-w-xs"
            placeholder={t("budget.home.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.code")}</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.name")}</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.category")}</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.approved")}</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.actual")}</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.committed")}</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-500">{t("budget.home.col.available")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    <span className="material-symbols-outlined animate-spin text-primary">autorenew</span>
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <TableEmpty colSpan={7} title={t("budget.home.empty")} />
              ) : (
                lines.map((line, idx) => {
                  const avail = availabilityById[line.id];
                  const wasChecked = idx < 40;
                  return (
                    <tr key={line.id} className="hover:bg-neutral-50/50">
                      <td className="font-mono text-sm">{line.code ?? `BL-${line.id}`}</td>
                      <td className="font-medium text-neutral-900">{line.name ?? line.category}</td>
                      <td className="capitalize text-neutral-600">{line.category}</td>
                      <td className="text-right">{avail ? money(avail.approved) : money(Number(line.amount_allocated ?? 0))}</td>
                      <td className="text-right">{avail ? money(avail.actual) : "—"}</td>
                      <td className="text-right">{avail ? money(avail.commitments) : "—"}</td>
                      <td className={`text-right font-semibold ${avail && avail.available < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {avail ? money(avail.available) : wasChecked ? "…" : (
                          <span className="text-xs font-normal italic text-neutral-400">{t("budget.home.notLoaded")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
