"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { financeApi, type Payslip } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_PAGE_SIZE, clientPageCount, getListData, slicePage } from "@/lib/listPagination";
import { formatPayPeriod } from "@/lib/payslipPeriod";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function periodLabel(p: Payslip): string {
  return p.period_label || formatPayPeriod(p.period_month, p.period_year);
}

export default function PayslipsPage() {
  const { error: toastError } = useToast();
  const { t } = useI18n();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  useEffect(() => {
    financeApi
      .listPayslips({ per_page: 100 })
      .then((res) => setPayslips(getListData<Payslip>(res.data)))
      .catch(() => setError(t("finance.payslips.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const set = new Set(payslips.map((p) => p.period_year));
    return Array.from(set).sort((a, b) => b - a);
  }, [payslips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payslips.filter((p) => {
      if (year !== "all" && String(p.period_year) !== year) return false;
      if (!q) return true;
      return periodLabel(p).toLowerCase().includes(q);
    });
  }, [payslips, search, year]);

  const latest = filtered[0] ?? null;
  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const handleDownload = async (p: Payslip) => {
    try {
      const res = await financeApi.downloadPayslip(p.id);
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${p.period_year}-${String(p.period_month).padStart(2, "0")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toastError(t("finance.hub.payslipUnavailable"));
    }
  };

  return (
    <RegisterShell
      title="finance.hub.payslips"
      subtitle="finance.payslips.subtitle"
      breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.finance", href: "/finance" }, { label: "finance.hub.payslips" }]} />}
      actions={
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={() => {
            exportToCsv(
              `payslips-${new Date().toISOString().slice(0, 10)}.csv`,
              filtered.map((p) => ({
                period: periodLabel(p),
                net_amount: p.net_amount ?? "",
                gross_amount: p.gross_amount ?? "",
                currency: p.currency ?? "NAD",
                confirmation: p.confirmation_status ?? "",
              })),
              [
                { key: "period", header: t("finance.payslips.col.period") },
                { key: "gross_amount", header: t("finance.payslips.col.gross") },
                { key: "net_amount", header: t("finance.payslips.col.netPay") },
                { key: "currency", header: t("finance.budget.col.currency") },
                { key: "confirmation", header: t("finance.payslips.col.confirmation") },
              ],
            );
          }}
        >
          {t("finance.budget.exportCsv")}
        </button>
      }
      stats={
        latest ? (
          <Link
            href={`/finance/payslips/${latest.id}`}
            className="card flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("finance.payslips.latest")}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{periodLabel(latest)}</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {t("finance.payslips.netAmount", { amount: `${latest.currency ?? "NAD"} ${Number(latest.net_amount || 0).toLocaleString()}` })}
              </p>
            </div>
            <span className="material-symbols-outlined text-primary">arrow_forward</span>
          </Link>
        ) : undefined
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t("common.search")}
              icon="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("finance.payslips.searchPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="payslip-year" className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {t("finance.budget.col.year")}
            </label>
            <select
              id="payslip-year"
              className="form-input"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("finance.payslips.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={filtered.length}
      onPageChange={setPage}
      loading={loading}
      empty={
        !loading && filtered.length === 0 ? (
          error ? (
            <EmptyState icon="error" title="finance.payslips.couldNotLoad" description={error} />
          ) : (
            <EmptyState
              icon="receipt_long"
              title="finance.payslips.empty"
              description="finance.payslips.emptyHint"
            />
          )
        ) : undefined
      }
    >
      <div className="card hidden overflow-hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("finance.payslips.col.period")}</th>
              <th>{t("finance.payslips.col.netPay")}</th>
              <th>{t("finance.payslips.col.file")}</th>
              <th>{t("finance.budget.col.status")}</th>
              <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/finance/payslips/${p.id}`} className="font-medium text-neutral-900 hover:text-primary dark:text-neutral-100">
                    {periodLabel(p)}
                  </Link>
                </td>
                <td>
                  {p.net_amount != null ? `${p.currency ?? "NAD"} ${Number(p.net_amount).toLocaleString()}` : "—"}
                </td>
                <td>{p.has_file ? <span className="badge badge-success">{t("finance.payslips.available")}</span> : <span className="badge badge-muted">{t("finance.hub.status.pending")}</span>}</td>
                <td>
                  {p.confirmation_status === "confirmed" ? (
                    <span className="badge badge-success">{t("finance.payslips.confirmed")}</span>
                  ) : p.confirmation_status === "rejected" ? (
                    <span className="badge badge-danger">{t("finance.payslips.returned")}</span>
                  ) : (
                    <span className="badge badge-muted">{t("finance.payslips.onFile")}</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-3">
                    <Link href={`/finance/payslips/${p.id}`} className="btn-secondary text-xs py-1 px-2">
                      {t("finance.hub.view")}
                    </Link>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => void handleDownload(p)}>
                      {t("common.download")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RegisterMobileCards
        items={paged}
        getKey={(p) => p.id}
        title={(p) => periodLabel(p)}
        subtitle={(p) =>
          p.net_amount != null ? t("finance.payslips.netAmount", { amount: `${p.currency ?? "NAD"} ${Number(p.net_amount).toLocaleString()}` }) : t("finance.payslips.openForDetails")
        }
        actions={(p) => (
          <div className="flex gap-3">
            <Link href={`/finance/payslips/${p.id}`} className="text-xs font-medium text-primary">
              {t("finance.hub.view")}
            </Link>
            <button type="button" className="text-xs font-medium text-neutral-600" onClick={() => void handleDownload(p)}>
              {t("common.download")}
            </button>
          </div>
        )}
      />
    </RegisterShell>
  );
}
