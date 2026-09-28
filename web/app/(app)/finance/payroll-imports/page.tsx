"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollImportApi, type PayrollImportBatch, type PayrollImportLineInput } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

const REQUIRED_HEADERS = ["employee_number", "gross", "deductions", "net"];
const NUMERIC_HEADERS = ["gross", "deductions", "net"];

type ParsedRow = { line: PayrollImportLineInput; errors: string[] };

function parseCsv(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], headerError: "The file is empty." };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], headerError: `Missing required column(s): ${missing.join(", ")}. Expected header: employee_number,period,gross,deductions,net,external_ref` };
  }

  const rows: ParsedRow[] = lines.slice(1).map((raw) => {
    const cells = raw.split(",").map((c) => c.trim());
    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx === -1 ? undefined : cells[idx];
    };
    const errors: string[] = [];
    const employeeNumber = get("employee_number") || "";
    if (!employeeNumber) errors.push("employee_number is required");

    const numeric: Record<string, number | undefined> = {};
    for (const key of NUMERIC_HEADERS) {
      const raw = get(key);
      const n = raw ? Number(raw) : NaN;
      if (raw && Number.isNaN(n)) errors.push(`${key} must be a number`);
      numeric[key] = Number.isNaN(n) ? undefined : n;
    }

    return {
      line: {
        employee_number: employeeNumber,
        period: get("period") || undefined,
        gross: numeric.gross,
        deductions: numeric.deductions,
        net: numeric.net,
        external_ref: get("external_ref") || undefined,
      },
      errors,
    };
  });

  return { rows, headerError: null };
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not yet confirmed",
  staged: "Staged — ready for payroll processing",
  exported: "Exported",
};

export default function PayrollImportsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [period, setPeriod] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-imports"],
    queryFn: async () => (await payrollImportApi.list({ per_page: 25 })).data,
  });
  const batches: PayrollImportBatch[] = (data as unknown as { data?: PayrollImportBatch[] })?.data ?? [];

  const createMut = useMutation({
    mutationFn: (lines: PayrollImportLineInput[]) =>
      payrollImportApi.create({ period: period || undefined, lines }),
    onSuccess: () => {
      success("Draft batch created. Review it below, then confirm to stage it.");
      setParsed(null);
      setFileName(null);
      qc.invalidateQueries({ queryKey: ["payroll-imports"] });
    },
    onError: (err: unknown) => error(apiErrorMessage(err, "Could not create the draft batch.")),
  });

  const stageMut = useMutation({
    mutationFn: (id: number) => payrollImportApi.stage(id),
    onSuccess: () => {
      success("Batch confirmed and staged.");
      qc.invalidateQueries({ queryKey: ["payroll-imports"] });
    },
    onError: (err: unknown) => error(apiErrorMessage(err, "Could not confirm this batch.")),
  });

  const onFile = (file: File) => {
    setFileName(file.name);
    file.text().then((text) => {
      const { rows, headerError } = parseCsv(text);
      setHeaderError(headerError);
      setParsed(headerError ? null : rows);
    });
  };

  const validRows = parsed?.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.filter((r) => r.errors.length > 0) ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Payroll import"
        subtitle="Upload a payslip CSV export to stage a draft payroll batch. Amounts and rates always come from the file — nothing here is calculated or invented."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Finance", href: "/finance" }, { label: "Payroll import" }]} />}
      />

      <FormSection
        title="1. Upload payslip CSV"
        description="Header row required: employee_number,period,gross,deductions,net,external_ref (period and external_ref optional)."
        icon="upload_file"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="payroll-import-period" className="block text-xs font-semibold text-neutral-700 mb-1">Period (optional, e.g. 2026-08)</label>
              <input
                id="payroll-import-period"
                className="form-input"
                placeholder="2026-08"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="payroll-import-file" className="block text-xs font-semibold text-neutral-700 mb-1">CSV file</label>
              <input
                id="payroll-import-file"
                type="file"
                accept=".csv,text/csv"
                className="form-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </div>
          </div>

          {headerError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {headerError}
            </div>
          ) : null}
        </div>
      </FormSection>

      {parsed ? (
        <FormSection
          title={`2. Review ${fileName ?? "upload"}`}
          description={`${validRows.length} valid line(s)${invalidRows.length ? `, ${invalidRows.length} with errors` : ""}.`}
          icon="fact_check"
        >
          {invalidRows.length > 0 ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="mb-2 font-medium">{invalidRows.length} row(s) will be skipped:</p>
              <ul className="list-disc space-y-1 pl-5">
                {invalidRows.slice(0, 10).map((r, i) => (
                  <li key={i}>
                    <span className="font-mono">{r.line.employee_number || "(missing)"}</span> — {r.errors.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>External ref</th>
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{r.line.employee_number}</td>
                    <td>{r.line.period ?? (period || "—")}</td>
                    <td>{r.line.gross ?? "—"}</td>
                    <td>{r.line.deductions ?? "—"}</td>
                    <td>{r.line.net ?? "—"}</td>
                    <td>{r.line.external_ref ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validRows.length > 50 ? (
              <p className="px-3 py-2 text-xs text-neutral-500">Showing first 50 of {validRows.length} rows.</p>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={validRows.length === 0 || createMut.isPending}
              onClick={() => createMut.mutate(validRows.map((r) => r.line))}
            >
              {createMut.isPending ? "Creating draft…" : `Create draft batch (${validRows.length} lines)`}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => { setParsed(null); setFileName(null); }}>
              Cancel
            </button>
          </div>
        </FormSection>
      ) : null}

      <FormSection title="3. Batches" icon="folder" description="Draft batches are not yet applied to payroll — confirm to stage them.">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-neutral-500">No payroll import batches yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Period</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">{b.reference}</td>
                    <td>{b.period ?? "—"}</td>
                    <td>{b.driver}</td>
                    <td>{STATUS_LABEL[b.status] ?? b.status}</td>
                    <td>{b.line_count ?? b.lines_count ?? 0}</td>
                    <td>
                      {b.status === "draft" ? (
                        <button
                          type="button"
                          className="btn-secondary py-1 px-2 text-xs"
                          disabled={stageMut.isPending}
                          onClick={() => stageMut.mutate(b.id)}
                        >
                          Confirm & stage
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
