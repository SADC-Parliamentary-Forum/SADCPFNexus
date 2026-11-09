"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { travelApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { TableEmpty } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type DsaRate = {
  id: number;
  country: string;
  city?: string | null;
  rate_type: number;
  rate_per_day: number;
  currency: string;
  accommodation_component?: number | null;
  meal_component?: number | null;
  incidentals_component?: number | null;
  effective_from?: string | null;
  is_active: boolean;
};

type FxRate = {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  notes?: string | null;
};

type SponsoredRate = {
  id?: number;
  name?: string;
  code?: string;
  meal_deduction_percent?: number;
  accommodation_deduction_percent?: number;
  is_active?: boolean;
};

/** i18n keys of the DSA rate type labels. */
const RATE_TYPE_LABELS: Record<number, string> = {
  1: "travel.settings.rateType1",
  2: "travel.settings.rateType2",
  3: "travel.settings.rateType3",
};

function localIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const defaultDsaForm = () => ({
  country: "Namibia",
  city: "",
  rate_type: 1,
  rate_per_day: 100,
  currency: "USD",
  accommodation_component: 60,
  meal_component: 30,
  incidentals_component: 10,
  effective_from: localIso(),
  is_active: true,
});

const defaultFxForm = () => ({
  from_currency: "USD",
  to_currency: "NAD",
  rate: 18.5,
  effective_date: localIso(),
  notes: "",
});

const defaultSponsoredForm = {
  name: "Host meals provided",
  code: "host_meals",
  meal_deduction_percent: 40,
  accommodation_deduction_percent: 0,
  is_active: true,
};

const nonNegativeNumber = (value: string) => Math.max(0, Number(value));

const componentSummary = (rate: DsaRate, t: (key: string, vars?: Record<string, string | number>) => string) => {
  const parts = [
    rate.accommodation_component != null ? t("travel.settings.compAcc", { value: rate.accommodation_component }) : null,
    rate.meal_component != null ? t("travel.settings.compMeals", { value: rate.meal_component }) : null,
    rate.incidentals_component != null ? t("travel.settings.compInc", { value: rate.incidentals_component }) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
};

function SettingsTable({
  caption,
  columns,
  empty,
  children,
}: {
  caption: string;
  columns: number;
  empty: { icon: string; title: string; description: string };
  children: ReactNode;
}) {
  const hasRows = Boolean(children);
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="data-table w-full">
        <caption className="sr-only">{caption}</caption>
        {hasRows ? (
          children
        ) : (
          <tbody>
            <TableEmpty colSpan={columns} icon={empty.icon} title={empty.title} description={empty.description} />
          </tbody>
        )}
      </table>
    </div>
  );
}

