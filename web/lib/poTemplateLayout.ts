export const PO_ELEMENT_TYPES = [
  "logo",
  "org_name",
  "org_address",
  "image",
  "heading",
  "field",
  "text",
  "line",
  "rectangle",
  "table",
  "approval_block",
  "qr",
  "footer",
  "page_number",
] as const;

export type PoElementType = (typeof PO_ELEMENT_TYPES)[number];

export const PO_BINDINGS = [
  "org.logo",
  "org.name",
  "org.abbreviation",
  "org.address",
  "org.phone",
  "org.email",
  "org.website",
  "org.tagline",
  "po.reference",
  "po.issue_date",
  "po.currency",
  "po.subtotal",
  "po.vat",
  "po.discount",
  "po.other_charges",
  "po.total",
  "po.amount_in_words",
  "po.notes",
  "po.terms",
  "po.delivery_address",
  "po.delivery_date",
  "po.generated_at",
  "po.page_number",
  "supplier.name",
  "supplier.address",
  "supplier.phone",
  "supplier.email",
  "supplier.contact",
  "project.name",
  "project.code",
  "programme.name",
  "funding.source",
  "budget.code",
  "cost_centre",
  "requisition.reference",
  "procurement.reference",
  "requester.name",
  "requester.position",
  "requester.signature",
  "requester.signed_at",
  "workflow.approvals",
  "po.items",
] as const;

export type PoBinding = (typeof PO_BINDINGS)[number];

export const PO_TABLE_COLUMNS = [
  "line_no",
  "item_code",
  "description",
  "qty",
  "unit",
  "unit_price",
  "discount",
  "vat_percent",
  "vat",
  "line_total",
  "budget_code",
] as const;

export const PO_APPROVAL_LAYOUTS = ["horizontal", "vertical", "dynamic_grid"] as const;

export type PoApprovalLayout = (typeof PO_APPROVAL_LAYOUTS)[number];

export type PoPageLayout = {
  size: "a4";
  orientation: "portrait" | "landscape";
  margin_mm: { top: number; right: number; bottom: number; left: number };
};

export type PoElement = {
  id: string;
  type: PoElementType;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  z: number;
  locked: boolean;
  hidden: boolean;
  font_size: number;
  align: "left" | "center" | "right";
  bold: boolean;
  border: boolean;
  padding_mm: number;
  binding?: string;
  text?: string;
  columns?: string[];
  flow?: boolean;
  layout?: PoApprovalLayout;
  keep_aspect?: boolean;
};

export type PoLayout = {
  page: PoPageLayout;
  elements: PoElement[];
};

const TYPE_SET = new Set<string>(PO_ELEMENT_TYPES);
const BINDING_SET = new Set<string>(PO_BINDINGS);
const COL_SET = new Set<string>(PO_TABLE_COLUMNS);

function num(value: unknown, min: number, max: number): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? Number(value)
        : min;
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `el-${Math.random().toString(36).slice(2, 10)}`;
}

export function pageSizeMm(orientation: "portrait" | "landscape"): { w: number; h: number } {
  return orientation === "landscape" ? { w: 297, h: 210 } : { w: 210, h: 297 };
}

