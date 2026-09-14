"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supplierDocumentRequirementTypesApi,
  type SupplierDocumentRequirementType,
} from "@/lib/api";

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
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not create type."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SupplierDocumentRequirementType> }) =>
      supplierDocumentRequirementTypesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-document-requirement-types"] }),
  });

  return (
    <div className="card p-5 space-y-4" data-testid="document-requirement-types">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Supplier document requirements</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Configure the compliance register types. Eligibility uses verified, unexpired mandatory documents — not the Approved flag.
        </p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {listQuery.isLoading ? (
        <p className="text-sm text-neutral-400">Loading types…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">Type</th>
                <th>Mandatory</th>
                <th>Expiry</th>
                <th>Active</th>
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
                      aria-label={`${row.label} mandatory`}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.has_expiry}
                      onChange={(e) => updateMutation.mutate({ id: row.id, data: { has_expiry: e.target.checked } })}
                      aria-label={`${row.label} has expiry`}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => updateMutation.mutate({ id: row.id, data: { is_active: e.target.checked } })}
                      aria-label={`${row.label} active`}
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
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <input
          className="form-input"
          placeholder="Code (optional)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.mandatory}
          onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
        />
        Mandatory for eligibility
      </label>
      <button
        type="button"
        className="btn-secondary text-sm disabled:opacity-50"
        disabled={!form.label.trim() || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? "Adding…" : "Add document type"}
      </button>
    </div>
  );
}
