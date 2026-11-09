"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import { adminApi, type Portfolio } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AdminPortfoliosPage() {
    const { t } = useI18n();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<{ name: string; description: string; color: string }>({ name: "", description: "", color: "#3b82f6" });
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { confirm } = useConfirm();

    useEffect(() => {
        adminApi.listPortfolios()
            .then(res => setPortfolios(res.data))
            .catch(() => toast("error", t("admin.portfolios.loadFailed")))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (editId) {
                const res = await adminApi.updatePortfolio(editId, form);
                setPortfolios(prev => prev.map(p => p.id === editId ? res.data : p));
                toast("success", t("admin.portfolios.updated"));
            } else {
                const res = await adminApi.createPortfolio(form);
                setPortfolios(prev => [...prev, res.data]);
                toast("success", t("admin.portfolios.created"));
            }
            setForm({ name: "", description: "", color: "#3b82f6" });
            setShowForm(false);
            setEditId(null);
        } catch {
            toast("error", t("admin.portfolios.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (p: Portfolio) => {
        setEditId(p.id);
        setForm({ name: p.name, description: p.description || "", color: p.color || "#3b82f6" });
        setShowForm(true);
    };

    const handleDelete = async (id: number, name: string) => {
        if (!(await confirm({ title: t("admin.portfolios.deleteTitle"), message: t("admin.portfolios.deleteMessage", { name }), variant: "danger" }))) return; // ship-safe-ignore: confirm dialog string, not SQL
        try {
            await adminApi.deletePortfolio(id);
            setPortfolios(prev => prev.filter(p => p.id !== id));
            toast("success", t("admin.portfolios.deleted"));
        } catch {
            toast("error", t("admin.portfolios.deleteFailed"));
        }
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex items-start justify-between">
                <ModulePageHeader
        title={t("admin.portfolios.title")}
        subtitle={t("admin.portfolios.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.portfolios.title") }]} />}
      />
                <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="btn-primary">
                    <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
                    {showForm ? t("common.cancel") : t("admin.portfolios.new")}
                </button>
            </div>

            {showForm && (
                <div className="card p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="admin-portfolios-portfolio-name" className="text-xs font-semibold">{t("admin.portfolios.name")}</label>
                            <input id="admin-portfolios-portfolio-name" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="admin-portfolios-label-color" className="text-xs font-semibold">{t("admin.portfolios.color")}</label>
                            <input id="admin-portfolios-label-color" type="color" className="h-10 w-full rounded border cursor-pointer" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="admin-portfolios-description" className="text-xs font-semibold">{t("admin.common.description")}</label>
                        <textarea id="admin-portfolios-description" className="form-input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={handleSave} disabled={saving} className="btn-primary">
                            {saving ? t("admin.common.savingDots") : editId ? t("admin.auditTrail.governance.update") : t("common.create")}
                        </button>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t("admin.portfolios.colPortfolio")}</th>
                            <th>{t("admin.common.description")}</th>
                            <th>{t("admin.portfolios.colStaff")}</th>
                            <th className="text-right">{t("admin.common.actions")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {portfolios.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full" style={{ backgroundColor: p.color || "#ccc" }} />
                                        <span className="font-semibold">{p.name}</span>
                                    </div>
                                </td>
                                <td className="text-sm text-neutral-500 max-w-xs truncate">{p.description}</td>
                                <td>{t("admin.portfolios.staffCount", { count: p.users_count ?? 0 })}</td>
                                <td className="text-right space-x-2">
                                    <button onClick={() => startEdit(p)} className="btn-secondary text-xs py-1 px-2">{t("common.edit")}</button>
                                    <button onClick={() => handleDelete(p.id, p.name)} className="btn-secondary text-xs py-1 px-2 text-red-600">{t("common.delete")}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