function normalizeElement(row: Record<string, unknown>, maxW: number, maxH: number): PoElement | null {
  const type = typeof row.type === "string" ? row.type : "";
  if (!TYPE_SET.has(type)) return null;
  const w = num(row.w_mm, 2, maxW);
  const h = num(row.h_mm, 2, maxH);
  const el: PoElement = {
    id: typeof row.id === "string" && row.id ? row.id : newId(),
    type: type as PoElementType,
    x_mm: num(row.x_mm, 0, Math.max(0, maxW - 2)),
    y_mm: num(row.y_mm, 0, Math.max(0, maxH - 2)),
    w_mm: w,
    h_mm: h,
    z: typeof row.z === "number" ? row.z : 0,
    locked: Boolean(row.locked),
    hidden: Boolean(row.hidden),
    font_size: num(row.font_size ?? 10, 6, 28),
    align: row.align === "center" || row.align === "right" ? row.align : "left",
    bold: Boolean(row.bold),
    border: Boolean(row.border),
    padding_mm: num(row.padding_mm ?? 1, 0, 8),
  };
  const binding = typeof row.binding === "string" ? row.binding : undefined;
  if (binding && !BINDING_SET.has(binding)) return null;
  if (binding) el.binding = binding;
  if (type === "text" || type === "heading") {
    el.text = String(row.text ?? (type === "heading" ? "PURCHASE ORDER" : "")).slice(0, 500);
  }
  if (type === "table") {
    const cols: string[] = [];
    const rawCols = Array.isArray(row.columns) ? row.columns : ["qty", "description", "unit_price", "line_total"];
    for (const col of rawCols) {
      if (typeof col === "string" && COL_SET.has(col) && !cols.includes(col)) cols.push(col);
    }
    el.columns = cols.length ? cols : ["qty", "description", "unit_price", "line_total"];
    el.flow = true;
    el.binding = "po.items";
  }
  if (type === "approval_block") {
    el.layout = PO_APPROVAL_LAYOUTS.includes(row.layout as PoApprovalLayout)
      ? (row.layout as PoApprovalLayout)
      : "horizontal";
    el.binding = "workflow.approvals";
  }
  if (type === "logo" || type === "image") {
    el.keep_aspect = row.keep_aspect === undefined ? true : Boolean(row.keep_aspect);
    el.binding = el.binding ?? "org.logo";
  }
  if (type === "field" && !el.binding) return null;
  return el;
}

export function sanitizePoLayout(raw: unknown): PoLayout {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pageIn = input.page && typeof input.page === "object" ? (input.page as Record<string, unknown>) : {};
  const orientation = pageIn.orientation === "landscape" ? "landscape" : "portrait";
  const margin = pageIn.margin_mm && typeof pageIn.margin_mm === "object" ? (pageIn.margin_mm as Record<string, unknown>) : {};
  const page: PoPageLayout = {
    size: "a4",
    orientation,
    margin_mm: {
      top: num(margin.top ?? 12, 5, 40),
      right: num(margin.right ?? 12, 5, 40),
      bottom: num(margin.bottom ?? 14, 5, 40),
      left: num(margin.left ?? 12, 5, 40),
    },
  };
  const { w, h } = pageSizeMm(orientation);
  const seen = new Set<string>();
  const elements: PoElement[] = [];
  const rows = Array.isArray(input.elements) ? input.elements : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const el = normalizeElement(row as Record<string, unknown>, w, h);
    if (!el) continue;
    if (seen.has(el.id)) el.id = newId();
    seen.add(el.id);
    elements.push(el);
  }
  return { page, elements };
}

export function snapMm(value: number, grid = 0.5): number {
  return Math.round(value / grid) * grid;
}

export function moveElement(layout: PoLayout, id: string, xMm: number, yMm: number): PoLayout {
  const { w, h } = pageSizeMm(layout.page.orientation);
  return {
    ...layout,
    elements: layout.elements.map((el) =>
      el.id === id && !el.locked
        ? { ...el, x_mm: snapMm(Math.max(0, Math.min(w - el.w_mm, xMm))), y_mm: snapMm(Math.max(0, Math.min(h - el.h_mm, yMm))) }
        : el
    ),
  };
}

export function resizeElement(layout: PoLayout, id: string, wMm: number, hMm: number): PoLayout {
  const { w, h } = pageSizeMm(layout.page.orientation);
  return {
    ...layout,
    elements: layout.elements.map((el) =>
      el.id === id && !el.locked
        ? {
            ...el,
            w_mm: snapMm(Math.max(4, Math.min(w - el.x_mm, wMm))),
            h_mm: snapMm(Math.max(3, Math.min(h - el.y_mm, hMm))),
          }
        : el
    ),
  };
}

export function updateElement(layout: PoLayout, id: string, patch: Partial<PoElement>): PoLayout {
  return {
    ...layout,
    elements: layout.elements.map((el) => (el.id === id ? { ...el, ...patch, id: el.id, type: el.type } : el)),
  };
}

export function removeElement(layout: PoLayout, id: string): PoLayout {
  return { ...layout, elements: layout.elements.filter((el) => el.id !== id) };
}

