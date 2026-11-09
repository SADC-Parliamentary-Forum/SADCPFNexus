"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { adminApi, auditLogsApi, type Department, type User, type AuditLogEntry } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Layout constants ────────────────────────────────────────────────────────
const NODE_W = 228;
const NODE_H = 106;
const H_GAP  = 56;
const V_GAP  = 90;

interface Pos    { x: number; y: number; }
type   PosMap   = Record<number, Pos>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildTree(flat: Department[]): Department[] {
  const map = new Map<number, Department & { children: Department[] }>();
  flat.forEach(d => map.set(d.id, { ...d, children: [] }));
  const roots: Department[] = [];
  flat.forEach(d => {
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(map.get(d.id)!);
    } else {
      roots.push(map.get(d.id)!);
    }
  });
  return roots;
}

function subtreeWidth(node: Department): number {
  const ch = node.children ?? [];
  return ch.length === 0 ? 1 : ch.reduce((s, c) => s + subtreeWidth(c), 0);
}

function autoLayout(roots: Department[]): PosMap {
  const pos: PosMap = {};
  function place(node: Department, depth: number, startCol: number) {
    const children = node.children ?? [];
    let col = startCol;
    const childCxs: number[] = [];
    for (const child of children) {
      const w = subtreeWidth(child);
      place(child, depth + 1, col);
      childCxs.push(col + (w - 1) / 2);
      col += w;
    }
    const cx = children.length > 0
      ? (childCxs[0] + childCxs[childCxs.length - 1]) / 2
      : startCol;
    pos[node.id] = { x: cx * (NODE_W + H_GAP) + 60, y: depth * (NODE_H + V_GAP) + 60 };
  }
  let col = 0;
  for (const root of roots) {
    const w = subtreeWidth(root);
    place(root, 0, col);
    col += w;
  }
  return pos;
}

function isAncestorOf(flat: Department[], ancestorId: number, targetId: number): boolean {
  const t = flat.find(d => d.id === targetId);
  if (!t || !t.parent_id) return false;
  if (t.parent_id === ancestorId) return true;
  return isAncestorOf(flat, ancestorId, t.parent_id);
}

// ─── SVG connectors ───────────────────────────────────────────────────────────
function Connectors({ flat, positions }: { flat: Department[]; positions: PosMap }) {
  const { t } = useI18n();
  return (
    <svg
      className="text-neutral-300 dark:text-neutral-600"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
      width="100%" height="100%"
      role="img"
    >
      <title>{t("organogram.connectors")}</title>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
        </marker>
      </defs>
      {flat.map(node => {
        if (!node.parent_id) return null;
        const from = positions[node.parent_id];
        const to   = positions[node.id];
        if (!from || !to) return null;
        const x1 = from.x + NODE_W / 2;
        const y1 = from.y + NODE_H;
        const x2 = to.x   + NODE_W / 2;
        const y2 = to.y;
        const my = (y1 + y2) / 2;
        return (
          <path
            key={node.id}
            d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
        );
      })}
    </svg>
  );
}

// ─── Node Card ────────────────────────────────────────────────────────────────
interface NodeCardProps {
  dept: Department;
  pos: Pos;
  isRoot: boolean;
  onPointerDown: (e: React.PointerEvent, id: number) => void;
  onEdit: (d: Department) => void;
  onAddChild: (parentId: number) => void;
  onDelete: (id: number) => void;
  onChangeParent: (id: number) => void;
}

