export const LAYOUT_IDS = [
  "org",
  "notice",
  "tag",
  "name",
  "model",
  "serial",
  "location",
  "custodian",
  "qr",
] as const;

export type LayoutItemId = (typeof LAYOUT_IDS)[number];

export type LayoutItem = {
  id: LayoutItemId;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  visible: boolean;
};

export type LabelSize = {
  labelWidthMm: number;
  labelHeightMm: number;
  qrMm?: number;
};

export type PageGeometry = {
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  hGapMm: number;
  vGapMm: number;
  rows: number;
  columns: number;
};

const ID_SET = new Set<string>(LAYOUT_IDS);

function num(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : min;
  const hi = max < min ? max : max;
  return Math.round(Math.min(hi, Math.max(min, n)) * 100) / 100;
}

function normalizeItem(row: Record<string, unknown>, size: LabelSize): LayoutItem | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!ID_SET.has(id)) return null;
  const labelW = Math.max(10, size.labelWidthMm);
  const labelH = Math.max(10, size.labelHeightMm);
  let w = num(row.w_mm, 4, labelW);
  let h = num(row.h_mm ?? (id === "qr" ? w : 4), 3, labelH);
  if (id === "qr") {
    const sizeMm = Math.max(8, Math.min(w, h, labelW, labelH));
    w = sizeMm;
    h = sizeMm;
  }
  const x = num(row.x_mm, 0, Math.max(0, labelW - w));
  const y = num(row.y_mm, 0, Math.max(0, labelH - h));
  return {
    id: id as LayoutItemId,
    x_mm: x,
    y_mm: y,
    w_mm: w,
    h_mm: h,
    visible: row.visible === undefined ? true : Boolean(row.visible),
  };
}

export function defaultLayout(size: LabelSize): LayoutItem[] {
  const labelW = Math.max(10, size.labelWidthMm);
  const labelH = Math.max(10, size.labelHeightMm);
  const qrMm = size.qrMm ?? 22;
  const qr = Math.min(Math.max(8, qrMm), Math.max(8, labelW * 0.42), Math.max(8, labelH * 0.55), Math.max(8, labelW - 3), Math.max(8, labelH - 3));
  const textW = Math.max(10, labelW - qr - 4);
  const qrX = Math.max(0, labelW - qr - 1.5);
  const qrY = Math.min(8, Math.max(1.5, labelH - qr - 2));
  const draft: LayoutItem[] = [
    { id: "org", x_mm: 1.5, y_mm: 1.2, w_mm: Math.max(10, labelW - 3), h_mm: 3.4, visible: true },
    { id: "notice", x_mm: 1.5, y_mm: 4.6, w_mm: Math.max(10, labelW - 3), h_mm: 3, visible: true },
    { id: "tag", x_mm: 1.5, y_mm: 8, w_mm: textW, h_mm: 4.8, visible: true },
    { id: "name", x_mm: 1.5, y_mm: 12.8, w_mm: textW, h_mm: 5.4, visible: true },
    { id: "model", x_mm: 1.5, y_mm: 18.4, w_mm: textW, h_mm: 3.6, visible: true },
    { id: "serial", x_mm: 1.5, y_mm: 22.2, w_mm: textW, h_mm: 3.6, visible: true },
    { id: "location", x_mm: 1.5, y_mm: 26, w_mm: textW, h_mm: 3.6, visible: true },
    { id: "custodian", x_mm: 1.5, y_mm: 29.8, w_mm: textW, h_mm: 3.6, visible: true },
    { id: "qr", x_mm: qrX, y_mm: qrY, w_mm: qr, h_mm: qr, visible: true },
  ];
  return draft.map((row) => normalizeItem(row, size)).filter((item): item is LayoutItem => item !== null);
}

function extractItems(layout: unknown): unknown[] {
  if (!Array.isArray(layout)) {
    if (layout && typeof layout === "object" && Array.isArray((layout as { items?: unknown }).items)) {
      return (layout as { items: unknown[] }).items;
    }
    return [];
  }
  return layout;
}

export function sanitizeLayout(layout: unknown, size: LabelSize): LayoutItem[] {
  const raw = extractItems(layout);
  if (raw.length === 0) return defaultLayout(size);
  const seen = new Map<LayoutItemId, LayoutItem>();
  const order: LayoutItemId[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = normalizeItem(row as Record<string, unknown>, size);
    if (!item) continue;
    if (!seen.has(item.id)) order.push(item.id);
    seen.set(item.id, item);
  }
  if (order.length === 0) return defaultLayout(size);
  return order.map((id) => seen.get(id)!);
}

export function clampLayout(items: LayoutItem[], size: LabelSize): LayoutItem[] {
  return items
    .map((item) => normalizeItem(item as unknown as Record<string, unknown>, size))
    .filter((item): item is LayoutItem => item !== null);
}

export function moveItem(
  items: LayoutItem[],
  id: LayoutItemId,
  xMm: number,
  yMm: number,
  size: Pick<LabelSize, "labelWidthMm" | "labelHeightMm">,
): LayoutItem[] {
  return clampLayout(
    items.map((item) => (item.id === id ? { ...item, x_mm: xMm, y_mm: yMm } : item)),
    { ...size, qrMm: items.find((i) => i.id === "qr")?.w_mm },
  );
}

