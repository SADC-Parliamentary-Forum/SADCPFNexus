"use client";

import { useState, useEffect, useCallback } from "react";
import { workplanEventTypesApi, type WorkplanEventType } from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Colour choices; `label` is a catalog key translated where it renders. */
const COLOR_OPTIONS = [
  { value: "neutral", label: "workplan.eventTypes.color.grey" },
  { value: "primary", label: "workplan.eventTypes.color.blue" },
  { value: "green",   label: "workplan.eventTypes.color.green" },
  { value: "amber",   label: "workplan.eventTypes.color.amber" },
  { value: "red",     label: "workplan.eventTypes.color.red" },
  { value: "purple",  label: "workplan.eventTypes.color.purple" },
  { value: "teal",    label: "workplan.eventTypes.color.teal" },
];

const COLOR_DOT: Record<string, string> = {
  neutral: "bg-neutral-400",
  primary: "bg-primary",
  green:   "bg-green-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
  purple:  "bg-purple-500",
  teal:    "bg-teal-500",
};

export default function WorkplanEventTypesPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [list, setList] = useState<WorkplanEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("event");
  const [color, setColor] = useState("neutral");
  const [sortOrder, setSortOrder] = useState("");
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workplanEventTypesApi.list();
      setList(res.data?.data ?? []);
    } catch {
      setError(t("workplan.eventTypes.loadFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setIcon("event");
    setColor("neutral");
    setSortOrder("");
  };

  const handleEdit = (et: WorkplanEventType) => {
    setEditingId(et.id);
    setShowForm(true);
    setName(et.name);
    setIcon(et.icon);
    setColor(et.color);
    setSortOrder(et.sort_order != null ? String(et.sort_order) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await workplanEventTypesApi.update(editingId, {
          name: name.trim(),
          icon: icon.trim() || undefined,
          color: color || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      } else {
        await workplanEventTypesApi.create({
          name: name.trim(),
          icon: icon.trim() || undefined,
          color: color || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      }
      toast.success(editingId ? t("workplan.eventTypes.updated") : t("workplan.eventTypes.created"), name.trim());
      resetForm();
      loadList();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("workplan.types.saveFailed"));
      toast.error(editingId ? t("workplan.eventTypes.notUpdated") : t("workplan.eventTypes.notCreated"), apiErrorMessage(err, t("workplan.types.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (et: WorkplanEventType) => {
    if (
      !(await confirm({
        title: t("workplan.eventTypes.deleteTitle"),
        message: t("workplan.eventTypes.deleteMessage", { name: et.name }),
        variant: "danger",
      }))
    ) return; // ship-safe-ignore
    setError(null);
    try {
      await workplanEventTypesApi.delete(et.id);
      toast.success(t("workplan.eventTypes.deleted"), et.name);
      loadList();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("workplan.eventTypes.deleteFailed"));
      toast.error(t("workplan.eventTypes.notDeleted"), apiErrorMessage(err, t("workplan.eventTypes.deleteFailed")));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("workplan.eventTypes.title")}
        subtitle={t("workplan.eventTypes.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.workplan", href: "/workplan" }, { label: t("workplan.eventTypes.title") }]} />}
        actions={
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("workplan.eventTypes.add")}
          </button>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">{editingId ? t("workplan.eventTypes.edit") : t("workplan.eventTypes.new")}</h2>
          <div>
            <label htmlFor="workplan-event-types-name" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.types.nameLabel")}</label>
            <input id="workplan-event-types-name"
              type="text"
              className="form-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workplan.eventTypes.namePlaceholder")}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="workplan-event-types-icon" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.eventTypes.icon")}</label>
              <input id="workplan-event-types-icon"
                type="text"
                className="form-input w-full font-mono text-sm"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder={t("workplan.eventTypes.iconPlaceholder")}
              />
              <p className="text-xs text-neutral-400 mt-1">{t("workplan.eventTypes.iconHint")}</p>
            </div>
            <div>
              <label htmlFor="workplan-event-types-colour" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.eventTypes.colour")}</label>
              <select id="workplan-event-types-colour" className="form-input w-full" value={color} onChange={(e) => setColor(e.target.value)}>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.label)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="workplan-event-types-sort-order" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.types.sortOrder")}</label>
            <input id="workplan-event-types-sort-order"
              type="number"
              min={0}
              className="form-input w-full max-w-[120px]"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? t("workplan.types.saving") : editingId ? t("workplan.types.update") : t("common.create")}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">{t("workplan.eventTypes.title")}</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="event" title={t("workplan.eventTypes.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("workplan.eventTypes.col.type")}</th>
                  <th>{t("workplan.eventTypes.col.slug")}</th>
                  <th>{t("workplan.eventTypes.icon")}</th>
                  <th>{t("workplan.eventTypes.colour")}</th>
                  <th>{t("workplan.types.col.sort")}</th>
                  <th className="text-right">{t("workplan.types.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((et) => (
                  <tr key={et.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${COLOR_DOT[et.color] ?? "bg-neutral-400"}`} />
                        <span className="font-medium text-neutral-900">{et.name}</span>
                        {et.is_system && (
                          <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
                            {t("workplan.eventTypes.system")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono text-xs text-neutral-500">{et.slug}</td>
                    <td>
                      <span className="material-symbols-outlined text-neutral-500 text-[18px]">{et.icon}</span>
                    </td>
                    <td className="text-sm text-neutral-600 capitalize">{et.color}</td>
                    <td className="text-sm text-neutral-600">{et.sort_order ?? "—"}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleEdit(et)} className="btn-secondary text-xs py-1 px-2 mr-2">
                        {t("common.edit")}
                      </button>
                      <button type="button" onClick={() => handleDelete(et)} className="btn-secondary text-xs py-1 px-2 text-red-600">
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
