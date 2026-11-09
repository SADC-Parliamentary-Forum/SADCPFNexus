"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supplierDocumentRequirementTypesApi,
  type SupplierDocumentRequirementType,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const emptyForm = {
  code: "",
  label: "",
  mandatory: true,
  has_expiry: true,
  warning_days: 90,
  required_at_registration: true,
  required_for_rfq: true,
  requires_verification: true,
};

export function SupplierDocumentRequirementTypesCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const idPrefix = `supplier-doc-req-types-${useId()}`;
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["supplier-document-requirement-types"],
    queryFn: () => supplierDocumentRequirementTypesApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      supplierDocumentRequirementTypesApi.create({
        ...form,
        code: form.code.trim() || undefined,
        label: form.label.trim(),
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["supplier-document-requirement-types"] });
      toast.success(t("procurement.docRequirements.added"));
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("procurement.docRequirements.createFailed"));
      setError(message);
      toast.error(t("procurement.docRequirements.notAdded"), message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SupplierDocumentRequirementType> }) =>
      supplierDocumentRequirementTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-document-requirement-types"] });
      toast.success(t("procurement.docRequirements.updated"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.docRequirements.notUpdated"), apiErrorMessage(err, t("procurement.docRequirements.updateFailed")));
    },
  });

  return (
    <div className="card p-5 space-y-4" data-testid="document-requirement-types">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{t("procurement.docRequirements.title")}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {t("procurement.docRequirements.hint")}
        </p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {listQuery.isLoading ? (
        <p className="text-sm text-neutral-400">{t("procurement.docRequirements.loading")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">{t("procurement.docRequirements.type")}</th>
                <th>{t("procurement.docRequirements.mandatory")}</th>
                <th>{t("procurement.docRequirements.expiry")}</th>
                <th>{t("procurement.docRequirements.active")}</th>
              </tr>
            </thead>
            <tbody>
              {(listQuery.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="font-medium text-neutral-800">{row.label}</p>
                    <p className="font-mono text-[11px] text-neutral-400">{row.code}</p>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.mandatory}
                      onChange={(e) => updateMutation.mutate({ id: row.id, data: { mandatory: e.target.checked } })}
                      aria-label={t("procurement.docRequirements.mandatoryFor", { label: row.label })}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.has_expiry}
                      onChange={(e) => updateMutation.mutate({ id: row.id, data: { has_expiry: e.target.checked } })}
                      aria-label={t("procurement.docRequirements.expiryFor", { label: row.label })}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => updateMutation.mutate({ id: row.id, data: { is_active: e.target.checked } })}
                      aria-label={t("procurement.docRequirements.activeFor", { label: row.label })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="form-input"
          placeholder={t("procurement.docRequirements.label")}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <input
          className="form-input"
          placeholder={t("procurement.docRequirements.codeOptional")}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
      </div>
      <label htmlFor={`${idPrefix}-mandatory`} className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-mandatory`}
          type="checkbox"
          checked={form.mandatory}
          onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
        />
        {t("procurement.docRequirements.mandatoryEligibility")}
      </label>
      <button
        type="button"
        className="btn-secondary text-sm disabled:opacity-50"
        disabled={!form.label.trim() || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? t("procurement.supplierCategories.adding") : t("procurement.docRequirements.add")}
      </button>
    </div>
  );
}