export default function TravelSettingsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [rates, setRates] = useState<DsaRate[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [sponsoredRates, setSponsoredRates] = useState<SponsoredRate[]>([]);
  const [form, setForm] = useState(defaultDsaForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fxForm, setFxForm] = useState(defaultFxForm);
  const [sponsoredForm, setSponsoredForm] = useState({ ...defaultSponsoredForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"dsa" | "fx" | "sponsored" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const [dsaRes, fxRes, sponsoredRes] = await Promise.all([
        travelApi.listDsaRates({ per_page: 100 }),
        travelApi.listFxRates({ per_page: 100 }).catch(() => ({ data: { data: [] as FxRate[] } })),
        travelApi.listSponsoredRates().catch(() => ({ data: { data: [] as SponsoredRate[] } })),
      ]);
      setRates((dsaRes.data.data as DsaRate[]) ?? []);
      setFxRates((fxRes.data.data as FxRate[]) ?? []);
      setSponsoredRates((sponsoredRes.data.data as SponsoredRate[]) ?? []);
    } catch {
      setError(t("travel.settings.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setForm(defaultDsaForm());
    setEditingId(null);
  };

  const startEdit = (rate: DsaRate) => {
    setEditingId(rate.id);
    setForm({
      country: rate.country,
      city: rate.city ?? "",
      rate_type: rate.rate_type,
      rate_per_day: Number(rate.rate_per_day),
      currency: rate.currency,
      accommodation_component: Number(rate.accommodation_component ?? 0),
      meal_component: Number(rate.meal_component ?? 0),
      incidentals_component: Number(rate.incidentals_component ?? 0),
      effective_from: rate.effective_from ? String(rate.effective_from).slice(0, 10) : localIso(),
      is_active: rate.is_active,
    });
    setSuccess(null);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving("dsa");
    setError(null);
    setSuccess(null);
    try {
      await travelApi.saveDsaRate({
        ...form,
        ...(editingId ? { id: editingId } : {}),
      });
      setSuccess(editingId ? t("travel.settings.dsaUpdatedMsg") : t("travel.settings.dsaSavedMsg"));
      toast.success(editingId ? t("travel.settings.dsaUpdated") : t("travel.settings.dsaSaved"));
      await load({ quiet: true });
      resetForm();
    } catch (err) {
      const message = apiErrorMessage(err, t("travel.settings.dsaSaveFailed"));
      setError(message);
      toast.error(t("travel.settings.dsaNotSaved"), message);
    } finally {
      setSaving(null);
    }
  };

  const onFxSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving("fx");
    setError(null);
    setSuccess(null);
    try {
      await travelApi.saveFxRate({ ...fxForm, source: "manual" });
      setSuccess(t("travel.settings.fxSavedMsg"));
      toast.success(t("travel.settings.fxSaved"));
      await load({ quiet: true });
    } catch (err) {
      const message = apiErrorMessage(err, t("travel.settings.fxSaveFailed"));
      setError(message);
      toast.error(t("travel.settings.fxNotSaved"), message);
    } finally {
      setSaving(null);
    }
  };

  const onSponsoredSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving("sponsored");
    setError(null);
    setSuccess(null);
    try {
      await travelApi.saveSponsoredRate(sponsoredForm);
      setSuccess(t("travel.settings.sponsoredSavedMsg"));
      toast.success(t("travel.settings.sponsoredSaved"));
      await load({ quiet: true });
    } catch (err) {
      const message = apiErrorMessage(err, t("travel.settings.sponsoredSaveFailed"));
      setError(message);
      toast.error(t("travel.settings.sponsoredNotSaved"), message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("travel.settings.title")}
        subtitle={t("travel.settings.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "nav.travel", href: "/travel" }, { label: "travel.settings.crumb" }]} />
        }
        actions={
          <Link href="/travel" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {t("common.back")}
          </Link>
        }
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : (
        <>
          <div data-testid="travel-dsa-settings">
            <FormSection
              title={t("travel.settings.dsa.title")}
              icon="payments"
              description={t("travel.settings.dsa.description")}
            >
              <div className="space-y-5">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t("travel.settings.country")} htmlFor="dsa-country" required>
                    <input
                      id="dsa-country"
                      className="form-input w-full"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.city")} htmlFor="dsa-city" hint={t("travel.settings.cityHint")}>
                    <input
                      id="dsa-city"
                      className="form-input w-full"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </FormField>
                  <FormField label={t("travel.settings.rateType")} htmlFor="dsa-rate-type">
                    <select
                      id="dsa-rate-type"
                      className="form-input w-full"
                      value={form.rate_type}
                      onChange={(e) => setForm({ ...form, rate_type: Number(e.target.value) })}
                    >
                      <option value={1}>{t(RATE_TYPE_LABELS[1])}</option>
                      <option value={2}>{t(RATE_TYPE_LABELS[2])}</option>
                      <option value={3}>{t(RATE_TYPE_LABELS[3])}</option>
                    </select>
                  </FormField>
                  <FormField label={t("travel.settings.ratePerDay")} htmlFor="dsa-rate-per-day" required>
                    <input
                      id="dsa-rate-per-day"
                      type="number"
                      min={0}
                      className="form-input w-full"
                      value={form.rate_per_day}
                      onChange={(e) => setForm({ ...form, rate_per_day: nonNegativeNumber(e.target.value) })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.currency")} htmlFor="dsa-currency" required>
                    <input
                      id="dsa-currency"
                      className="form-input w-full"
                      maxLength={3}
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.effectiveFrom")} htmlFor="dsa-effective-from">
                    <input
                      id="dsa-effective-from"
                      type="date"
                      className="form-input w-full"
                      value={form.effective_from}
                      onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                    />
                  </FormField>
                  <FormField label={t("travel.settings.accommodation")} htmlFor="dsa-accommodation">
                    <input
                      id="dsa-accommodation"
                      type="number"
                      min={0}
                      className="form-input w-full"
                      value={form.accommodation_component}
                      onChange={(e) => setForm({ ...form, accommodation_component: nonNegativeNumber(e.target.value) })}
                    />
                  </FormField>
                  <FormField label={t("travel.settings.meals")} htmlFor="dsa-meals">
                    <input
                      id="dsa-meals"
                      type="number"
                      min={0}
                      className="form-input w-full"
                      value={form.meal_component}
                      onChange={(e) => setForm({ ...form, meal_component: nonNegativeNumber(e.target.value) })}
                    />
                  </FormField>
                  <FormField label={t("travel.settings.incidentals")} htmlFor="dsa-incidentals">
                    <input
                      id="dsa-incidentals"
                      type="number"
                      min={0}
                      className="form-input w-full"
                      value={form.incidentals_component}
                      onChange={(e) => setForm({ ...form, incidentals_component: nonNegativeNumber(e.target.value) })}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <label htmlFor="travel-settings-setform-active-rate" className="flex items-center gap-2 text-sm text-neutral-700">
                      <input id="travel-settings-setform-active-rate"
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      {t("travel.settings.activeRate")}
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {editingId ? (
                    <button type="button" className="btn-secondary text-sm" onClick={resetForm}>
                      {t("travel.settings.cancelEdit")}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn-primary text-sm disabled:opacity-40"
                    data-testid="travel-save-dsa"
                    disabled={saving !== null}
                  >
                    {saving === "dsa"
                      ? t("travel.settings.saving")
                      : editingId
                        ? t("travel.settings.updateDsa")
                        : t("travel.settings.saveDsa")}
                  </button>
                </div>
              </form>

              <SettingsTable
                caption={t("travel.settings.dsa.title")}
                columns={8}
                empty={{
                  icon: "payments",
                  title: t("travel.settings.dsa.emptyTitle"),
                  description: t("travel.settings.dsa.emptyDescription"),
                }}
              >
                {rates.length > 0 ? (
                  <>
                    <thead>
                      <tr>
                        <th scope="col">{t("travel.settings.country")}</th>
                        <th scope="col">{t("travel.settings.city")}</th>
                        <th scope="col">{t("travel.settings.col.type")}</th>
                        <th scope="col">{t("travel.settings.col.components")}</th>
                        <th scope="col">{t("travel.settings.col.ratePerDay")}</th>
                        <th scope="col">{t("travel.settings.col.effective")}</th>
                        <th scope="col">{t("travel.settings.col.status")}</th>
                        <th scope="col"><span className="sr-only">{t("travel.settings.col.actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium text-neutral-900">{r.country}</td>
                          <td>{r.city || "—"}</td>
                          <td className="text-xs text-neutral-600">{RATE_TYPE_LABELS[r.rate_type] ? t(RATE_TYPE_LABELS[r.rate_type]) : r.rate_type}</td>
                          <td className="text-xs text-neutral-600">{componentSummary(r, t)}</td>
                          <td className="whitespace-nowrap">
                            {r.rate_per_day} {r.currency}
                          </td>
                          <td className="whitespace-nowrap">{formatDateShort(r.effective_from)}</td>
                          <td>
                            <span className={`badge text-xs ${r.is_active ? "badge-success" : "badge-muted"}`}>
                              {r.is_active ? t("travel.settings.active") : t("travel.settings.inactive")}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="btn-secondary py-1 px-2 text-xs" onClick={() => startEdit(r)}>
                              {t("common.edit")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : null}
              </SettingsTable>
              </div>
            </FormSection>
          </div>

          <div data-testid="travel-fx-settings">
            <FormSection
              title={t("travel.settings.fx.title")}
              icon="currency_exchange"
              description={t("travel.settings.fx.description")}
            >
              <div className="space-y-5">
              <form onSubmit={onFxSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t("travel.settings.fx.from")} htmlFor="fx-from" required>
                    <input
                      id="fx-from"
                      className="form-input w-full"
                      maxLength={3}
                      value={fxForm.from_currency}
                      onChange={(e) => setFxForm({ ...fxForm, from_currency: e.target.value.toUpperCase() })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.fx.to")} htmlFor="fx-to" required>
                    <input
                      id="fx-to"
                      className="form-input w-full"
                      maxLength={3}
                      value={fxForm.to_currency}
                      onChange={(e) => setFxForm({ ...fxForm, to_currency: e.target.value.toUpperCase() })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.fx.rate")} htmlFor="fx-rate" required>
                    <input
                      id="fx-rate"
                      type="number"
                      step="0.000001"
                      min={0}
                      className="form-input w-full"
                      value={fxForm.rate}
                      onChange={(e) => setFxForm({ ...fxForm, rate: Number(e.target.value) })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.fx.effectiveDate")} htmlFor="fx-effective">
                    <input
                      id="fx-effective"
                      type="date"
                      className="form-input w-full"
                      value={fxForm.effective_date}
                      onChange={(e) => setFxForm({ ...fxForm, effective_date: e.target.value })}
                    />
                  </FormField>
                  <FormField label={t("travel.settings.fx.notes")} htmlFor="fx-notes" className="sm:col-span-2">
                    <input
                      id="fx-notes"
                      className="form-input w-full"
                      value={fxForm.notes}
                      onChange={(e) => setFxForm({ ...fxForm, notes: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="btn-primary text-sm disabled:opacity-40"
                    data-testid="travel-save-fx"
                    disabled={saving !== null}
                  >
                    {saving === "fx" ? t("travel.settings.saving") : t("travel.settings.fx.save")}
                  </button>
                </div>
              </form>

              <SettingsTable
                caption={t("travel.settings.fx.title")}
                columns={5}
                empty={{
                  icon: "currency_exchange",
                  title: t("travel.settings.fx.emptyTitle"),
                  description: t("travel.settings.fx.emptyDescription"),
                }}
              >
                {fxRates.length > 0 ? (
                  <>
                    <thead>
                      <tr>
                        <th scope="col">{t("travel.settings.fx.from")}</th>
                        <th scope="col">{t("travel.settings.fx.to")}</th>
                        <th scope="col">{t("travel.settings.fx.rate")}</th>
                        <th scope="col">{t("travel.settings.col.effective")}</th>
                        <th scope="col">{t("travel.settings.fx.source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxRates.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.from_currency}</td>
                          <td>{r.to_currency}</td>
                          <td>{r.rate}</td>
                          <td className="whitespace-nowrap">{formatDateShort(r.effective_date)}</td>
                          <td>
                            <span className="badge badge-muted text-xs">{r.source}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : null}
              </SettingsTable>
              </div>
            </FormSection>
          </div>

          <div data-testid="travel-sponsored-rates">
            <FormSection
              title={t("travel.settings.sponsored.title")}
              icon="percent"
              description={t("travel.settings.sponsored.description")}
            >
              <div className="space-y-5">
              <form onSubmit={onSponsoredSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t("travel.settings.sponsored.name")} htmlFor="sponsored-name" required>
                    <input
                      id="sponsored-name"
                      className="form-input w-full"
                      value={sponsoredForm.name}
                      onChange={(e) => setSponsoredForm({ ...sponsoredForm, name: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.sponsored.code")} htmlFor="sponsored-code" required>
                    <input
                      id="sponsored-code"
                      className="form-input w-full"
                      value={sponsoredForm.code}
                      onChange={(e) => setSponsoredForm({ ...sponsoredForm, code: e.target.value })}
                      required
                    />
                  </FormField>
                  <FormField label={t("travel.settings.sponsored.mealDeduction")} htmlFor="sponsored-meal">
                    <input
                      id="sponsored-meal"
                      type="number"
                      min={0}
                      max={100}
                      className="form-input w-full"
                      value={sponsoredForm.meal_deduction_percent}
                      onChange={(e) =>
                        setSponsoredForm({ ...sponsoredForm, meal_deduction_percent: Number(e.target.value) })
                      }
                    />
                  </FormField>
                  <FormField label={t("travel.settings.sponsored.accomDeduction")} htmlFor="sponsored-accom">
                    <input
                      id="sponsored-accom"
                      type="number"
                      min={0}
                      max={100}
                      className="form-input w-full"
                      value={sponsoredForm.accommodation_deduction_percent}
                      onChange={(e) =>
                        setSponsoredForm({
                          ...sponsoredForm,
                          accommodation_deduction_percent: Number(e.target.value),
                        })
                      }
                    />
                  </FormField>
                  <div className="flex items-end sm:col-span-2">
                    <label htmlFor="travel-settings-setsponsoredform-active-policy-rate" className="flex items-center gap-2 text-sm text-neutral-700">
                      <input id="travel-settings-setsponsoredform-active-policy-rate"
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                        checked={sponsoredForm.is_active}
                        onChange={(e) => setSponsoredForm({ ...sponsoredForm, is_active: e.target.checked })}
                      />
                      {t("travel.settings.sponsored.activePolicy")}
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary text-sm disabled:opacity-40" disabled={saving !== null}>
                    {saving === "sponsored" ? t("travel.settings.saving") : t("travel.settings.sponsored.save")}
                  </button>
                </div>
              </form>

              <SettingsTable
                caption={t("travel.settings.sponsored.caption")}
                columns={5}
                empty={{
                  icon: "percent",
                  title: t("travel.settings.sponsored.emptyTitle"),
                  description: t("travel.settings.sponsored.emptyDescription"),
                }}
              >
                {sponsoredRates.length > 0 ? (
                  <>
                    <thead>
                      <tr>
                        <th scope="col">{t("travel.settings.sponsored.name")}</th>
                        <th scope="col">{t("travel.settings.sponsored.code")}</th>
                        <th scope="col">{t("travel.settings.sponsored.mealPct")}</th>
                        <th scope="col">{t("travel.settings.sponsored.accomPct")}</th>
                        <th scope="col">{t("travel.settings.col.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sponsoredRates.map((r) => (
                        <tr key={String(r.id)}>
                          <td className="font-medium">{String(r.name ?? "—")}</td>
                          <td className="font-mono text-xs text-neutral-600">{String(r.code ?? "—")}</td>
                          <td>{String(r.meal_deduction_percent ?? 0)}</td>
                          <td>{String(r.accommodation_deduction_percent ?? 0)}</td>
                          <td>
                            <span className={`badge text-xs ${r.is_active ? "badge-success" : "badge-muted"}`}>
                              {r.is_active ? t("travel.settings.active") : t("travel.settings.inactive")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : null}
              </SettingsTable>
              </div>
            </FormSection>
          </div>
        </>
      )}
    </div>
  );
}
