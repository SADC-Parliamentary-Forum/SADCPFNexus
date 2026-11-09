"use client";

import { useState, useEffect, useCallback } from "react";
import { workplanMeetingTypesApi, type MeetingType } from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MeetingTypesPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [list, setList] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workplanMeetingTypesApi.list();
      setList(res.data?.data ?? []);
    } catch {
      setError(t("workplan.meetingTypes.loadFailed"));
      setList([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setDescription("");
    setSortOrder("");
  };

  const handleEdit = (mt: MeetingType) => {
    setEditingId(mt.id);
    setShowForm(true);
    setName(mt.name);
    setDescription(mt.description ?? "");
    setSortOrder(mt.sort_order != null ? String(mt.sort_order) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await workplanMeetingTypesApi.update(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      } else {
        await workplanMeetingTypesApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      }
      toast.success(editingId ? t("workplan.meetingTypes.updated") : t("workplan.meetingTypes.created"), name.trim());
      resetForm();
      loadList();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("workplan.types.saveFailed"));
      toast.error(editingId ? t("workplan.meetingTypes.notUpdated") : t("workplan.meetingTypes.notCreated"), apiErrorMessage(err, t("workplan.types.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mt: MeetingType) => {
    if (
      !(await confirm({
        title: t("workplan.meetingTypes.deleteTitle"),
        message: t("workplan.meetingTypes.deleteMessage", { name: mt.name }),
        variant: "danger",
      }))
    ) return; // ship-safe-ignore: confirm dialog string, not SQL
    setError(null);
    try {
      await workplanMeetingTypesApi.delete(mt.id);
      toast.success(t("workplan.meetingTypes.deleted"), mt.name);
      loadList();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("workplan.meetingTypes.deleteFailed"));
      toast.error(t("workplan.meetingTypes.notDeleted"), apiErrorMessage(err, t("workplan.meetingTypes.deleteFailed")));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("workplan.meetingTypes.title")}
        subtitle={t("workplan.meetingTypes.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.workplan", href: "/workplan" }, { label: t("workplan.meetingTypes.title") }]} />}
        actions={
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("workplan.meetingTypes.add")}
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
          <h2 className="text-sm font-semibold text-neutral-900">{editingId ? t("workplan.meetingTypes.edit") : t("workplan.meetingTypes.new")}</h2>
          <div>
            <label htmlFor="workplan-meeting-types-name" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.types.nameLabel")}</label>
            <input id="workplan-meeting-types-name"
              type="text"
              className="form-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workplan.meetingTypes.namePlaceholder")}
              required
            />
          </div>
          <div>
            <label htmlFor="workplan-meeting-types-description" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.meetingTypes.description")}</label>
            <textarea id="workplan-meeting-types-description"
              className="form-input w-full min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("workplan.meetingTypes.optional")}
            />
          </div>
          <div>
            <label htmlFor="workplan-meeting-types-sort-order" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.types.sortOrder")}</label>
            <input id="workplan-meeting-types-sort-order"
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
        <div className="card-header">
          <h3 className="text-sm font-semibold text-neutral-900">{t("workplan.meetingTypes.title")}</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span className="ml-2">{t("common.loading")}</span>
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="groups" title={t("workplan.meetingTypes.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("workplan.meetingTypes.col.name")}</th>
                  <th>{t("workplan.meetingTypes.description")}</th>
                  <th>{t("workplan.types.col.sort")}</th>
                  <th className="text-right">{t("workplan.types.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((mt) => (
                  <tr key={mt.id}>
                    <td className="font-medium text-neutral-900">{mt.name}</td>
                    <td className="text-sm text-neutral-600 max-w-[200px] truncate">{mt.description || "—"}</td>
                    <td className="text-sm text-neutral-600">{mt.sort_order ?? "—"}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleEdit(mt)} className="btn-secondary text-xs py-1 px-2 mr-2">
                        {t("common.edit")}
                      </button>
                      <button type="button" onClick={() => handleDelete(mt)} className="btn-secondary text-xs py-1 px-2 text-red-600">
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
