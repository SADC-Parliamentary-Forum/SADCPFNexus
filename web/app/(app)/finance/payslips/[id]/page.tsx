"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { financeApi, type Payslip, type PayslipDetails } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPayPeriod } from "@/lib/payslipPeriod";

function getEntity<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object" && "data" in payload) {
    return ((payload as { data?: unknown }).data as T) ?? null;
  }
  return (payload as T) ?? null;
}

function periodLabel(p: Payslip): string {
  return p.period_label || formatPayPeriod(p.period_month, p.period_year);
}

export default function PayslipViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUnavailable, setPdfUnavailable] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setError("Invalid payslip ID.");
      setLoading(false);
      return;
    }
    financeApi
      .getPayslip(numericId)
      .then((res) => setPayslip(getEntity<Payslip>(res.data)))
      .catch(() => setError("Payslip not found."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!payslip) return;
    setPdfLoading(true);
    setPdfUnavailable(false);
    financeApi
      .downloadPayslip(payslip.id)
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        blobUrlRef.current = url;
        setPdfUrl(url);
      })
      .catch(() => setPdfUnavailable(true))
      .finally(() => setPdfLoading(false));
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [payslip]);

  const handleDownload = () => {
    if (!payslip || !pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `payslip-${payslip.period_year}-${String(payslip.period_month).padStart(2, "0")}.pdf`;
    a.click();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
        <div className="h-5 w-48 rounded bg-neutral-100" />
        <div className="h-8 w-64 rounded bg-neutral-100" />
        <div className="card h-[400px]" />
      </div>
    );
  }

  if (error || !payslip) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="card">
          <EmptyState
            icon="error"
            title={error ?? "Payslip not found"}
            action={
              <Link href="/finance/payslips" className="btn-secondary">
                Back to payslips
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title={`Payslip — ${periodLabel(payslip)}`}
        subtitle="Official payslip record. Download or view inline."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Finance", href: "/finance" },
              { label: "Payslips", href: "/finance/payslips" },
              { label: periodLabel(payslip) },
            ]}
          />
        }
        actions={
          <button type="button" onClick={handleDownload} disabled={!pdfUrl} className="btn-primary disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download PDF
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Gross", value: `${payslip.currency} ${Number(payslip.gross_amount || 0).toLocaleString()}`, icon: "trending_up" },
          { label: "Net pay", value: `${payslip.currency} ${Number(payslip.net_amount || 0).toLocaleString()}`, icon: "payments" },
          { label: "Period", value: periodLabel(payslip), icon: "calendar_month" },
        ].map((card) => (
          <div key={card.label} className="card p-4">
            <p className="text-xs text-neutral-500">{card.label}</p>
            <p className="mt-0.5 text-sm font-bold text-neutral-900 dark:text-neutral-100">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Payslip document</h3>
        </div>
        {pdfLoading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 text-neutral-400">
            <span className="material-symbols-outlined animate-pulse text-3xl">picture_as_pdf</span>
            <p className="text-sm">Loading document…</p>
          </div>
        ) : null}
        {!pdfLoading && pdfUnavailable ? (
          <EmptyState
            icon="description"
            title="Document not yet available"
            description="Contact HR if you expected a PDF for this period."
          />
        ) : null}
        {!pdfLoading && pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=1&view=FitH`}
            title={`Payslip ${periodLabel(payslip)}`}
            className="w-full border-0"
            style={{ height: "70vh", minHeight: "500px" }}
          />
        ) : null}
      </div>

      {payslip.details ? <PayslipBreakdown details={payslip.details} currency={payslip.currency} /> : null}
    </div>
  );
}

function PayslipBreakdown({ details, currency }: { details: PayslipDetails; currency: string }) {
  const fmt = (n: number) => `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-200">Payslip breakdown</h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {details.earnings.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">Earnings</p>
            <div className="space-y-1.5">
              {details.earnings.map((e) => (
                <div key={e.key} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{e.label}</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {details.deductions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700">Deductions</p>
            <div className="space-y-1.5">
              {details.deductions.map((d) => (
                <div key={d.key} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{d.label}</span>
                  <span className="font-medium">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Net pay</p>
        <p className="text-2xl font-bold text-primary">{fmt(details.net_amount)}</p>
      </div>
    </div>
  );
}