function NodeCard({
  dept, pos, isRoot,
  onPointerDown, onEdit, onAddChild, onDelete, onChangeParent,
}: NodeCardProps) {
  const stopP = (e: React.PointerEvent) => e.stopPropagation();
  const { t } = useI18n();

  return (
    <div
      className="group absolute"
      style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H, touchAction: "none", userSelect: "none" }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button")) return;
        onPointerDown(e, dept.id);
      }}
    >
      {/* Hover action buttons */}
      <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto">
        <button
          onPointerDown={stopP} onClick={() => onAddChild(dept.id)}
          className="size-7 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
          title={t("organogram.addChild")}
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
        </button>
        <button
          onPointerDown={stopP} onClick={() => onChangeParent(dept.id)}
          className="size-7 rounded-full bg-amber-50 text-amber-600 border border-amber-200 shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
          title={t("organogram.changeParentHint")}
        >
          <span className="material-symbols-outlined text-[15px]">account_tree</span>
        </button>
        <button
          onPointerDown={stopP} onClick={() => onEdit(dept)}
          className="size-7 rounded-full bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 shadow-lg flex items-center justify-center hover:text-primary hover:scale-110 transition-transform"
          title={t("organogram.editUnitHint")}
        >
          <span className="material-symbols-outlined text-[15px]">edit</span>
        </button>
        <button
          onPointerDown={stopP} onClick={() => onDelete(dept.id)}
          className="size-7 rounded-full bg-white dark:bg-neutral-800 text-red-500 border border-neutral-200 dark:border-neutral-600 shadow-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-110 transition-transform"
          title={t("organogram.deleteUnitHint")}
        >
          <span className="material-symbols-outlined text-[15px]">delete</span>
        </button>
      </div>

      {/* Card body */}
      <div
        className={`h-full bg-white dark:bg-neutral-800 rounded-2xl p-3.5 shadow-sm border border-neutral-200 dark:border-neutral-700 border-t-4 cursor-grab active:cursor-grabbing
          hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-all
          ${isRoot ? "border-t-primary" : "border-t-slate-300 dark:border-t-slate-600"}`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`size-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${isRoot ? "bg-primary/10 text-primary" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"}`}>
            <span className="material-symbols-outlined text-[18px]">{isRoot ? "account_balance" : "hub"}</span>
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 truncate">{dept.code}</p>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 leading-tight truncate text-[13px]">{dept.name}</h3>
          </div>
        </div>

        {dept.supervisor ? (
          <div className="mt-2.5 pt-2.5 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center gap-2">
            <div className="size-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
              {dept.supervisor.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </div>
            <p className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 truncate">{dept.supervisor.name}</p>
          </div>
        ) : (
          <div className="mt-2.5 pt-2.5 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center gap-1.5 opacity-40">
            <span className="material-symbols-outlined text-[13px] text-neutral-400">person_off</span>
            <p className="text-[10px] text-neutral-400 italic">{t("organogram.unassigned")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function OrganogramPage() {
  const [flat,  setFlat]  = useState<Department[]>([]);
  const [tree,  setTree]  = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [positions, setPositions] = useState<PosMap>({});

  // Canvas pan / zoom
  const canvasRef   = useRef<HTMLDivElement>(null);
  const [pan,   setPan]   = useState<Pos>({ x: 60, y: 60 });
  const [scale, setScale] = useState(1);
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef<Pos>({ x: 0, y: 0 });

  // Node dragging
  const dragging = useRef<{ id: number; startNode: Pos; startPtr: Pos } | null>(null);

  // CRUD modal
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", code: "", supervisor_id: null as number | null });
  const [saving, setSaving] = useState(false);

  // Reparent modal
  const [reparentId, setReparentId]     = useState<number | null>(null);
  const [newParentId, setNewParentId]   = useState<number | "root" | null>(null);
  const [reparenting, setReparenting]   = useState(false);

  // History drawer
  const [showHistory,    setShowHistory]    = useState(false);
  const [history,        setHistory]        = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { toast }   = useToast();
  const { t, localeTag } = useI18n();
  const { confirm } = useConfirm();

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [deptRes, userRes] = await Promise.all([
        adminApi.listDepartments(),
        adminApi.listUsers({ per_page: 100 }),
      ]);
      const allDepts: Department[] = (deptRes.data as any).data ?? [];
      const treeData = buildTree(allDepts);
      setFlat(allDepts);
      setTree(treeData);
      setUsers((userRes.data as any).data ?? []);
      // Preserve user-moved positions, re-layout only new nodes
      const computed = autoLayout(treeData);
      setPositions(prev => {
        const next: PosMap = { ...computed };
        Object.keys(prev).forEach(k => {
          const id = parseInt(k);
          if (computed[id] !== undefined) next[id] = prev[id];
        });
        return next;
      });
    } catch {
      setError(t("organogram.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await auditLogsApi.list({ module: "Department", per_page: 50 });
      setHistory(res.data.data ?? []);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  };

  // ── Canvas wheel zoom ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => Math.min(2, Math.max(0.25, s - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Pointer: pan canvas / drag node ───────────────────────────────────────
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".group")) return; // node card
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: number) => {
    e.stopPropagation();
    const pos = positions[id] ?? { x: 0, y: 0 };
    dragging.current = { id, startNode: pos, startPtr: { x: e.clientX, y: e.clientY } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current) {
      const { id, startNode, startPtr } = dragging.current;
      const dx = (e.clientX - startPtr.x) / scale;
      const dy = (e.clientY - startPtr.y) / scale;
      setPositions(prev => ({ ...prev, [id]: { x: startNode.x + dx, y: startNode.y + dy } }));
    } else if (isPanningRef.current) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
    }
  };

  const handlePointerUp = () => {
    dragging.current    = null;
    isPanningRef.current = false;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const openCreateModal = (parentId: number | null) => {
    setEditingDept(null);
    setFormParentId(parentId);
    setForm({ name: "", code: "", supervisor_id: null });
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormParentId(dept.parent_id ?? null);
    setForm({ name: dept.name, code: dept.code, supervisor_id: dept.supervisor_id ?? null });
    setModalOpen(true);
  };

  const closeCrudModal = () => setModalOpen(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingDept) {
        await adminApi.updateDepartment(editingDept.id, { ...form, parent_id: formParentId });
      } else {
        await adminApi.createDepartment({ ...form, parent_id: formParentId });
      }
      setModalOpen(false);
      toast("success", t("organogram.toast.saved"), t("organogram.toast.savedDetail"));
      fetchData();
    } catch {
      toast("error", t("organogram.toast.saveFailed"), t("organogram.toast.saveFailedDetail"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const dept = flat.find(d => d.id === id);
    if (!await confirm({ title: t("organogram.confirm.deleteTitle"), message: t("organogram.confirm.deleteMessage", { name: dept?.name ?? "" }), variant: "danger" })) return;
    try {
      await adminApi.deleteDepartment(id);
      toast("success", t("organogram.toast.deleted"), t("organogram.toast.deletedDetail"));
      fetchData();
    } catch {
      toast("error", t("organogram.toast.deleteFailed"), t("organogram.toast.deleteFailedDetail"));
    }
  };

  // ── Reparent ──────────────────────────────────────────────────────────────
  const openReparent = (id: number) => {
    const dept = flat.find(d => d.id === id);
    setNewParentId(dept?.parent_id ?? "root");
    setReparentId(id);
  };

  const submitReparent = async () => {
    if (reparentId === null) return;
    const dept = flat.find(d => d.id === reparentId);
    if (!dept) return;
    const resolvedParent = newParentId === "root" ? null : (newParentId as number | null);
    if (resolvedParent && isAncestorOf(flat, reparentId, resolvedParent)) {
      toast("error", t("organogram.toast.invalidMove"), t("organogram.toast.invalidMoveDetail"));
      return;
    }
    setReparenting(true);
    try {
      await adminApi.updateDepartment(reparentId, { name: dept.name, code: dept.code, parent_id: resolvedParent });
      setReparentId(null);
      toast("success", t("organogram.toast.moved"), t("organogram.toast.movedDetail", { name: dept.name }));
      fetchData();
    } catch {
      toast("error", t("organogram.toast.moveFailed"), t("organogram.toast.moveFailedDetail"));
    } finally {
      setReparenting(false);
    }
  };

  // ── Canvas world size ─────────────────────────────────────────────────────
  const vals = Object.values(positions);
  const worldW = vals.length ? Math.max(...vals.map(p => p.x + NODE_W + 100)) : 1400;
  const worldH = vals.length ? Math.max(...vals.map(p => p.y + NODE_H + 100)) : 900;
  const rootIds = new Set(tree.map(r => r.id));

  const reparentDept = flat.find(d => d.id === reparentId);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <ModulePageHeader
        title={t("organogram.title")}
        subtitle={t("organogram.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("organogram.breadcrumbPeople"), href: "/people" },
              { label: t("organogram.title") },
            ]}
          />
        }
        actions={
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setPositions(autoLayout(tree)); setPan({ x: 60, y: 60 }); setScale(1); }}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
              {t("organogram.autoLayout")}
            </button>
            <button
              type="button"
              onClick={() => { setShowHistory(true); loadHistory(); }}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              {t("organogram.history")}
            </button>
            <button
              type="button"
              onClick={() => openCreateModal(null)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t("organogram.addUnit")}
            </button>
          </div>
        }
        className="mb-4"
      />

      {/* ─ Zoom bar ─ */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          aria-label={t("organogram.zoomIn")}
          title={t("organogram.zoomIn")}
          onClick={() => setScale(s => Math.min(2, +(s + 0.1).toFixed(2)))}
          className="size-7 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-700 shadow-sm text-neutral-600 dark:text-neutral-300"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 w-11 text-center font-mono tabular-nums">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          aria-label={t("organogram.zoomOut")}
          title={t("organogram.zoomOut")}
          onClick={() => setScale(s => Math.max(0.25, +(s - 0.1).toFixed(2)))}
          className="size-7 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-700 shadow-sm text-neutral-600 dark:text-neutral-300"
        >
          <span className="material-symbols-outlined text-[16px]">remove</span>
        </button>
        <button
          type="button"
          aria-label={t("organogram.resetViewLabel")}
          title={t("organogram.resetViewLabel")}
          onClick={() => { setScale(1); setPan({ x: 60, y: 60 }); }}
          className="text-[11px] text-neutral-400 hover:text-primary px-2"
        >
          {t("organogram.resetView")}
        </button>
        <span className="ml-auto text-[11px] text-neutral-400">{t(flat.length !== 1 ? "organogram.units" : "organogram.unit", { count: flat.length })}</span>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">error</span>{error}</span>
          <button type="button" aria-label={t("organogram.dismissError")} title={t("organogram.dismissError")} onClick={() => setError(null)}><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      )}

      {/* ─ Canvas ─ */}
      <div
        ref={canvasRef}
        className="organogram-canvas flex-1 rounded-2xl overflow-hidden relative select-none"
        style={{ cursor: isPanningRef.current ? "grabbing" : "grab" }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary/20">progress_activity</span>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              width: worldW,
              height: worldH,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            <Connectors flat={flat} positions={positions} />

            {flat.map(dept => {
              const pos = positions[dept.id];
              if (!pos) return null;
              return (
                <NodeCard
                  key={dept.id}
                  dept={dept}
                  pos={pos}
                  isRoot={rootIds.has(dept.id)}
                  onPointerDown={handleNodePointerDown}
                  onEdit={openEditModal}
                  onAddChild={openCreateModal}
                  onDelete={handleDelete}
                  onChangeParent={openReparent}
                />
              );
            })}

            {flat.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <EmptyState
                  icon="account_tree"
                  title={t("organogram.emptyTitle")}
                  description={t("organogram.emptyDescription")}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─ Change Parent Modal ─ */}
      {reparentId !== null && reparentDept && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="size-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600 text-[26px]">account_tree</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{t("organogram.changeParent")}</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("organogram.moveDescription", { name: reparentDept.name })}</p>
              </div>
            </div>

            {/* Current path */}
            <div className="mb-5 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">{t("organogram.currentlyUnder")}</p>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {reparentDept.parent_id
                  ? flat.find(d => d.id === reparentDept.parent_id)?.name ?? t("organogram.unknown")
                  : t("organogram.rootUnit")}
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="organogram-new-parent-unit" className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{t("organogram.newParent")}</label>
              <select id="organogram-new-parent-unit"
                className="input-field w-full"
                value={newParentId === null || newParentId === "root" ? "root" : String(newParentId)}
                onChange={e => setNewParentId(e.target.value === "root" ? "root" : parseInt(e.target.value))}
              >
                <option value="root">{t("organogram.makeRoot")}</option>
                {flat
                  .filter(d =>
                    d.id !== reparentId &&
                    !isAncestorOf(flat, reparentId, d.id)
                  )
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5 ml-1">{t("organogram.descendantsExcluded")}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setReparentId(null)} className="flex-1 btn-secondary py-2.5 font-semibold">
                {t("common.cancel")}
              </button>
              <button
                onClick={submitReparent}
                disabled={reparenting}
                className="flex-1 btn-primary py-2.5 font-semibold flex items-center justify-center gap-2"
              >
                {reparenting
                  ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> {t("organogram.moving")}</>
                  : <><span className="material-symbols-outlined text-[16px]">check</span> {t("organogram.confirmMove")}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ CRUD Modal ─ */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={closeCrudModal}
          size="md"
          className="max-w-md rounded-3xl dark:shadow-black/40"
          bodyClassName="space-y-4"
          title={
            <span className="flex items-center gap-4">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
                <span className="material-symbols-outlined text-[26px] text-primary dark:text-primary-300">
                  {editingDept ? "edit_square" : "add_business"}
                </span>
              </span>
              <span>{editingDept ? t("organogram.editUnit") : t("organogram.createUnit")}</span>
            </span>
          }
          description={<span className="text-xs font-bold uppercase tracking-widest">{t("organogram.management")}</span>}
          footer={
            <>
              <button onClick={closeCrudModal} className="flex-1 btn-secondary py-3 font-bold">{t("common.cancel")}</button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.code || saving}
                className="flex-1 btn-primary py-3 font-bold"
              >
                {saving ? t("organogram.saving") : t("organogram.saveUnit")}
              </button>
            </>
          }
        >
              <div>
                <label htmlFor="organogram-unit-name" className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{t("organogram.unitName")}</label>
                <input
                  id="organogram-unit-name"
                  className="input-field w-full"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t("organogram.unitNamePlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="organogram-unit-code" className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{t("organogram.unitCode")}</label>
                  <input
                    id="organogram-unit-code"
                    className="input-field font-mono uppercase w-full"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="FIN"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label htmlFor="organogram-unit-supervisor" className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{t("organogram.supervisor")}</label>
                  <select
                    id="organogram-unit-supervisor"
                    className="input-field w-full"
                    value={form.supervisor_id ?? ""}
                    onChange={e => setForm(f => ({ ...f, supervisor_id: e.target.value ? parseInt(e.target.value) : null }))}
                  >
                    <option value="">{t("organogram.none")}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Parent selector in create mode */}
              {!editingDept && (
                <div>
                  <label htmlFor="organogram-parent-unit" className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">{t("organogram.parentUnit")}</label>
                  <select
                    id="organogram-parent-unit"
                    className="input-field w-full"
                    value={formParentId ?? ""}
                    onChange={e => setFormParentId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">{t("organogram.noneRoot")}</option>
                    {flat.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
              )}
        </Modal>
      )}

      {/* ─ Change History Drawer ─ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("organogram.historyTitle")}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={t("organogram.refreshHistory")} title={t("organogram.refreshHistory")} onClick={loadHistory} className="text-neutral-400 hover:text-neutral-600 p-1">
                  <span className={`material-symbols-outlined text-[18px] ${historyLoading ? "animate-spin" : ""}`}>refresh</span>
                </button>
                <button type="button" aria-label={t("organogram.closeHistory")} title={t("organogram.closeHistory")} onClick={() => setShowHistory(false)} className="text-neutral-400 hover:text-neutral-600 p-1">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="space-y-3 p-5 animate-pulse">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-700/40 rounded-xl" />)}
                </div>
              ) : history.length === 0 ? (
                <EmptyState icon="history" title={t("organogram.noChanges")} />
              ) : (
                <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {history.map(entry => {
                    const isCreate = entry.action.includes("created");
                    const isDelete = entry.action.includes("deleted");
                    const cls  = isCreate ? "text-green-600 bg-green-50" : isDelete ? "text-red-500 bg-red-50" : "text-primary bg-primary/10";
                    const icon = isCreate ? "add_circle" : isDelete ? "delete" : "edit";
                    const label = entry.action.replace("department.", "").replace(/_/g, " ");
                    return (
                      <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cls}`}>
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 capitalize">{label}</p>
                            <span className="text-[11px] text-neutral-400 flex-shrink-0">
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" }) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500">{entry.user_name ?? entry.user ?? t("assignments.detail.system")}</p>
                          {entry.record_id && entry.record_id !== "—" && (
                            <p className="text-[11px] font-mono text-neutral-400">{t("organogram.recordId", { id: String(entry.record_id) })}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-neutral-100 dark:border-neutral-700 px-5 py-3">
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{t("organogram.historyFooter")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
