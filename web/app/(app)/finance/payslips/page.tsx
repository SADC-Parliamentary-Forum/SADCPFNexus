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
import { DEFAULT_PAGE_SIZE, clientPageCount, getListData, slicePage } from "@/lib/listPagination";
import { formatPayPeriod } from "@/lib/payslipPeriod";

function periodLabel(p: Payslip): string {
  return p.period_label || formatPayPeriod(p.period_month, p.period_year);
}

export default function PayslipsPage() {
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
      .catch(() => setError("Failed to load payslips."))
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
      // no file
    }
  };

  return (
    <RegisterShell
      title="Payslips"
      subtitle="Your official pay documents. Download or open any period."
      breadcrumbs={<PageBreadcrumbs items={[{ label: "Finance", href: "/finance" }, { label: "Payslips" }]} />}
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
                { key: "period", header: "Period" },
                { key: "gross_amount", header: "Gross" },
                { key: "net_amount", header: "Net pay" },
                { key: "currency", header: "Currency" },
                { key: "confirmation", header: "Confirmation" },
              ],
            );
          }}
        >
          Export CSV
        </button>
      }
      stats={
        latest ? (
          <Link
            href={`/finance/payslips/${latest.id}`}
            className="card flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Latest payslip</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{periodLabel(latest)}</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Net {latest.currency ?? "NAD"} {Number(latest.net_amount || 0).toLocaleString()}
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
              label="Search"
              icon="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by period…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500" htmlFor="payslip-year">
              Year
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
              <option value="all">All years</option>
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
            <EmptyState icon="error" title="Could not load payslips" description={error} />
          ) : (
            <EmptyState
              icon="receipt_long"
              title="No payslips yet"
              description="HR issues payslips after each payroll run. They will appear here when your file is ready."
            />
          )
        ) : undefined
      }
    >
      <div className="card hidden overflow-hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Net pay</th>
              <th>File</th>
              <th>Status</th>
              <th />
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
                <td>{p.has_file ? <span className="badge badge-success">Available</span> : <span className="badge badge-muted">Pending</span>}</td>
                <td>
                  {p.confirmation_status === "confirmed" ? (
                    <span className="badge badge-success">Confirmed</span>
                  ) : p.confirmation_status === "rejected" ? (
                    <span className="badge badge-danger">Returned</span>
                  ) : (
                    <span className="badge badge-muted">On file</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-3">
                    <Link href={`/finance/payslips/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                      View
                    </Link>
                    <button type="button" className="text-xs font-medium text-neutral-600 hover:underline" onClick={() => void handleDownload(p)}>
                      Download
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
          p.net_amount != null ? `Net ${p.currency ?? "NAD"} ${Number(p.net_amount).toLocaleString()}` : "Open for details"
        }
        actions={(p) => (
          <div className="flex gap-3">
            <Link href={`/finance/payslips/${p.id}`} className="text-xs font-medium text-primary">
              View
            </Link>
            <button type="button" className="text-xs font-medium text-neutral-600" onClick={() => void handleDownload(p)}>
              Download
            </button>
          </div>
        )}
      />
    </RegisterShell>
  );
}