export function duplicateElement(layout: PoLayout, id: string): PoLayout {
  const source = layout.elements.find((el) => el.id === id);
  if (!source) return layout;
  const copy: PoElement = { ...source, id: newId(), x_mm: source.x_mm + 4, y_mm: source.y_mm + 4, locked: false };
  return { ...layout, elements: [...layout.elements, copy] };
}

export function setZOrder(layout: PoLayout, id: string, direction: "forward" | "back"): PoLayout {
  const max = Math.max(0, ...layout.elements.map((el) => el.z));
  return {
    ...layout,
    elements: layout.elements.map((el) => {
      if (el.id !== id) return el;
      return { ...el, z: direction === "forward" ? max + 1 : Math.max(0, el.z - 1) };
    }),
  };
}

export type PaletteItem = {
  type: PoElementType;
  binding?: PoBinding;
  labelKey: string;
  defaults?: Partial<PoElement>;
};

export const PALETTE: PaletteItem[] = [
  { type: "logo", binding: "org.logo", labelKey: "po.designer.palette.logo", defaults: { w_mm: 30, h_mm: 24 } },
  { type: "org_name", binding: "org.name", labelKey: "po.designer.palette.orgName", defaults: { w_mm: 120, h_mm: 8, bold: true, font_size: 13 } },
  { type: "org_address", binding: "org.address", labelKey: "po.designer.palette.orgAddress", defaults: { w_mm: 120, h_mm: 16, font_size: 8 } },
  { type: "heading", labelKey: "po.designer.palette.heading", defaults: { text: "PURCHASE ORDER", w_mm: 110, h_mm: 10, bold: true, font_size: 16 } },
  { type: "field", binding: "po.reference", labelKey: "po.designer.palette.poNumber", defaults: { w_mm: 60, h_mm: 10, bold: true } },
  { type: "field", binding: "po.issue_date", labelKey: "po.designer.palette.date", defaults: { w_mm: 50, h_mm: 8 } },
  { type: "field", binding: "supplier.name", labelKey: "po.designer.palette.supplier", defaults: { w_mm: 90, h_mm: 8 } },
  { type: "field", binding: "project.name", labelKey: "po.designer.palette.project", defaults: { w_mm: 70, h_mm: 8 } },
  { type: "field", binding: "requisition.reference", labelKey: "po.designer.palette.requisition", defaults: { w_mm: 70, h_mm: 8 } },
  { type: "field", binding: "po.total", labelKey: "po.designer.palette.total", defaults: { w_mm: 50, h_mm: 8, bold: true, align: "right" } },
  { type: "field", binding: "po.amount_in_words", labelKey: "po.designer.palette.amountWords", defaults: { w_mm: 160, h_mm: 10, font_size: 8 } },
  { type: "text", labelKey: "po.designer.palette.text", defaults: { text: "", w_mm: 40, h_mm: 6, font_size: 8 } },
  { type: "line", labelKey: "po.designer.palette.line", defaults: { w_mm: 80, h_mm: 2 } },
  { type: "rectangle", labelKey: "po.designer.palette.box", defaults: { w_mm: 80, h_mm: 20, border: true } },
  { type: "table", binding: "po.items", labelKey: "po.designer.palette.items", defaults: { w_mm: 186, h_mm: 70, columns: ["qty", "description", "unit_price", "line_total"] } },
  { type: "approval_block", binding: "workflow.approvals", labelKey: "po.designer.palette.signatures", defaults: { w_mm: 186, h_mm: 42, layout: "dynamic_grid" } },
  { type: "qr", labelKey: "po.designer.palette.qr", defaults: { w_mm: 22, h_mm: 22 } },
];

export function addPaletteItem(layout: PoLayout, item: PaletteItem): PoLayout {
  const maxZ = Math.max(0, ...layout.elements.map((el) => el.z));
  const el = normalizeElement(
    {
      id: newId(),
      type: item.type,
      binding: item.binding,
      x_mm: 16,
      y_mm: 16,
      z: maxZ + 1,
      ...item.defaults,
    },
    pageSizeMm(layout.page.orientation).w,
    pageSizeMm(layout.page.orientation).h,
  );
  if (!el) return layout;
  return { ...layout, elements: [...layout.elements, el] };
}

export function sampleLabel(el: PoElement): string {
  if (el.type === "heading" || el.type === "text") return el.text || el.type;
  if (el.binding) return el.binding;
  return el.type;
}
