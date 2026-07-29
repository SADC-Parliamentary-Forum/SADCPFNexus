"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";

export default function MasterRegisterPage() {
  const [items, setItems] = useState<CorrespondenceLetter[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  useEffect(() => {
    setLoading(true);
    correspondenceApi
      .masterRegister({ per_page: 50, ...(search ? { search } : {}) })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  const getId = useCallback((row: CorrespondenceLetter) => row.id, []);
  const selection = useRowSelection({
    rows: items,
    getId,
  });

  const handleExportSelected = () => {
    const selected = items.filter((row) => selection.isSelected(row.id));
    if (selected.length === 0) return;
    exportToCsv(
      `correspondence-master-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      selected.map((item) => ({
        date: (item.received_at || item.approved_at || item.created_at || "").slice(0, 10),
        reference: item.registry_reference || item.reference_number || `#${item.id}`,
        direction: item.direction,
        subject: item.subject,
        owner: item.primary_owner?.name || "",
        status: item.status,
      })),
      [
        { key: "date", header: "Date" },
        { key: "reference", header: "Reference" },
        { key: "direction", header: "Direction" },
        { key: "subject", header: "Subject" },
        { key: "owner", header: "Owner" },
        { key: "status", header: "Status" },
      ],
    );
  };

  return (
    <RegisterShell
      title="Master Register"
      subtitle="Chronological institutional register — one authoritative document per entry, linked to subject files."
      density={density}
      onDensityChange={setDensity}
      loading={loading}
      filters={
        <input
          className="form-input max-w-md"
          placeholder="Search reference, subject, sender…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            selection.clear();
          }}
        />
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear}>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0}
            onClick={handleExportSelected}
          >
            Export selected
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && items.length === 0 ? (
          <div className="card px-5 py-16 text-center text-sm text-neutral-500">
            No correspondence entries in the master register.
          </div>
        ) : null
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className={selectionColumnClass.th}>
                <SelectAllCheckbox
                  checked={selection.allSelectableSelected}
                  indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                  onChange={selection.toggleAllSelectable}
                />
              </th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className={selectionColumnClass.td}>
                  <RowCheckbox
                    checked={selection.isSelected(item.id)}
                    onChange={() => selection.toggle(item.id)}
                    label={`Select ${item.registry_reference || item.reference_number || item.id}`}
                  />
                </td>
                <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                  {(item.received_at || item.approved_at || item.created_at || "").slice(0, 10)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/correspondence/${item.id}`} className="text-primary hover:underline">
                    {item.registry_reference || item.reference_number || `#${item.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{item.direction}</td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3">{item.primary_owner?.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className="badge-muted">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RegisterShell>
  );
}
