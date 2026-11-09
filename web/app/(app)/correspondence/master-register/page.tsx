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
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MasterRegisterPage() {
  const { t } = useI18n();
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
        { key: "date", header: t("correspondence.col.date") },
        { key: "reference", header: t("correspondence.col.reference") },
        { key: "direction", header: t("correspondence.col.direction") },
        { key: "subject", header: t("correspondence.col.subject") },
        { key: "owner", header: t("correspondence.col.owner") },
        { key: "status", header: t("correspondence.col.status") },
      ],
    );
  };

  return (
    <RegisterShell
      title={t("correspondence.masterRegister.title")}
      subtitle={t("correspondence.masterRegister.subtitle")}
      density={density}
      onDensityChange={setDensity}
      loading={loading}
      filters={
        <input
          className="form-input max-w-md"
          placeholder={t("correspondence.searchPlaceholder")}
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
            {t("correspondence.exportSelected")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && items.length === 0 ? (
          <div className="card">
            <EmptyState icon="mail" title={t("correspondence.masterRegister.empty")} />
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
              <th className="px-4 py-3">{t("correspondence.col.date")}</th>
              <th className="px-4 py-3">{t("correspondence.col.reference")}</th>
              <th className="px-4 py-3">{t("correspondence.col.direction")}</th>
              <th className="px-4 py-3">{t("correspondence.col.subject")}</th>
              <th className="px-4 py-3">{t("correspondence.col.owner")}</th>
              <th className="px-4 py-3">{t("correspondence.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className={selectionColumnClass.td}>
                  <RowCheckbox
                    checked={selection.isSelected(item.id)}
                    onChange={() => selection.toggle(item.id)}
                    label={t("correspondence.selectRow", { ref: String(item.registry_reference || item.reference_number || item.id) })}
                  />
                </td>
                <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                  {(item.received_at || item.approved_at || item.created_at || "").slice(0, 10)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/correspondence/${item.id}`} className="font-medium text-primary">
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
