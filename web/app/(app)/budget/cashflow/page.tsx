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
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: () => setFormError("Could not create structured inflow."),
  });

  const generateBands = useMutation({
    mutationFn: async () => {
      const source = scenarioDetailQuery.data;
      if (!source) throw new Error("Select a scenario first");
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
      qc.invalidateQueries({ queryKey: ["budget", "cashflow"] });
    },
    onError: () =>
      setFormError("Could not generate optimistic/pessimistic overlays. Select a source scenario first."),
  });

  const forecast = forecastQuery.data as CashflowForecast | undefined;
  const adjustments = scenarioDetailQuery.data?.adjustments ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="Cashflow / scenarios"
        subtitle="Monthly liquidity forecast from budget actuals and open commitments, with optional scenario overlays. Opening balances are Finance assumptions — not bank-confirmed cash."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Cashflow / scenarios" }]} />}
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
              Export CSV
            </a>
          )}
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
          <div data-testid="cashflow-generate-bands" className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm text-neutral-600">
              Generate optimistic (+20%) and pessimistic (−20%) overlays from the selected scenario.
              Opening balance and overlay adjustments are scaled; FX projection stays a Finance assumption, not a live vendor feed.
            </p>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={!scenarioId || generateBands.isPending}
              onClick={() => generateBands.mutate()}
            >
              {generateBands.isPending ? "Generating…" : "Generate optimistic / pessimistic"}
            </button>
          </div>
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

        {forecast && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">Net FY Cash Movement</p>
              <p className={`text-lg font-bold ${Number(forecast.totals.closing_balance) - Number(forecast.opening_balance) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {money(Number(forecast.totals.closing_balance) - Number(forecast.opening_balance))}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">Lowest Monthly Liquidity</p>
              {(() => {
                const minBalance = Math.min(...forecast.periods.map((p) => Number(p.closing_balance)));
                const isRisk = minBalance < 0;
                return (
                  <p className={`text-lg font-bold ${isRisk ? "text-red-700" : "text-emerald-700"}`}>
                    {money(minBalance)} {isRisk && "⚠️ (Deficit Risk)"}
                  </p>
                );
              })()}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500 font-medium">Scenario Overlay Impact</p>
              <p className="text-lg font-bold text-indigo-700">
                In: {money(Number(forecast.totals.scenario_inflow))} | Out: {money(Number(forecast.totals.scenario_outflow))}
              </p>
            </div>
          </div>
        )}

        {forecast && forecast.periods.length > 0 && (
          <div data-testid="cashflow-period-chart" className="mb-4">
            <p className="mb-2 text-xs font-medium text-neutral-500">Closing balance by period</p>
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

        {forecastQuery.isLoading && <p className="text-sm text-neutral-600">Loading forecast…</p>}
        {forecastQuery.isError && (
          <p className="text-sm text-red-700">Failed to load forecast. Check financial year selection.</p>
        )}

        {forecast && (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium text-right">Structured in</th>
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
                <td className="py-2 pr-3">Totals</td>
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

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-neutral-900">Structured membership / donor inflows</h2>
        <p className="text-sm text-neutral-600">Planned receipts outside scenario overlays (membership contributions, donor tranches).</p>
        <div className="grid gap-3 md:grid-cols-5">
          <select className="form-input" value={inflowForm.source_type} onChange={(e) => setInflowForm((f) => ({ ...f, source_type: e.target.value }))}>
            <option value="membership">Membership</option>
            <option value="donor">Donor</option>
            <option value="other">Other</option>
          </select>
          <input className="form-input" placeholder="Label" value={inflowForm.label} onChange={(e) => setInflowForm((f) => ({ ...f, label: e.target.value }))} />
          <input className="form-input" placeholder="YYYY-MM" value={inflowForm.period} onChange={(e) => setInflowForm((f) => ({ ...f, period: e.target.value }))} />
          <input className="form-input" type="number" placeholder="Amount" value={inflowForm.amount} onChange={(e) => setInflowForm((f) => ({ ...f, amount: e.target.value }))} />
          <button type="button" className="btn-primary text-sm" disabled={!inflowForm.label || !inflowForm.period || !inflowForm.amount || createInflow.isPending} onClick={() => createInflow.mutate()}>
            Add inflow
          </button>
        </div>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {(inflowsQuery.data ?? []).map((row) => (
            <li key={row.id} className="flex justify-between gap-2 py-2">
              <span>{row.period} · {row.source_type} · {row.label} · {money(Number(row.amount))} ({row.status})</span>
            </li>
          ))}
          {(inflowsQuery.data ?? []).length === 0 && <li className="py-2 text-neutral-400">No structured inflows yet.</li>}
        </ul>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold text-neutral-900">Scenario compare</h2>
        <p className="text-sm text-neutral-600">Select 2–5 scenarios for side-by-side closing balances.</p>
        <div className="flex flex-wrap gap-3">
          {(scenariosQuery.data ?? []).map((s: CashflowScenario) => {
            const checked = compareIds.includes(String(s.id));
            return (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
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
                  <th className="py-2 text-left">Period</th>
                  {compareQuery.data.scenarios.map((s) => (
                    <th key={s.id} className="py-2 text-right">{s.name} closing</th>
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
