"use client";

import { useState, useEffect } from "react";
import { adminApi, type Portfolio } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function AdminPortfoliosPage() {
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
            .catch(() => toast("error", "Failed to load portfolios"))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (editId) {
                const res = await adminApi.updatePortfolio(editId, form);
                setPortfolios(prev => prev.map(p => p.id === editId ? res.data : p));
                toast("success", "Portfolio updated");
            } else {
                const res = await adminApi.createPortfolio(form);
                setPortfolios(prev => [...prev, res.data]);
                toast("success", "Portfolio created");
            }
            setForm({ name: "", description: "", color: "#3b82f6" });
            setShowForm(false);
            setEditId(null);
        } catch {
            toast("error", "Failed to save portfolio");
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
        if (!(await confirm({ title: "Delete Portfolio", message: `Delete "${name}"?`, variant: "danger" }))) return; // ship-safe-ignore: confirm dialog string, not SQL
        try {
            await adminApi.deletePortfolio(id);
            setPortfolios(prev => prev.filter(p => p.id !== id));
            toast("success", "Portfolio deleted");
        } catch {
            toast("error", "Failed to delete portfolio");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">Portfolios</h1>
                    <p className="page-subtitle">Manage organisational thematic areas and committees.</p>
                </div>
                <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="btn-primary">
                    <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
                    {showForm ? "Cancel" : "New Portfolio"}
                </button>
            </div>

            {showForm && (
                <div className="card p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Portfolio Name</label>
                            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Label Color</label>
                            <input type="color" className="h-10 w-full rounded border cursor-pointer" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Description</label>
                        <textarea className="form-input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={handleSave} disabled={saving} className="btn-primary">
                            {saving ? "Saving..." : editId ? "Update" : "Create"}
                        </button>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Portfolio</th>
                            <th>Description</th>
                            <th>Staff</th>
                            <th className="text-right">Actions</th>
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
                                <td>{p.users_count ?? 0} staff</td>
                                <td className="text-right space-x-2">
                                    <button onClick={() => startEdit(p)} className="text-primary hover:underline text-xs">Edit</button>
                                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-600 hover:underline text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
