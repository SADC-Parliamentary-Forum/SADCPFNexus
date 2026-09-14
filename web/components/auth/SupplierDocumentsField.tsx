"use client";

import { useId, useRef } from "react";
import { VENDOR_DOC_TYPES } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export interface PendingSupplierDocument {
  id: string;
  file: File;
  documentType: string;
}

interface Props {
  documents: PendingSupplierDocument[];
  onChange: (documents: PendingSupplierDocument[]) => void;
  max?: number;
}

export function SupplierDocumentsField({ documents, onChange, max = 15 }: Props) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) return;
    onChange([
      ...documents,
      ...incoming.slice(0, Math.max(0, max - documents.length)).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        documentType: "company_profile",
      })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t("auth.docsTitle")}</h2>
        <span className="text-xs text-neutral-400">{documents.length}/{max}</span>
      </div>
      <p className="text-xs text-neutral-500">{t("auth.docsHint")}</p>
      <label htmlFor={inputId} className="btn-secondary inline-flex cursor-pointer text-sm">
        {t("auth.docsAdd")}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
        className="sr-only"
        onChange={(e) => addFiles(e.target.files)}
      />
      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("auth.docsNone")}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-800">{doc.file.name}</p>
              <label className="sr-only" htmlFor={`${doc.id}-type`}>{t("auth.docsType")}</label>
              <select
                id={`${doc.id}-type`}
                className="form-input sm:w-56"
                value={doc.documentType}
                onChange={(e) =>
                  onChange(documents.map((item) => item.id === doc.id ? { ...item, documentType: e.target.value } : item))
                }
              >
                {VENDOR_DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="text-sm font-medium text-red-600 hover:underline"
                onClick={() => onChange(documents.filter((item) => item.id !== doc.id))}
              >
                {t("auth.docsRemove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
