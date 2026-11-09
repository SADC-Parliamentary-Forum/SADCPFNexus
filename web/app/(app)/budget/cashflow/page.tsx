"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  budgetApi,
  type CashflowForecast,
  type CashflowScenario,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetCashflowPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [financialYearId, setFinancialYearId] = useState<string>("");
  const [scenarioId, setScenarioId] = useState<string>("");
  const [createForm, setCreateForm] = useState({
    name: "",
    kind: "base",
    opening_balance: "0",
    status: "active",
  });
  const [adjForm, setAdjForm] = useState({
    period: "",
    direction: "inflow",
    amount: "",
    label: "",
  });
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [inflowForm, setInflowForm] = useState({
    source_type: "membership",
    label: "",
    period: "",
    amount: "",
    status: "planned",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const yearsQuery = useQuery({
    queryKey: ["budget", "financial-years"],
    queryFn: () =>
      budgetApi.financialYears().then((r) => (r.data.data ?? []) as Array<{ id: number; code: string; label: string }>),
  });

  const years = yearsQuery.data ?? [];
  const effectiveFyId = financialYearId || (years[0] ? String(years[0].id) : "");

  const scenariosQuery = useQuery({
    queryKey: ["budget", "cashflow", "scenarios", effectiveFyId],
    enabled: !!effectiveFyId,
    queryFn: () =>
      budgetApi
        .cashflowScenarios({ financial_year_id: Number(effectiveFyId) })
        .then((r) => r.data.data ?? []),
  });

  const forecastQuery = useQuery({
    queryKey: ["budget", "cashflow", "forecast", effectiveFyId, scenarioId],
    enabled: !!effectiveFyId,
    queryFn: () => {
      const params: Record<string, string | number | boolean> = {
        financial_year_id: Number(effectiveFyId),
      };
      if (scenarioId) params.scenario_id = Number(scenarioId);
      return budgetApi.cashflowForecast(params).then((r) => r.data.data);
    },
  });

  const selectedScenario = useMemo(() => {
    if (!scenarioId) return null;
    return (scenariosQuery.data ?? []).find((s) => String(s.id) === scenarioId) ?? null;
  }, [scenarioId, scenariosQuery.data]);

  const scenarioDetailQuery = useQuery({
    queryKey: ["budget", "cashflow", "scenario", scenarioId],
    enabled: !!scenarioId,
    queryFn: () => budgetApi.getCashflowScenario(Number(scenarioId)).then((r) => r.data.data),
  });

  const createScenario = useMutation({
    mutationFn: () =>
      budgetApi.createCashflowScenario({
        financial_year_id: Number(effectiveFyId),
        name: createForm.name,
        kind: createForm.kind,
        opening_balance: Number(createForm.opening_balance || 0),
        status: createForm.status,
        currency: "NAD",
      }),
    onSuccess: (res) => {
      setFormError(null);
      setCreateForm({ name: "", kind: "base", opening_balance: "0", status: "active" });
      setScenarioId(String(res.data.data.id));
      toast.success(t("budget.cashflow.scenarioCreated"));
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: (err) => {
      const message = t("budget.cashflow.scenarioCreateFailed");
      setFormError(message);
      toast.error(t("budget.cashflow.scenarioNotCreated"), apiErrorMessage(err, message));
    },
  });

  const addAdjustment = useMutation({
    mutationFn: () =>
      budgetApi.addCashflowAdjustment(Number(scenarioId), {
        period: adjForm.period,
        direction: adjForm.direction,
        amount: Number(adjForm.amount),
        label: adjForm.label || undefined,
      }),
    onSuccess: () => {
      setFormError(null);
      setAdjForm({ period: "", direction: "inflow", amount: "", label: "" });
      toast.success(t("budget.cashflow.adjustmentAdded"));
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: (err) => {
      setFormError(t("budget.cashflow.adjustmentFailed"));
      toast.error(t("budget.cashflow.adjustmentNotAdded"), apiErrorMessage(err, t("budget.cashflow.adjustmentFailed")));
    },
  });

  const deleteAdjustment = useMutation({
    mutationFn: (adjustmentId: number) =>
      budgetApi.deleteCashflowAdjustment(Number(scenarioId), adjustmentId),
    onSuccess: () => {
      toast.success(t("budget.cashflow.adjustmentDeleted"));
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: (err) => toast.error(t("budget.cashflow.adjustmentNotDeleted"), apiErrorMessage(err, t("budget.cashflow.adjustmentDeleteFailed"))),
  });

  const inflowsQuery = useQuery({
    queryKey: ["budget", "cashflow", "inflows", effectiveFyId],
    enabled: !!effectiveFyId,
    queryFn: () =>
      budgetApi.cashflowInflows({ financial_year_id: Number(effectiveFyId) }).then((r) => r.data.data ?? []),
  });

  const compareQuery = useQuery({
    queryKey: ["budget", "cashflow", "compare", effectiveFyId, compareIds.join(",")],
    enabled: !!effectiveFyId && compareIds.length >= 2,
    queryFn: () =>
      budgetApi
        .cashflowCompare({
          financial_year_id: Number(effectiveFyId),
          scenario_ids: compareIds.map(Number),
        })
        .then((r) => r.data.data),
  });

  const createInflow = useMutation({
    mutationFn: () =>
      budgetApi.createCashflowInflow({
        financial_year_id: Number(effectiveFyId),
        source_type: inflowForm.source_type,
        label: inflowForm.label,
        period: inflowForm.period,
        amount: Number(inflowForm.amount),
        status: inflowForm.status,
        currency: "NAD",
      }),
    onSuccess: () => {
      setFormError(null);
      setInflowForm({ source_type: "membership", label: "", period: "", amount: "", status: "planned" });
      toast.success(t("budget.cashflow.inflowCreated"));
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: (err) => {
      setFormError(t("budget.cashflow.inflowFailed"));
      toast.error(t("budget.cashflow.inflowNotCreated"), apiErrorMessage(err, t("budget.cashflow.inflowFailed")));
    },
  });

  const generateBands = useMutation({
    mutationFn: async () => {
      const source = scenarioDetailQuery.data;
      if (!source) throw new Error(t("budget.cashflow.selectScenarioFirst"));
      const opening = Number(source.opening_balance || 0);
      const adjustments = source.adjustments ?? [];
      for (const spec of [
        { kind: "optimistic" as const, factor: 1.2, label: "Optimistic" },
        { kind: "pessimistic" as const, factor: 0.8, label: "Pessimistic" },
      ]) {
        const created = await budgetApi.createCashflowScenario({
          financial_year_id: source.financial_year_id,
          name: `${source.name} (${spec.label})`,
          kind: spec.kind === "optimistic" ? "optimistic" : "pessimistic",
          opening_balance: Number((opening * spec.factor).toFixed(2)),
          status: "active",
          currency: source.currency ?? "NAD",
        });
        const id = created.data.data.id;
        for (const adj of adjustments) {
          await budgetApi.addCashflowAdjustment(id, {
            period: adj.period,
            direction: adj.direction,
            amount: Number((Number(adj.amount) * spec.factor).toFixed(2)),
            label: adj.label ?? undefined,
            category: adj.category ?? undefined,
          });
        }
      }
    },
    onSuccess: () => {
      setFormError(null);
      toast.success(t("budget.cashflow.overlaysGenerated"), t("budget.cashflow.overlaysGeneratedBody"));
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: (err) => {
      const message = t("budget.cashflow.overlaysFailed");
      setFormError(message);
      toast.error(t("budget.cashflow.overlaysNotGenerated"), apiErrorMessage(err, message));
    },
  });

  const forecast = forecastQuery.data as CashflowForecast | undefined;
  const adjustments = scenarioDetailQuery.data?.adjustments ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="budget.cashflow.title"
        subtitle="budget.cashflow.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.cashflow.title" }]} />}
      />
        <div className="flex flex-wrap items-center gap-2">
          {effectiveFyId && (
            <a
              className="btn-secondary text-sm"
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}${budgetApi.cashflowForecastExportUrl({
                financial_year_id: Number(effectiveFyId),
                ...(scenarioId ? { scenario_id: Number(scenarioId) } : {}),
              })}`}
            >
              {t("budget.cashflow.exportCsv")}
            </a>
          )}
          <Link href="/budget/reports" className="btn-secondary text-sm">
            {t("budget.reports.title")}
          </Link>
          <Link href="/budget" className="btn-secondary text-sm">
            {t("budget.variance.budgetControl")}
          </Link>
        </div>
      </div>

      <div className="card grid gap-4 p-4 md:grid-cols-2">
        <div>
          <label htmlFor="budget-cashflow-financial-year" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cycles.financialYear")}</label>
          <select id="budget-cashflow-financial-year"
            className="form-input"
            value={effectiveFyId}
            onChange={(e) => {
              setFinancialYearId(e.target.value);
              setScenarioId("");
            }}
          >
            {years.length === 0 && <option value="">{t("budget.cashflow.noFinancialYears")}</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label || y.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="budget-cashflow-scenario-overlay" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.scenarioOverlay")}</label>
          <select id="budget-cashflow-scenario-overlay"
            className="form-input"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            <option value="">{t("budget.cashflow.noOverlay")}</option>
            {(scenariosQuery.data ?? []).map((s: CashflowScenario) => (
              <option key={s.id} value={s.id}>
                {t("budget.cashflow.scenarioOption", { name: s.name, kind: s.kind, amount: money(Number(s.opening_balance)) })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h2 className="text-base font-semibold text-neutral-900">{t("budget.cashflow.createScenario")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="budget-cashflow-name" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.reports.col.name")}</label>
              <input id="budget-cashflow-name"
                className="form-input"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("budget.cashflow.namePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="budget-cashflow-kind" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.kind")}</label>
              <select id="budget-cashflow-kind"
                className="form-input"
                value={createForm.kind}
                onChange={(e) => setCreateForm((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="base">{t("budget.cashflow.kind.base")}</option>
                <option value="optimistic">{t("budget.cashflow.kind.optimistic")}</option>
                <option value="pessimistic">{t("budget.cashflow.kind.pessimistic")}</option>
                <option value="custom">{t("budget.cashflow.kind.custom")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="budget-cashflow-opening-balance" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.openingBalance")}</label>
              <input id="budget-cashflow-opening-balance"
                className="form-input"
                type="number"
                step="0.01"
                value={createForm.opening_balance}
                onChange={(e) => setCreateForm((f) => ({ ...f, opening_balance: e.target.value }))}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!effectiveFyId || !createForm.name || createScenario.isPending}
            onClick={() => createScenario.mutate()}
          >
            {createScenario.isPending ? t("budget.cashflow.creating") : t("budget.cashflow.createScenario")}
          </button>
          <div data-testid="cashflow-generate-bands" className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm text-neutral-600">
              {t("budget.cashflow.generateHint")}
            </p>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={!scenarioId || generateBands.isPending}
              onClick={() => generateBands.mutate()}
            >
              {generateBands.isPending ? t("budget.cashflow.generating") : t("budget.cashflow.generate")}
            </button>
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <h2 className="text-base font-semibold text-neutral-900">{t("budget.cashflow.addAdjustment")}</h2>
          {!scenarioId ? (
            <p className="text-sm text-neutral-600">{t("budget.cashflow.selectScenarioHint")}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="budget-cashflow-period-yyyy-mm" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.periodLabel")}</label>
                  <input id="budget-cashflow-period-yyyy-mm"
                    className="form-input"
                    value={adjForm.period}
                    onChange={(e) => setAdjForm((f) => ({ ...f, period: e.target.value }))}
                    placeholder="2026-07"
                  />
                </div>
                <div>
                  <label htmlFor="budget-cashflow-direction" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.direction")}</label>
                  <select id="budget-cashflow-direction"
                    className="form-input"
                    value={adjForm.direction}
                    onChange={(e) => setAdjForm((f) => ({ ...f, direction: e.target.value }))}
                  >
                    <option value="inflow">{t("budget.cashflow.inflow")}</option>
                    <option value="outflow">{t("budget.cashflow.outflow")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="budget-cashflow-amount" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.amount")}</label>
                  <input id="budget-cashflow-amount"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="budget-cashflow-label" className="mb-1 block text-sm font-medium text-neutral-700">{t("budget.cashflow.label")}</label>
                  <input id="budget-cashflow-label"
                    className="form-input"
                    value={adjForm.label}
                    onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder={t("budget.cashflow.labelPlaceholder")}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={!adjForm.period || !adjForm.amount || addAdjustment.isPending}
                onClick={() => addAdjustment.mutate()}
              >
                {addAdjustment.isPending ? t("budget.cashflow.saving") : t("budget.cashflow.addAdjustment")}
              </button>
              {adjustments.length > 0 && (
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {a.period} · {a.direction} · {money(Number(a.amount))}
                        {a.label ? ` — ${a.label}` : ""}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1 px-2 text-red-700"
                        onClick={() => deleteAdjustment.mutate(a.id)}
                      >
                        {t("budget.cashflow.remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{t("budget.cashflow.monthlyForecast")}</h2>
            <p className="text-sm text-neutral-600">
              {t("budget.cashflow.opening", { amount: money(Number(forecast?.opening_balance ?? 0)) })}
              {selectedScenario ? t("budget.cashflow.scenarioSuffix", { name: selectedScenario.name }) : t("budget.cashflow.noScenarioSuffix")}
              {forecast?.as_of ? t("budget.cashflow.asOfSuffix", { date: forecast.as_of }) : ""}
            </p>
          </div>
          {forecast?.totals && (
            <div className="text-sm text-neutral-700">
              {t("budget.cashflow.closing")} <span className="font-semibold">{money(Number(forecast.totals.closing_balance))}</span>
            </div>
          )}
        </div>

        {forecast && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">{t("budget.cashflow.netMovement")}</p>
              <p className={`text-lg font-bold ${Number(forecast.totals.closing_balance) - Number(forecast.opening_balance) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {money(Number(forecast.totals.closing_balance) - Number(forecast.opening_balance))}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">{t("budget.cashflow.lowestLiquidity")}</p>
              {(() => {
                const minBalance = Math.min(...forecast.periods.map((p) => Number(p.closing_balance)));
                const isRisk = minBalance < 0;
                return (
                  <p className={`text-lg font-bold ${isRisk ? "text-red-700" : "text-emerald-700"}`}>
                    {money(minBalance)} {isRisk && t("budget.cashflow.deficitRisk")}
                  </p>
                );
              })()}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">{t("budget.cashflow.overlayImpact")}</p>
              <p className="text-lg font-bold text-indigo-700">
                {t("budget.cashflow.inOut", { inflow: money(Number(forecast.totals.scenario_inflow)), outflow: money(Number(forecast.totals.scenario_outflow)) })}
              </p>
            </div>
          </div>
        )}

        {forecast && forecast.periods.length > 0 && (
          <div data-testid="cashflow-period-chart" className="mb-4">
            <p className="mb-2 text-xs font-medium text-neutral-500">{t("budget.cashflow.closingByPeriod")}</p>
            <div className="flex h-40 items-end gap-1">
              {forecast.periods.map((p) => {
                const values = forecast.periods.map((x) => Math.abs(Number(x.closing_balance)));
                const max = Math.max(...values, 1);
                const closing = Number(p.closing_balance);
                const h = Math.max(4, (Math.abs(closing) / max) * 100);
                return (
                  <div
                    key={p.period}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${p.period}: ${money(closing)}`}
                  >
                    <div
                      className={`w-full rounded-t ${closing < 0 ? "bg-red-400" : "bg-emerald-500"}`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="mt-1 w-full truncate text-center text-[9px] text-neutral-500">
                      {p.period.length > 7 ? p.period.slice(5) : p.period}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {forecastQuery.isLoading && <p className="text-sm text-neutral-600">{t("budget.cashflow.loadingForecast")}</p>}
        {forecastQuery.isError && (
          <p className="text-sm text-red-700">{t("budget.cashflow.forecastFailed")}</p>
        )}

        {forecast && (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">{t("budget.cashflow.col.period")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.structuredIn")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.actualOut")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.projectedOut")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.scenarioIn")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.scenarioOut")}</th>
                <th className="py-2 pr-3 font-medium text-right">{t("budget.cashflow.col.net")}</th>
                <th className="py-2 font-medium text-right">{t("budget.cashflow.closing")}</th>
              </tr>
            </thead>
            <tbody>
              {forecast.periods.map((p) => (
                <tr key={p.period} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3 font-medium">{p.period}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.structured_inflow ?? 0)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.actual_outflow)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.projected_outflow)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.scenario_inflow)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.scenario_outflow)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money(p.net)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{money(p.closing_balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-3">{t("budget.cashflow.totals")}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(forecast.totals.structured_inflow ?? 0)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(forecast.totals.actual_outflow)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(forecast.totals.projected_outflow)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(forecast.totals.scenario_inflow)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(forecast.totals.scenario_outflow)}</td>
                <td className="py-2 pr-3 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{money(forecast.totals.closing_balance)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {forecast && forecast.out_of_range_projected.count > 0 && (
          <p className="mt-3 text-sm text-amber-800">
            {t("budget.cashflow.outOfRange", { count: forecast.out_of_range_projected.count, amount: money(forecast.out_of_range_projected.amount) })}
          </p>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">{t("budget.cashflow.projectedItems")}</h2>
        {!forecast?.items?.length ? (
          <p className="text-sm text-neutral-600">{t("budget.cashflow.noProjected")}</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">{t("budget.cashflow.col.period")}</th>
                <th className="py-2 pr-3 font-medium">{t("budget.cashflow.col.expectedCash")}</th>
                <th className="py-2 pr-3 font-medium">{t("budget.changeCreate.line")}</th>
                <th className="py-2 pr-3 font-medium">{t("budget.fx.source")}</th>
                <th className="py-2 pr-3 font-medium">{t("budget.cashflow.col.resolution")}</th>
                <th className="py-2 font-medium text-right">{t("budget.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {forecast.items.map((item) => (
                <tr key={item.budget_reservation_id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3">{item.period}</td>
                  <td className="py-2 pr-3">{item.expected_cash_date?.slice(0, 10)}</td>
                  <td className="py-2 pr-3">
                    {item.budget_line_code || "—"} {item.budget_line_name ? `· ${item.budget_line_name}` : ""}
                  </td>
                  <td className="py-2 pr-3">
                    {item.source_type}
                    {item.source_key ? ` (${item.source_key})` : ""}
                  </td>
                  <td className="py-2 pr-3 text-neutral-600">{item.resolution || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-neutral-900">{t("budget.cashflow.inflowsTitle")}</h2>
        <p className="text-sm text-neutral-600">{t("budget.cashflow.inflowsHint")}</p>
        <div className="grid gap-3 md:grid-cols-5">
          <select className="form-input" aria-label={t("budget.fx.source")} value={inflowForm.source_type} onChange={(e) => setInflowForm((f) => ({ ...f, source_type: e.target.value }))}>
            <option value="membership">{t("budget.cashflow.source.membership")}</option>
            <option value="donor">{t("budget.cashflow.source.donor")}</option>
            <option value="other">{t("budget.cashflow.source.other")}</option>
          </select>
          <input className="form-input" placeholder={t("budget.cashflow.label")} value={inflowForm.label} onChange={(e) => setInflowForm((f) => ({ ...f, label: e.target.value }))} />
          <input className="form-input" placeholder={t("budget.cashflow.periodPlaceholder")} value={inflowForm.period} onChange={(e) => setInflowForm((f) => ({ ...f, period: e.target.value }))} />
          <input className="form-input" type="number" placeholder={t("budget.amount")} value={inflowForm.amount} onChange={(e) => setInflowForm((f) => ({ ...f, amount: e.target.value }))} />
          <button type="button" className="btn-primary text-sm" disabled={!inflowForm.label || !inflowForm.period || !inflowForm.amount || createInflow.isPending} onClick={() => createInflow.mutate()}>
            {t("budget.cashflow.addInflow")}
          </button>
        </div>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {(inflowsQuery.data ?? []).map((row) => (
            <li key={row.id} className="flex justify-between gap-2 py-2">
              <span>{row.period} · {row.source_type} · {row.label} · {money(Number(row.amount))} ({row.status})</span>
            </li>
          ))}
          {(inflowsQuery.data ?? []).length === 0 && <li className="py-2 text-neutral-400">{t("budget.cashflow.noInflows")}</li>}
        </ul>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-neutral-900">{t("budget.cashflow.compareTitle")}</h2>
        <p className="text-sm text-neutral-600">{t("budget.cashflow.compareHint")}</p>
        <div className="flex flex-wrap gap-3">
          {(scenariosQuery.data ?? []).map((s: CashflowScenario) => {
            const checked = compareIds.includes(String(s.id));
            return (
              <label htmlFor={`budget-cashflow-compare-${s.id}`} key={s.id} className="flex items-center gap-2 text-sm">
                <input id={`budget-cashflow-compare-${s.id}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setCompareIds((prev) =>
                      checked ? prev.filter((id) => id !== String(s.id)) : [...prev, String(s.id)].slice(0, 5),
                    )
                  }
                />
                {s.name}
              </label>
            );
          })}
        </div>
        {compareQuery.data && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2 text-left">{t("budget.cashflow.col.period")}</th>
                  {compareQuery.data.scenarios.map((s) => (
                    <th key={s.id} className="py-2 text-right">{t("budget.cashflow.scenarioClosing", { name: s.name })}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareQuery.data.periods.map((row) => (
                  <tr key={row.period} className="border-t border-[var(--border)]">
                    <td className="py-2">{row.period}</td>
                    {compareQuery.data!.scenarios.map((s) => (
                      <td key={s.id} className="py-2 text-right tabular-nums">
                        {money(Number(row.scenarios[String(s.id)]?.closing_balance ?? 0))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
