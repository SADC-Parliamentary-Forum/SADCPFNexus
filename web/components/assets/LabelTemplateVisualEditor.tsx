"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  LAYOUT_IDS,
  type LayoutItem,
  type LayoutItemId,
  labelsPerPage,
  moveItem,
  pageOverflows,
  resizeItem,
  setItemVisible,
} from "@/lib/labelTemplateLayout";

type Kind = "permanent" | "custody";

type Geometry = {
  page_width_mm: number;
  page_height_mm: number;
  margin_top_mm: number;
  margin_left_mm: number;
  label_width_mm: number;
  label_height_mm: number;
  h_gap_mm: number;
  v_gap_mm: number;
  rows: number;
  columns: number;
  font_pt: number;
  kind: Kind;
};

const ITEM_KEYS: Record<LayoutItemId, string> = {
  org: "assets.labels.itemOrg",
  notice: "assets.labels.itemNotice",
  tag: "assets.labels.itemTag",
  name: "assets.labels.itemName",
  model: "assets.labels.itemModel",
  serial: "assets.labels.itemSerial",
  location: "assets.labels.itemLocation",
  custodian: "assets.labels.itemCustodian",
  qr: "assets.labels.itemQr",
};

type DragState =
  | { mode: "move"; id: LayoutItemId; originX: number; originY: number; startX: number; startY: number }
  | { mode: "resize"; id: LayoutItemId; originW: number; originH: number; startX: number; startY: number };

