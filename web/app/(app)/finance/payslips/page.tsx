"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { financeApi, type Payslip } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, getListData, slicePage } from "@/lib/listPagination";

function formatPeriod(p: Payslip): string {
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[p.period_month] ?? p.period_month} ${p.period_year}`;
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    financeApi.listPayslips({ per_page: 100 })
      .then((res) => setPayslips(getListData<Payslip>(res.data)))
      .catch(() => setError("Failed to load payslips."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payslips;
    return payslips.filter((p) => {
      const hay = [formatPeriod(p), String(p.period_year), String(p.period_month)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [payslips, search]);

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
      // No file available
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `payslips-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((p) => ({
        period: formatPeriod(p),
        year: p.period_year,
        month: p.period_month,
        net_amount: p.net_amount ?? "",
        gross_amount: p.gross_amount ?? "",
        currency: p.currency ?? "NAD",
      })),
      [
        { key: "period", header: "Period" },
        { key: "year", header: "Year" },
        { key: "month", header: "Month" },
        { key: "gross_amount", header: "Gross" },
        { key: "net_amount", header: "Net pay" },
        { key: "currency", header: "Currency" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Payslips</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="Payslips"
        subtitle="View and download your payslip history."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Payslips" }]} />}
      />
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={handleExport}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="card p-4">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search by period…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card divide-y divide-neutral-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-neutral-100" />
                <div>
                  <div className="h-3 w-24 bg-neutral-100 rounded mb-1.5" />
                  <div className="h-2.5 w-32 bg-neutral-100 rounded" />
                </div>
              </div>
              <div className="h-3 w-16 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
          <p className="mt-3 text-sm text-neutral-500">No payslips available yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">description</span>
              <h3 className="text-sm font-semibold text-neutral-900">Payslip History</h3>
            </div>
            <span className="text-xs text-neutral-400">{filtered.length} records</span>
          </div>
          <div className="divide-y divide-neutral-50">
            {paged.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors">
                <Link href={`/finance/payslips/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{formatPeriod(p)}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {p.net_amount != null
                        ? `Net ${p.currency ?? "NAD"} ${Number(p.net_amount).toLocaleString()}`
                        : "View details"}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link href={`/finance/payslips/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDownload(p)}
                    className="text-xs font-medium text-neutral-600 hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
