"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ErrorBanner, TableEmpty } from "@/components/ui/EmptyState";
import {
  supplierPortalApi,
  type SupplierDocumentRecord,
  type SupplierPortalDocumentType,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  needed: "badge-warning",
  pending: "badge-primary",
  verified: "badge-success",
  rejected: "badge-danger",
  expired: "badge-danger",
};

const STATUS_KEY: Record<string, string> = {
  needed: "supplier.documents.needed",
  pending: "supplier.documents.pending",
  verified: "supplier.documents.approved",
  rejected: "supplier.documents.rejected",
  expired: "supplier.documents.expired",
};

export default function SupplierDocumentsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [typeCode, setTypeCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["supplier-documents"],
    queryFn: () => supplierPortalApi.documents().then((response) => response.data.data),
  });

  const types = documentsQuery.data?.types ?? [];
  const selectedType = types.find((row) => row.code === typeCode) ?? null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !typeCode) {
        throw new Error(t("supplier.documents.fileRequired"));
      }
      if (selectedType?.has_expiry && !expiryDate) {
        throw new Error(t("supplier.documents.expiryRequired"));
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type_code", typeCode);
      if (documentNumber.trim()) formData.append("document_number", documentNumber.trim());
      if (expiryDate) formData.append("expiry_date", expiryDate);
      return supplierPortalApi.uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-documents"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
      setFile(null);
      setDocumentNumber("");
      setExpiryDate("");
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: unknown) => {
      setError(err instanceof Error && !("response" in err)
        ? err.message
        : apiErrorMessage(err, t("supplier.documents.uploadError")));
    },
  });

  const rows = useMemo(() => {
    const payload = documentsQuery.data;
    if (!payload) return [];
    const needed = (payload.requirements ?? [])
      .filter((row) => row.needed && !row.document)
      .map((row) => ({
        key: `needed-${row.code}`,
        typeCode: row.code,
        typeLabel: row.label,
        fileName: null as string | null,
        status: "needed",
        expiry: null as string | null,
        document: null as SupplierDocumentRecord | null,
      }));
    const uploaded = (payload.documents ?? []).map((doc) => ({
      key: `doc-${doc.id}`,
      typeCode: doc.type_code,
      typeLabel: types.find((item) => item.code === doc.type_code)?.label ?? doc.type_code.replace(/_/g, " "),
      fileName: doc.original_filename || doc.name,
      status: doc.status,
      expiry: doc.expiry_date,
      document: doc,
    }));
    return [...needed, ...uploaded];
  }, [documentsQuery.data, types]);

  function typeByCode(code: string): SupplierPortalDocumentType | undefined {
    return types.find((row) => row.code === code);
  }

  function prepareUpload(code: string) {
    setTypeCode(code);
    setError(null);
    fileInputRef.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    uploadMutation.mutate();
  }

  if (documentsQuery.isLoading) {
    return <div className="card p-6" role="status">{t("supplier.documents.loading")}</div>;
  }

  if (documentsQuery.isError || !documentsQuery.data) {
    return (
      <ErrorBanner
        message={apiErrorMessage(documentsQuery.error, t("supplier.documents.loadError"))}
        onRetry={() => {
          void documentsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title="supplier.documents.title"
        subtitle="supplier.documents.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "auth.supplierPortalName" }, { label: "supplier.documents.title" }]} />}
      />

      <form className="card p-5 space-y-4" onSubmit={onSubmit}>
        <h2 className="text-sm font-semibold text-neutral-800">{t("supplier.documents.upload")}</h2>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="supplier-doc-type" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.documents.type")}</label>
            <select
              id="supplier-doc-type"
              className="form-input w-full"
              value={typeCode}
              onChange={(event) => setTypeCode(event.target.value)}
              required
            >
              <option value="">{t("supplier.documents.chooseType")}</option>
              {types.map((row) => (
                <option key={row.code} value={row.code}>{row.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="supplier-doc-file" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.documents.file")}</label>
            <input
              id="supplier-doc-file"
              ref={fileInputRef}
              type="file"
              className="form-input w-full"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label htmlFor="supplier-doc-number" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.documents.documentNumber")}</label>
            <input
              id="supplier-doc-number"
              className="form-input w-full"
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
            />
          </div>
          {selectedType?.has_expiry && (
            <div>
              <label htmlFor="supplier-doc-expiry" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.documents.expiryDate")}</label>
              <input
                id="supplier-doc-expiry"
                type="date"
                className="form-input w-full"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
                required
              />
            </div>
          )}
        </div>
        <button type="submit" className="btn-primary disabled:opacity-60" disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? t("supplier.documents.uploading") : t("supplier.documents.submit")}
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="data-table w-full" data-testid="supplier-documents-table">
          <thead>
            <tr>
              <th>{t("supplier.documents.type")}</th>
              <th>{t("supplier.documents.file")}</th>
              <th>{t("supplier.documents.status")}</th>
              <th>{t("supplier.documents.expiry")}</th>
              <th>{t("supplier.documents.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={5} title="supplier.documents.empty" />
            ) : (
              rows.map((row) => {
                const statusKey = STATUS_KEY[row.status] ?? STATUS_KEY.pending;
                const badge = STATUS_BADGE[row.status] ?? "badge-muted";
                return (
                  <tr key={row.key}>
                    <td>{row.typeLabel}</td>
                    <td className="max-w-[16rem] truncate">{row.fileName ?? "—"}</td>
                    <td>
                      <div className="space-y-1">
                        <span className={`badge ${badge}`}>{t(statusKey)}</span>
                        {row.document?.remarks && (row.status === "rejected" || row.status === "expired") && (
                          <p className="text-xs text-neutral-600">
                            <span className="font-semibold">{t("supplier.documents.remarks")}: </span>
                            {row.document.remarks}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>{row.expiry ? formatDateShort(row.expiry) : "—"}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.document && (
                          <a
                            href={supplierPortalApi.downloadDocumentUrl(row.document.id)}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {t("supplier.documents.download")}
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-2"
                          onClick={() => prepareUpload(row.typeCode)}
                        >
                          {row.document && !typeByCode(row.typeCode)?.allows_multiple
                            ? t("supplier.documents.replace")
                            : t("supplier.documents.submit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