export function LabelTemplateVisualEditor({
  geometry,
  layout,
  onChange,
  onReset,
}: {
  geometry: Geometry;
  layout: LayoutItem[];
  onChange: (next: LayoutItem[]) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const canvasId = useId();
  const [selectedId, setSelectedId] = useState<LayoutItemId>("tag");
  const dragRef = useRef<DragState | null>(null);
  const pxPerMmRef = useRef(4);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const size = {
    labelWidthMm: geometry.label_width_mm,
    labelHeightMm: geometry.label_height_mm,
  };
  const overflow = pageOverflows({
    pageWidthMm: geometry.page_width_mm,
    pageHeightMm: geometry.page_height_mm,
    marginTopMm: geometry.margin_top_mm,
    marginLeftMm: geometry.margin_left_mm,
    labelWidthMm: geometry.label_width_mm,
    labelHeightMm: geometry.label_height_mm,
    hGapMm: geometry.h_gap_mm,
    vGapMm: geometry.v_gap_mm,
    rows: geometry.rows,
    columns: geometry.columns,
  });
  const perPage = labelsPerPage(geometry.rows, geometry.columns);
  const canvasWidth = Math.min(420, Math.max(240, geometry.label_width_mm * 5.2));
  const pxPerMm = canvasWidth / Math.max(10, geometry.label_width_mm);
  pxPerMmRef.current = pxPerMm;
  const canvasHeight = geometry.label_height_mm * pxPerMm;
  const pageScale = Math.min(280 / Math.max(20, geometry.page_width_mm), 360 / Math.max(20, geometry.page_height_mm));

  const sample = (id: LayoutItemId): string => {
    switch (id) {
      case "org":
        return t("assets.public.title");
      case "notice":
        return t("assets.public.notice");
      case "tag":
        return t("assets.labels.sampleTag");
      case "name":
        return t("assets.labels.sampleName");
      case "model":
        return t("assets.labels.sampleModel");
      case "serial":
        return t("assets.labels.sampleSerial");
      case "location":
        return t("assets.labels.sampleLocation");
      case "custodian":
        return t("assets.labels.sampleCustodian");
      default:
        return "";
    }
  };

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const scale = pxPerMmRef.current;
      if (drag.mode === "move") {
        const x = drag.originX + (clientX - drag.startX) / scale;
        const y = drag.originY + (clientY - drag.startY) / scale;
        onChange(moveItem(layoutRef.current, drag.id, x, y, size));
      } else {
        const w = drag.originW + (clientX - drag.startX) / scale;
        const h = drag.originH + (clientY - drag.startY) / scale;
        onChange(resizeItem(layoutRef.current, drag.id, w, h, size));
      }
    },
    [onChange, size.labelWidthMm, size.labelHeightMm],
  );

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

  function startMove(event: ReactPointerEvent, item: LayoutItem) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = {
      mode: "move",
      id: item.id,
      originX: item.x_mm,
      originY: item.y_mm,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function startResize(event: ReactPointerEvent, item: LayoutItem) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = {
      mode: "resize",
      id: item.id,
      originW: item.w_mm,
      originH: item.h_mm,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function nudge(dx: number, dy: number) {
    const item = layout.find((row) => row.id === selectedId);
    if (!item) return;
    onChange(moveItem(layout, selectedId, item.x_mm + dx, item.y_mm + dy, size));
  }

  const selected = layout.find((row) => row.id === selectedId) ?? layout[0];
  const rows = Math.max(1, Math.min(20, Math.floor(geometry.rows) || 1));
  const cols = Math.max(1, Math.min(10, Math.floor(geometry.columns) || 1));
  const cells = Array.from({ length: rows * cols }, (_, i) => i);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.labels.pagePreview")}</h4>
            <p className="text-xs text-neutral-500">{t("assets.labels.labelsPerPage", { count: perPage })}</p>
          </div>
          {overflow && (
            <p role="status" className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t("assets.labels.pageOverflow")}
            </p>
          )}
          <div className="flex justify-center overflow-auto rounded-xl bg-neutral-200/80 p-4">
            <div
              className="relative bg-white shadow-md"
              style={{
                width: geometry.page_width_mm * pageScale,
                height: geometry.page_height_mm * pageScale,
              }}
              aria-hidden="true"
            >
              {cells.map((index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                return (
                  <div
                    key={index}
                    className="absolute overflow-hidden border border-neutral-300 bg-white"
                    style={{
                      left: (geometry.margin_left_mm + col * (geometry.label_width_mm + geometry.h_gap_mm)) * pageScale,
                      top: (geometry.margin_top_mm + row * (geometry.label_height_mm + geometry.v_gap_mm)) * pageScale,
                      width: geometry.label_width_mm * pageScale,
                      height: geometry.label_height_mm * pageScale,
                    }}
                  >
                    <LabelFace
                      items={layout}
                      pxPerMm={pageScale}
                      fontPt={geometry.font_pt}
                      sample={sample}
                      interactive={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.labels.labelCanvas")}</h4>
          <p className="mb-2 text-xs text-neutral-500">{t("assets.labels.dragHint")}</p>
          <div
            id={canvasId}
            role="application"
            aria-label={t("assets.labels.labelCanvas")}
            tabIndex={0}
            className="relative mx-auto overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ width: canvasWidth, height: canvasHeight, touchAction: "none" }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 2 : 0.5;
              if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); }
              if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); }
              if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); }
              if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); }
            }}
          >
            <LabelFace
              items={layout}
              pxPerMm={pxPerMm}
              fontPt={geometry.font_pt}
              sample={sample}
              interactive
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMoveStart={startMove}
              onResizeStart={startResize}
              resizeLabel={t("assets.labels.resizeHandle")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.labels.fields")}</h4>
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {LAYOUT_IDS.map((id) => {
            const item = layout.find((row) => row.id === id);
            if (!item) return null;
            const custodyOnly = (id === "location" || id === "custodian") && geometry.kind !== "custody";
            return (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={(e) => onChange(setItemVisible(layout, id, e.target.checked))}
                  />
                  <button
                    type="button"
                    className={`flex-1 text-left ${selectedId === id ? "font-semibold text-primary" : ""}`}
                    onClick={() => setSelectedId(id)}
                  >
                    {t(ITEM_KEYS[id])}
                  </button>
                  {custodyOnly && <span className="text-[10px] uppercase tracking-wide text-neutral-400">{t("assets.labels.custodyOnly")}</span>}
                </label>
              </li>
            );
          })}
        </ul>

        {selected && (
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold">{t("assets.labels.selectedItem")}: {t(ITEM_KEYS[selected.id])}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-neutral-500">{t("assets.labels.posX")}
                <input
                  type="number"
                  step="0.1"
                  className="form-input mt-1"
                  value={selected.x_mm}
                  onChange={(e) => onChange(moveItem(layout, selected.id, Number(e.target.value), selected.y_mm, size))}
                />
              </label>
              <label className="text-[11px] font-semibold text-neutral-500">{t("assets.labels.posY")}
                <input
                  type="number"
                  step="0.1"
                  className="form-input mt-1"
                  value={selected.y_mm}
                  onChange={(e) => onChange(moveItem(layout, selected.id, selected.x_mm, Number(e.target.value), size))}
                />
              </label>
              <label className="text-[11px] font-semibold text-neutral-500">{t("assets.labels.posW")}
                <input
                  type="number"
                  step="0.1"
                  className="form-input mt-1"
                  value={selected.w_mm}
                  onChange={(e) => onChange(resizeItem(layout, selected.id, Number(e.target.value), selected.h_mm, size))}
                />
              </label>
              <label className="text-[11px] font-semibold text-neutral-500">{t("assets.labels.posH")}
                <input
                  type="number"
                  step="0.1"
                  className="form-input mt-1"
                  disabled={selected.id === "qr"}
                  value={selected.h_mm}
                  onChange={(e) => onChange(resizeItem(layout, selected.id, selected.w_mm, Number(e.target.value), size))}
                />
              </label>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-secondary w-full"
          onClick={onReset}
        >
          {t("assets.labels.resetLayout")}
        </button>
      </div>
    </div>
  );
}

function LabelFace({
  items,
  pxPerMm,
  fontPt,
  sample,
  interactive,
  selectedId,
  onSelect,
  onMoveStart,
  onResizeStart,
  resizeLabel,
}: {
  items: LayoutItem[];
  pxPerMm: number;
  fontPt: number;
  sample: (id: LayoutItemId) => string;
  interactive: boolean;
  selectedId?: LayoutItemId;
  onSelect?: (id: LayoutItemId) => void;
  onMoveStart?: (event: ReactPointerEvent, item: LayoutItem) => void;
  onResizeStart?: (event: ReactPointerEvent, item: LayoutItem) => void;
  resizeLabel?: string;
}) {
  return (
    <>
      {items.filter((item) => item.visible).map((item) => {
        const selected = interactive && item.id === selectedId;
        const style: CSSProperties = {
          position: "absolute",
          left: item.x_mm * pxPerMm,
          top: item.y_mm * pxPerMm,
          width: item.w_mm * pxPerMm,
          height: item.h_mm * pxPerMm,
          overflow: interactive ? "visible" : "hidden",
          cursor: interactive ? "grab" : "default",
          border: interactive ? (selected ? "1.5px solid var(--color-primary, #1a365d)" : "1px dashed rgba(26,54,93,0.35)") : "none",
          background: interactive ? "rgba(255,255,255,0.72)" : "transparent",
          zIndex: selected ? 3 : 1,
        };
        return (
          <div
            key={item.id}
            style={style}
            onPointerDown={interactive && onMoveStart ? (e) => onMoveStart(e, item) : undefined}
            onClick={interactive && onSelect ? () => onSelect(item.id) : undefined}
          >
            {item.id === "qr" ? (
              <QrMark />
            ) : (
              <span
                style={{
                  display: "block",
                  fontSize: item.id === "tag"
                    ? Math.max(7, fontPt * pxPerMm * 0.42)
                    : item.id === "org"
                      ? Math.max(6, 7 * pxPerMm * 0.32)
                      : Math.max(6, fontPt * pxPerMm * 0.32),
                  fontWeight: item.id === "tag" || item.id === "org" ? 700 : 500,
                  lineHeight: 1.15,
                  color: item.id === "org" ? "#1a365d" : "#111",
                  textTransform: item.id === "org" ? "uppercase" : "none",
                  letterSpacing: item.id === "org" ? "0.04em" : undefined,
                  fontFamily: item.id === "tag" ? "ui-monospace, monospace" : undefined,
                }}
              >
                {sample(item.id)}
              </span>
            )}
            {selected && onResizeStart && (
              <button
                type="button"
                aria-label={resizeLabel}
                className="absolute bottom-0 right-0 size-3 cursor-se-resize rounded-sm bg-primary"
                style={{ position: "absolute", right: 0, bottom: 0, width: 10, height: 10 }}
                onPointerDown={(e) => onResizeStart(e, item)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function QrMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" fill="#fff" stroke="#111" strokeWidth="1" />
      <rect x="4" y="4" width="10" height="10" fill="#111" />
      <rect x="26" y="4" width="10" height="10" fill="#111" />
      <rect x="4" y="26" width="10" height="10" fill="#111" />
      <rect x="18" y="18" width="5" height="5" fill="#111" />
      <rect x="26" y="22" width="4" height="4" fill="#111" />
      <rect x="20" y="8" width="3" height="3" fill="#111" />
      <rect x="8" y="18" width="3" height="3" fill="#111" />
    </svg>
  );
}
