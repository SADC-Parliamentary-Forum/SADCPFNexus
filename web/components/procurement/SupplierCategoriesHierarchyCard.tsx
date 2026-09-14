"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierCategoriesApi, type SupplierCategory } from "@/lib/api";

export function SupplierCategoriesHierarchyCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      supplierCategoriesApi.create({
        name: name.trim(),
        parent_id: parentId ? Number(parentId) : null,
      }),
    onSuccess: () => {
      setName("");
      setParentId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["supplier-categories"] });
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not create category."),
  });

  const categories = listQuery.data ?? [];

  return (
    <div className="card p-5 space-y-4" data-testid="supplier-categories-hierarchy">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Supplier categories</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Hierarchical categories. RFQ targeting matches a leaf and its ancestors. There is no maximum of three.
        </p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <ul className="space-y-1 text-sm">
        {categories.map((row: SupplierCategory) => {
          const parent = categories.find((item) => item.id === row.parent_id);
          return (
            <li key={row.id} className="flex justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2">
              <span>{row.name}</span>
              <span className="text-xs text-neutral-400">{parent ? `Child of ${parent.name}` : "Top level"}</span>
            </li>
          );
        })}
        {categories.length === 0 && <li className="text-neutral-400">No categories yet.</li>}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="form-input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="form-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Top level</option>
          {categories.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn-secondary text-sm disabled:opacity-50"
        disabled={!name.trim() || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? "Adding…" : "Add category"}
      </button>
    </div>
  );
}
