"use client";

import { useState, useEffect, useRef } from "react";
import { adminApi, type Department, type User } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface NodeProps {
    dept: Department;
    level?: number;
    onEdit: (d: Department) => void;
    onAddChild: (parentId: number) => void;
    onDelete: (id: number) => void;
    onMove: (id: number, newParentId: number | null) => void;
    isAncestorOf: (ancestorId: number, targetId: number) => boolean;
    draggedId: number | null;
    setDraggedId: (id: number | null) => void;
}

function DepartmentNode({
    dept,
    level = 0,
    onEdit,
    onAddChild,
    onDelete,
    onMove,
    isAncestorOf,
    draggedId,
    setDraggedId
}: NodeProps) {
    const hasChildren = dept.children && dept.children.length > 0;
    const [isExpanded, setIsExpanded] = useState(true);
    const [isOver, setIsOver] = useState(false);
    const { confirm } = useConfirm();

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", dept.id.toString());
        setDraggedId(dept.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedId === null || draggedId === dept.id) return;

        // Prevent dropping a parent into its own descendant (circularity)
        if (isAncestorOf(draggedId, dept.id)) {
            e.dataTransfer.dropEffect = "none";
            return;
        }

        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(false);
        const sourceId = parseInt(e.dataTransfer.getData("text/plain"));
        if (sourceId === dept.id) return;
        onMove(sourceId, dept.id);
        setDraggedId(null);
    };

    return (
        <div className="flex flex-col items-center">
            {/* Node Container */}
            <div
                className={`relative group transition-all duration-300 ${isOver ? "scale-105" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsOver(false)}
                onDrop={handleDrop}
            >
                {level > 0 && (
                    <div className="absolute -top-6 left-1/2 w-px h-6 bg-neutral-200 -translate-x-1/2" />
                )}

                {/* Node Card */}
                <div
                    draggable
                    onDragStart={handleDragStart}
                    onDragEnd={() => setDraggedId(null)}
                    className={`card relative p-4 w-64 shadow-sm border-t-4 transition-all hover:shadow-lg cursor-grab active:cursor-grabbing
            ${level === 0 ? "border-t-primary" : "border-t-neutral-300"}
            ${isOver ? "ring-4 ring-primary/20 border-primary" : ""}
            ${draggedId === dept.id ? "opacity-30 grayscale" : "opacity-100"}
          `}
                >
                    {/* Actions Menu (Hover) */}
                    <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddChild(dept.id); }}
                            className="size-7 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                            title="Add Unit"
                        >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(dept); }}
                            className="size-7 rounded-full bg-white text-neutral-600 border border-neutral-200 shadow-lg flex items-center justify-center hover:text-primary hover:scale-110 transition-transform"
                            title="Edit Unit"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (await confirm({ title: "Delete Department", message: `Are you sure you want to remove ${dept.name}?`, variant: "danger" })) {
                                    onDelete(dept.id);
                                }
                            }}
                            className="size-7 rounded-full bg-white text-red-500 border border-neutral-200 shadow-lg flex items-center justify-center hover:bg-red-50 hover:scale-110 transition-transform"
                            title="Delete Unit"
                        >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-2">
                        <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${level === 0 ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500"}`}>
                            <span className="material-symbols-outlined text-[20px]">{level === 0 ? "account_balance" : "hub"}</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 truncate">{dept.code}</p>
                            <h3 className="font-bold text-neutral-900 leading-tight truncate">{dept.name}</h3>
                        </div>
                    </div>

                    {dept.supervisor ? (
                        <div className="mt-3 pt-3 border-t border-neutral-50 flex items-center gap-2">
                            <div className="size-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold border border-white shadow-sm flex-shrink-0">
                                {dept.supervisor.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-tight">Supervisor</p>
                                <p className="text-[11px] font-bold text-neutral-700 truncate">{dept.supervisor.name}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 pt-3 border-t border-neutral-50 flex items-center gap-1.5 opacity-40">
                            <span className="material-symbols-outlined text-[14px] text-neutral-400">person_off</span>
                            <p className="text-[10px] font-medium text-neutral-400 italic">Unassigned</p>
                        </div>
                    )}

                    {/* Expand Toggle */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                        {hasChildren && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="size-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-primary hover:border-primary shadow-sm transition-all"
                            >
                                <span className="material-symbols-outlined text-[16px]">{isExpanded ? "remove" : "add"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Children Container */}
            {hasChildren && isExpanded && (
                <div className="mt-12 flex gap-8 relative px-4">
                    <div className="absolute -top-6 left-12 right-12 h-px bg-neutral-200" />
                    {dept.children!.map((child) => (
                        <DepartmentNode
                            key={child.id}
                            dept={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onMove={onMove}
                            isAncestorOf={isAncestorOf}
                            draggedId={draggedId}
                            setDraggedId={setDraggedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OrganogramPage() {
    const [allDepartmentsFlat, setAllDepartmentsFlat] = useState<Department[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const { toast } = useToast();

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [formParentId, setFormParentId] = useState<number | null>(null);
    const [form, setForm] = useState({ name: "", code: "", supervisor_id: null as number | null });
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        try {
            const [deptRes, userRes] = await Promise.all([
                adminApi.listDepartments(),
                adminApi.listUsers({ per_page: 100 })
            ]);

            const allDepts = (deptRes.data as any).data ?? [];
            setAllDepartmentsFlat(allDepts);
            setUsers((userRes.data as any).data ?? []);

            const deptMap = new Map();
            allDepts.forEach((d: Department) => deptMap.set(d.id, { ...d, children: [] }));

            const roots: Department[] = [];
            allDepts.forEach((d: Department) => {
                const node = deptMap.get(d.id);
                if (d.parent_id && deptMap.has(d.parent_id)) {
                    deptMap.get(d.parent_id).children.push(node);
                } else {
                    roots.push(node);
                }
            });

            setDepartments(roots);
        } catch {
            setError("Failed to sync organisational structure.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Check if a node is an ancestor of another target node
    const isAncestorOf = (ancestorId: number, targetId: number): boolean => {
        const target = allDepartmentsFlat.find(d => d.id === targetId);
        if (!target || !target.parent_id) return false;
        if (target.parent_id === ancestorId) return true;
        return isAncestorOf(ancestorId, target.parent_id);
    };

    const handleMove = async (id: number, newParentId: number | null) => {
        try {
            // Get original dept to preserve name and code (Update API expects them)
            const dept = allDepartmentsFlat.find(d => d.id === id);
            if (!dept) return;

            await adminApi.updateDepartment(id, {
                name: dept.name,
                code: dept.code,
                parent_id: newParentId
            });
            fetchData();
        } catch {
            setError("Failed to move department.");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await adminApi.deleteDepartment(id);
            fetchData();
        } catch {
            setError("Failed to delete unit. It might have staff or sub-units.");
        }
    };

    const openCreateModal = (parentId: number | null) => {
        setEditingDept(null);
        setFormParentId(parentId);
        setForm({ name: "", code: "", supervisor_id: null });
        setModalOpen(true);
    };

    const openEditModal = (dept: Department) => {
        setEditingDept(dept);
        setFormParentId(dept.parent_id || null);
        setForm({ name: dept.name, code: dept.code, supervisor_id: dept.supervisor_id || null });
        setModalOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingDept) {
                await adminApi.updateDepartment(editingDept.id, {
                    ...form,
                    parent_id: formParentId
                });
            } else {
                await adminApi.createDepartment({
                    ...form,
                    parent_id: formParentId
                });
            }
            setModalOpen(false);
            fetchData();
            toast("success", "Unit Saved", "The organisational unit has been updated successfully.");
        } catch {
            toast("error", "Save Failed", "Failed to save the department changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="page-title">Interactive Organogram</h1>
                    <p className="page-subtitle text-neutral-500">Manage structure via Drag-and-Drop. Use node actions to build your units.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => openCreateModal(null)}
                        className="btn-primary"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        New Root Unit
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 card p-4 bg-red-50 border-red-200 text-red-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined">error</span>
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary/30">progress_activity</span>
                </div>
            ) : (
                <div
                    className={`flex-1 bg-neutral-50 border border-neutral-100 rounded-3xl shadow-inner overflow-auto p-12 transition-colors
                        ${draggedId ? "bg-primary/[0.02]" : ""}
                    `}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => { e.preventDefault(); if (draggedId) handleMove(draggedId, null); }}
                >
                    <div className="inline-flex min-w-full justify-center">
                        <div className="flex flex-col items-center gap-12">
                            {departments.map(root => (
                                <DepartmentNode
                                    key={root.id}
                                    dept={root}
                                    onEdit={openEditModal}
                                    onAddChild={openCreateModal}
                                    onDelete={handleDelete}
                                    onMove={handleMove}
                                    isAncestorOf={isAncestorOf}
                                    draggedId={draggedId}
                                    setDraggedId={setDraggedId}
                                />
                            ))}
                            {departments.length === 0 && (
                                <div className="flex flex-col items-center gap-4 text-neutral-400 py-20">
                                    <span className="material-symbols-outlined text-6xl opacity-20">account_tree</span>
                                    <p className="font-bold">Org structure is empty</p>
                                    <p className="text-xs">Start by creating a root unit.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CRUD Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-neutral-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-[28px]">
                                    {editingDept ? "edit_square" : "add_business"}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-neutral-900">{editingDept ? "Edit Unit" : "Create New Unit"}</h2>
                                <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Organisational Management</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Unit Name</label>
                                <input
                                    className="input-field"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Finance & Admin"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Unit Code</label>
                                    <input
                                        className="input-field font-mono uppercase"
                                        value={form.code}
                                        onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        placeholder="FIN"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Supervisor</label>
                                    <select
                                        className="input-field"
                                        value={form.supervisor_id || ""}
                                        onChange={e => setForm({ ...form, supervisor_id: e.target.value ? parseInt(e.target.value) : null })}
                                    >
                                        <option value="">None</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-10">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="flex-1 btn-secondary py-3 flex justify-center font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!form.name || !form.code || saving}
                                className="flex-1 btn-primary py-3 flex justify-center font-bold"
                            >
                                {saving ? "Saving..." : "Save Unit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

