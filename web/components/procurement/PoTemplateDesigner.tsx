"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  PALETTE,
  PO_APPROVAL_LAYOUTS,
  PO_TABLE_COLUMNS,
  addPaletteItem,
  duplicateElement,
  moveElement,
  pageSizeMm,
  removeElement,
  resizeElement,
  sampleLabel,
  setZOrder,
  type PoElement,
  type PoLayout,
  updateElement,
} from "@/lib/poTemplateLayout";

type DragState =
  | { mode: "move"; id: string; originX: number; originY: number; startX: number; startY: number }
  | { mode: "resize"; id: string; originW: number; originH: number; startX: number; startY: number };

export function PoTemplateDesigner({
  layout,
  onChange,
}: {
  layout: PoLayout;
  onChange: (next: PoLayout) => void;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(layout.elements[0]?.id ?? null);
  const dragRef = useRef<DragState | null>(null);
  const pxPerMmRef = useRef(2.6);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const undoRef = useRef<PoLayout[]>([]);

  const page = pageSizeMm(layout.page.orientation);
  const canvasWidth = Math.min(620, Math.max(360, page.w * 2.7));
  const pxPerMm = canvasWidth / page.w;
  pxPerMmRef.current = pxPerMm;
  const canvasHeight = page.h * pxPerMm;

  const selected = layout.elements.find((el) => el.id === selectedId) ?? null;
  const ordered = useMemo(
    () => [...layout.elements].sort((a, b) => a.z - b.z),
    [layout.elements]
  );

  const commit = useCallback(
    (next: PoLayout) => {
      undoRef.current = [...undoRef.current.slice(-29), layoutRef.current];
      onChange(next);
    },
    [onChange]
  );

  const applyPointer = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const scale = pxPerMmRef.current;
    if (drag.mode === "move") {
      commit(moveElement(layoutRef.current, drag.id, drag.originX + (clientX - drag.startX) / scale, drag.originY + (clientY - drag.startY) / scale));
    } else {
      commit(resizeElement(layoutRef.current, drag.id, drag.originW + (clientX - drag.startX) / scale, drag.originH + (clientY - drag.startY) / scale));
    }
  }, [commit]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      applyPointer(e.clientX, e.clientY);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [applyPointer]);

  function startMove(event: ReactPointerEvent, item: PoElement) {
    if (item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = { mode: "move", id: item.id, originX: item.x_mm, originY: item.y_mm, startX: event.clientX, startY: event.clientY };
  }

  function startResize(event: ReactPointerEvent, item: PoElement) {
    if (item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = { mode: "resize", id: item.id, originW: item.w_mm, originH: item.h_mm, startX: event.clientX, startY: event.clientY };
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (prev) onChange(prev);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
      <aside className="card p-3 space-y-2 h-fit">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("po.designer.elements")}</h3>
        <div className="grid gap-1">
          {PALETTE.map((item) => (
            <button
              key={`${item.type}-${item.binding ?? item.labelKey}`}
              type="button"
              className="text-left text-xs px-2 py-1.5 rounded-md border border-neutral-200 hover:border-primary/40 hover:bg-primary/5"
              onClick={() => {
                const next = addPaletteItem(layout, item);
                commit(next);
                const last = next.elements[next.elements.length - 1];
                if (last) setSelectedId(last.id);
              }}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </aside>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("po.designer.canvas")}</h3>
          <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={undo} data-testid="po-designer-undo">
            {t("po.designer.undo")}
          </button>
        </div>
        <div className="overflow-auto rounded-xl bg-neutral-200/80 p-4">
          <div
            data-testid="po-designer-canvas"
            className="relative mx-auto bg-white shadow-md"
            style={{ width: canvasWidth, height: canvasHeight, backgroundImage: "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: `${pxPerMm * 5}px ${pxPerMm * 5}px` }}
            onPointerDown={() => setSelectedId(null)}
          >
            {ordered.map((el) => {
              if (el.hidden) return null;
              const isSel = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  data-testid={`po-el-${el.type}`}
                  className={`absolute overflow-hidden text-[10px] leading-tight px-1 ${isSel ? "ring-2 ring-primary" : "ring-1 ring-neutral-300/80"} ${el.locked ? "cursor-not-allowed" : "cursor-move"} ${el.border ? "border border-neutral-800" : ""}`}
                  style={{
                    left: el.x_mm * pxPerMm,
                    top: el.y_mm * pxPerMm,
                    width: el.w_mm * pxPerMm,
                    height: el.h_mm * pxPerMm,
                    zIndex: el.z + 1,
                    fontWeight: el.bold ? 700 : 400,
                    fontSize: Math.max(8, el.font_size * 0.85),
                    textAlign: el.align,
                    opacity: el.locked ? 0.75 : 1,
                  }}
                  onPointerDown={(e) => startMove(e, el)}
                >
                  {sampleLabel(el)}
                  {isSel && !el.locked && (
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 bg-primary cursor-se-resize"
                      onPointerDown={(e) => startResize(e, el)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="card p-3 space-y-3 h-fit">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("po.designer.properties")}</h3>
        {!selected ? (
          <p className="text-xs text-neutral-500">{t("po.designer.selectHint")}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-neutral-900">{sampleLabel(selected)}</p>
            {(["x_mm", "y_mm", "w_mm", "h_mm"] as const).map((key) => (
              <label key={key} className="block text-xs">
                <span className="text-neutral-500 uppercase tracking-wide">{key.replace("_mm", " (mm)")}</span>
                <input
                  className="form-input mt-1"
                  type="number"
                  step={0.5}
                  value={selected[key]}
                  onChange={(e) => commit(updateElement(layout, selected.id, { [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <label className="block text-xs">
              <span className="text-neutral-500 uppercase tracking-wide">{t("po.designer.fontSize")}</span>
              <input
                className="form-input mt-1"
                type="number"
                min={6}
                max={28}
                value={selected.font_size}
                onChange={(e) => commit(updateElement(layout, selected.id, { font_size: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-xs">
              <span className="text-neutral-500 uppercase tracking-wide">{t("po.designer.align")}</span>
              <select
                className="form-input mt-1"
                value={selected.align}
                onChange={(e) => commit(updateElement(layout, selected.id, { align: e.target.value as PoElement["align"] }))}
              >
                <option value="left">{t("po.designer.alignLeft")}</option>
                <option value="center">{t("po.designer.alignCenter")}</option>
                <option value="right">{t("po.designer.alignRight")}</option>
              </select>
            </label>
            {(selected.type === "heading" || selected.type === "text") && (
              <label className="block text-xs">
                <span className="text-neutral-500 uppercase tracking-wide">{t("po.designer.text")}</span>
                <input
                  className="form-input mt-1"
                  value={selected.text ?? ""}
                  onChange={(e) => commit(updateElement(layout, selected.id, { text: e.target.value }))}
                />
              </label>
            )}
            {selected.type === "approval_block" && (
              <label className="block text-xs">
                <span className="text-neutral-500 uppercase tracking-wide">{t("po.designer.approvalLayout")}</span>
                <select
                  className="form-input mt-1"
                  value={selected.layout ?? "horizontal"}
                  onChange={(e) => commit(updateElement(layout, selected.id, { layout: e.target.value as PoElement["layout"] }))}
                >
                  {PO_APPROVAL_LAYOUTS.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </label>
            )}
            {selected.type === "table" && (
              <fieldset className="space-y-1">
                <legend className="text-xs text-neutral-500 uppercase tracking-wide">{t("po.designer.columns")}</legend>
                {PO_TABLE_COLUMNS.map((col) => {
                  const checked = (selected.columns ?? []).includes(col);
                  return (
                    <label key={col} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = selected.columns ?? [];
                          const next = checked ? current.filter((c) => c !== col) : [...current, col];
                          commit(updateElement(layout, selected.id, { columns: next }));
                        }}
                      />
                      {col}
                    </label>
                  );
                })}
              </fieldset>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selected.bold} onChange={(e) => commit(updateElement(layout, selected.id, { bold: e.target.checked }))} />
              {t("po.designer.bold")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selected.border} onChange={(e) => commit(updateElement(layout, selected.id, { border: e.target.checked }))} />
              {t("po.designer.border")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selected.locked} onChange={(e) => commit(updateElement(layout, selected.id, { locked: e.target.checked }))} />
              {t("po.designer.lock")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selected.hidden} onChange={(e) => commit(updateElement(layout, selected.id, { hidden: e.target.checked }))} />
              {t("po.designer.hide")}
            </label>
            <div className="flex flex-wrap gap-1">
              <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => commit(setZOrder(layout, selected.id, "forward"))}>{t("po.designer.bringForward")}</button>
              <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => commit(setZOrder(layout, selected.id, "back"))}>{t("po.designer.sendBack")}</button>
              <button type="button" className="btn-secondary text-xs px-2 py-1" data-testid="po-designer-duplicate" onClick={() => commit(duplicateElement(layout, selected.id))}>{t("po.designer.duplicate")}</button>
              <button type="button" className="btn-secondary text-xs px-2 py-1 text-red-700" onClick={() => { commit(removeElement(layout, selected.id)); setSelectedId(null); }}>{t("po.designer.delete")}</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
