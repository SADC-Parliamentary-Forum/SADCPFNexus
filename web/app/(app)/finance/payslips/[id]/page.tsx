"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { financeApi, type Payslip } from "@/lib/api";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function formatPeriod(p: Payslip): string {
  return `${MONTH_NAMES[p.period_month] ?? p.period_month} ${p.period_year}`;
}

function getEntity<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object" && "data" in payload) {
    return ((payload as { data?: unknown }).data as T) ?? null;
  }
  return (payload as T) ?? null;
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
    financeApi.getPayslip(numericId)
      .then((res) => setPayslip(getEntity<Payslip>(res.data)))
      .catch(() => setError("Payslip not found."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!payslip) return;
    setPdfLoading(true);
    setPdfUnavailable(false);
    financeApi.downloadPayslip(payslip.id)
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
      <div className="max-w-5xl space-y-6 animate-pulse">
        <div className="h-5 w-48 bg-neutral-100 rounded" />
        <div className="h-8 w-64 bg-neutral-100 rounded" />
        <div className="card h-[600px]" />
      </div>
    );
  }

  if (error || !payslip) {
    return (
      <div className="max-w-5xl">
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-red-300">error_outline</span>
          <p className="mt-3 text-sm text-neutral-600">{error ?? "Payslip not found."}</p>
          <Link href="/finance/payslips" className="btn-secondary mt-4 inline-flex">Back to Payslips</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/finance/payslips" className="hover:text-primary transition-colors">Payslips</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{formatPeriod(payslip)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Payslip — {formatPeriod(payslip)}</h1>
          <p className="page-subtitle">Official payslip record. Download or view inline.</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!pdfUrl}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download PDF
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Gross Amount",  value: `${payslip.currency} ${Number(payslip.gross_amount).toLocaleString()}`,  icon: "trending_up",   color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Net Amount",    value: `${payslip.currency} ${Number(payslip.net_amount).toLocaleString()}`,    icon: "payments",      color: "text-primary",    bg: "bg-primary/10"},
          { label: "Period",        value: formatPeriod(payslip),                                                    icon: "calendar_month", color: "text-amber-600",  bg: "bg-amber-50"  },
        ].map((card) => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{card.label}</p>
                <p className="text-sm font-bold text-neutral-900 mt-0.5">{card.value}</p>
              </div>
              <div className={`h-9 w-9 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <span className={`material-symbols-outlined ${card.color} text-[18px]`}>{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PDF viewer */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">picture_as_pdf</span>
            <h3 className="text-sm font-semibold text-neutral-900">Payslip Document</h3>
          </div>
          {pdfUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              Open in new tab
            </button>
          )}
        </div>

        {pdfLoading && (
          <div className="flex flex-col items-center justify-center h-96 gap-3 text-neutral-400">
            <span className="material-symbols-outlined text-3xl animate-pulse">picture_as_pdf</span>
            <p className="text-sm">Loading document…</p>
          </div>
        )}

        {!pdfLoading && pdfUnavailable && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-neutral-400">
            <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
            <p className="text-sm text-neutral-500">Document not yet available for this period.</p>
            <p className="text-xs text-neutral-400">Contact HR to request a copy.</p>
          </div>
        )}

        {!pdfLoading && pdfUrl && (
          <iframe
            src={`${pdfUrl}#toolbar=1&view=FitH`}
            title={`Payslip ${formatPeriod(payslip)}`}
            className="w-full border-0"
            style={{ height: "70vh", minHeight: "500px" }}
          />
        )}
      </div>
    </div>
  );
}