export function resizeItem(
  items: LayoutItem[],
  id: LayoutItemId,
  wMm: number,
  hMm: number,
  size: Pick<LabelSize, "labelWidthMm" | "labelHeightMm">,
): LayoutItem[] {
  return clampLayout(
    items.map((item) => (item.id === id ? { ...item, w_mm: wMm, h_mm: id === "qr" ? wMm : hMm } : item)),
    size,
  );
}

export function setItemVisible(items: LayoutItem[], id: LayoutItemId, visible: boolean): LayoutItem[] {
  return items.map((item) => (item.id === id ? { ...item, visible } : item));
}

export function labelsPerPage(rows: number, columns: number): number {
  return Math.max(1, Math.floor(rows) || 1) * Math.max(1, Math.floor(columns) || 1);
}

export type TemplateSaveForm = {
  code: string;
  name: string;
  kind: "permanent" | "custody";
  page_size: string;
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
  qr_mm: number;
  is_default: boolean;
  is_active: boolean;
  layout: LayoutItem[];
};

export type TemplateSaveResult =
  | { ok: true; payload: TemplateSaveForm }
  | { ok: false; error: "name" | "code" };

function intClamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
}

export function toTemplateSavePayload(form: TemplateSaveForm): TemplateSaveResult {
  const name = form.name.trim();
  const code = form.code.trim().toLowerCase().replace(/\s+/g, "_");
  if (!name) return { ok: false, error: "name" };
  if (!/^[a-z0-9_-]+$/.test(code)) return { ok: false, error: "code" };

  const labelWidthMm = num(form.label_width_mm, 10, 400);
  const labelHeightMm = num(form.label_height_mm, 10, 400);
  const layout = sanitizeLayout(form.layout, {
    labelWidthMm,
    labelHeightMm,
    qrMm: form.qr_mm,
  });
  const qr = layout.find((item) => item.id === "qr");

  return {
    ok: true,
    payload: {
      code,
      name,
      kind: form.kind === "custody" ? "custody" : "permanent",
      page_size: (form.page_size || "A4").slice(0, 32),
      page_width_mm: num(form.page_width_mm, 20, 400),
      page_height_mm: num(form.page_height_mm, 20, 400),
      margin_top_mm: num(form.margin_top_mm, 0, 80),
      margin_left_mm: num(form.margin_left_mm, 0, 80),
      label_width_mm: labelWidthMm,
      label_height_mm: labelHeightMm,
      h_gap_mm: num(form.h_gap_mm, 0, 40),
      v_gap_mm: num(form.v_gap_mm, 0, 40),
      rows: intClamp(form.rows, 1, 1, 20),
      columns: intClamp(form.columns, 1, 1, 10),
      font_pt: intClamp(form.font_pt, 8, 6, 18),
      qr_mm: intClamp(qr?.w_mm ?? form.qr_mm, 22, 8, 40),
      is_default: Boolean(form.is_default),
      is_active: Boolean(form.is_active),
      layout,
    },
  };
}

export function pageOverflows(geo: PageGeometry): boolean {
  const cols = Math.max(1, geo.columns);
  const rows = Math.max(1, geo.rows);
  const needW = geo.marginLeftMm + cols * geo.labelWidthMm + Math.max(0, cols - 1) * geo.hGapMm;
  const needH = geo.marginTopMm + rows * geo.labelHeightMm + Math.max(0, rows - 1) * geo.vGapMm;
  return needW > geo.pageWidthMm + 0.15 || needH > geo.pageHeightMm + 0.15;
}

export const PAGE_PRESETS = [
  {
    id: "avery18",
    page_size: "A4",
    page_width_mm: 210,
    page_height_mm: 297,
    margin_top_mm: 8.7,
    margin_left_mm: 4.7,
    label_width_mm: 63.5,
    label_height_mm: 46.6,
    h_gap_mm: 2.5,
    v_gap_mm: 0,
    rows: 6,
    columns: 3,
    qr_mm: 22,
  },
  {
    id: "avery8",
    page_size: "A4",
    page_width_mm: 210,
    page_height_mm: 297,
    margin_top_mm: 8.5,
    margin_left_mm: 5,
    label_width_mm: 99.1,
    label_height_mm: 67.7,
    h_gap_mm: 2.5,
    v_gap_mm: 0,
    rows: 4,
    columns: 2,
    qr_mm: 24,
  },
  {
    id: "avery2",
    page_size: "A4",
    page_width_mm: 210,
    page_height_mm: 297,
    margin_top_mm: 8,
    margin_left_mm: 5,
    label_width_mm: 200,
    label_height_mm: 138,
    h_gap_mm: 0,
    v_gap_mm: 5,
    rows: 2,
    columns: 1,
    qr_mm: 32,
  },
  {
    id: "thermal",
    page_size: "custom",
    page_width_mm: 70,
    page_height_mm: 40,
    margin_top_mm: 0,
    margin_left_mm: 0,
    label_width_mm: 70,
    label_height_mm: 40,
    h_gap_mm: 0,
    v_gap_mm: 0,
    rows: 1,
    columns: 1,
    qr_mm: 18,
  },
] as const;
