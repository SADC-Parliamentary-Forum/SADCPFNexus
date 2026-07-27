"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  budgetApi,
  type CashflowForecast,
  type CashflowScenario,
} from "@/lib/api";

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetCashflowPage() {
  const qc = useQueryClient();
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
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: () => setFormError("Could not create scenario. Finance write access is required."),
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
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: () => setFormError("Could not add adjustment."),
  });

  const deleteAdjustment = useMutation({
    mutationFn: (adjustmentId: number) =>
      budgetApi.deleteCashflowAdjustment(Number(scenarioId), adjustmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", "cashflow"] }),
  });

  const forecast = forecastQuery.data as CashflowForecast | undefined;
  const adjustments = scenarioDetailQuery.data?.adjustments ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Cashflow / scenarios</h1>
          <p className="page-subtitle">
            Monthly liquidity forecast from budget actuals and open commitments, with optional scenario overlays.
            Opening balances are Finance assumptions — Nexus does not replace the GL or bank ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/budget/reports" className="btn-secondary text-sm">
            Budget reports
          </Link>
          <Link href="/budget" className="btn-secondary text-sm">
            Budget control
          </Link>
        </div>
      </div>

      <div className="card grid gap-4 p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Financial year</label>
          <select
            className="form-input"
            value={effectiveFyId}
            onChange={(e) => {
              setFinancialYearId(e.target.value);
              setScenarioId("");
            }}
          >
            {years.length === 0 && <option value="">No financial years</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label || y.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Scenario overlay</label>
          <select
            className="form-input"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            <option value="">None (actuals + commitments only)</option>
            {(scenariosQuery.data ?? []).map((s: CashflowScenario) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind}) — open {money(Number(s.opening_balance))}
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
          <h2 className="text-base font-semibold text-neutral-900">Create scenario</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
              <input
                className="form-input"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Base liquidity"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Kind</label>
              <select
                className="form-input"
                value={createForm.kind}
                onChange={(e) => setCreateForm((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="base">Base</option>
                <option value="optimistic">Optimistic</option>
                <option value="pessimistic">Pessimistic</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Opening balance</label>
              <input
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
            {createScenario.isPending ? "Creating…" : "Create scenario"}
          </button>
        </div>

        <div className="card space-y-3 p-4">
          <h2 className="text-base font-semibold text-neutral-900">Add adjustment</h2>
          {!scenarioId ? (
            <p className="text-sm text-neutral-600">Select a scenario to add inflow/outflow adjustments by month.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Period (YYYY-MM)</label>
                  <input
                    className="form-input"
                    value={adjForm.period}
                    onChange={(e) => setAdjForm((f) => ({ ...f, period: e.target.value }))}
                    placeholder="2026-07"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Direction</label>
                  <select
                    className="form-input"
                    value={adjForm.direction}
                    onChange={(e) => setAdjForm((f) => ({ ...f, direction: e.target.value }))}
                  >
                    <option value="inflow">Inflow</option>
                    <option value="outflow">Outflow</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Amount</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Label</label>
                  <input
                    className="form-input"
                    value={adjForm.label}
                    onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Member contribution"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={!adjForm.period || !adjForm.amount || addAdjustment.isPending}
                onClick={() => addAdjustment.mutate()}
              >
                {addAdjustment.isPending ? "Saving…" : "Add adjustment"}
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
                        className="text-red-700 hover:underline"
                        onClick={() => deleteAdjustment.mutate(a.id)}
                      >
                        Remove
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
            <h2 className="text-base font-semibold text-neutral-900">Monthly forecast</h2>
            <p className="text-sm text-neutral-600">
              Opening {money(Number(forecast?.opening_balance ?? 0))}
              {selectedScenario ? ` · Scenario: ${selectedScenario.name}` : " · No scenario"}
              {forecast?.as_of ? ` · As of ${forecast.as_of}` : ""}
            </p>
          </div>
          {forecast?.totals && (
            <div className="text-sm text-neutral-700">
              Closing <span className="font-semibold">{money(Number(forecast.totals.closing_balance))}</span>
            </div>
          )}
        </div>

        {forecastQuery.isLoading && <p className="text-sm text-neutral-600">Loading forecast…</p>}
        {forecastQuery.isError && (
          <p className="text-sm text-red-700">Failed to load forecast. Check financial year selection.</p>
        )}

        {forecast && (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium text-right">Actual out</th>
                <th className="py-2 pr-3 font-medium text-right">Projected out</th>
                <th className="py-2 pr-3 font-medium text-right">Scenario in</th>
                <th className="py-2 pr-3 font-medium text-right">Scenario out</th>
                <th className="py-2 pr-3 font-medium text-right">Net</th>
                <th className="py-2 font-medium text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {forecast.periods.map((p) => (
                <tr key={p.period} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3 font-medium">{p.period}</td>
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
                <td className="py-2 pr-3">Totals</td>
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
            {forecast.out_of_range_projected.count} projected commitment(s) totaling{" "}
            {money(forecast.out_of_range_projected.amount)} fall outside the FY window.
          </p>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Projected commitment items</h2>
        {!forecast?.items?.length ? (
          <p className="text-sm text-neutral-600">No open commitments projected for this year.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Expected cash</th>
                <th className="py-2 pr-3 font-medium">Line</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Resolution</th>
                <th className="py-2 font-medium text-right">Amount</th>
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
    </div>
  );
}
