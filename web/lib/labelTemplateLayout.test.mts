import assert from "node:assert/strict";
import test from "node:test";
import {
  LAYOUT_IDS,
  clampLayout,
  defaultLayout,
  labelsPerPage,
  moveItem,
  pageOverflows,
  sanitizeLayout,
  setItemVisible,
  toTemplateSavePayload,
} from "./labelTemplateLayout.ts";

test("default layout has every field and a square QR", () => {
  const items = defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 });
  assert.deepEqual(items.map((i) => i.id), [...LAYOUT_IDS]);
  const qr = items.find((i) => i.id === "qr");
  assert.ok(qr);
  assert.equal(qr.w_mm, qr.h_mm);
});

test("sanitize drops unknown ids and extra keys", () => {
  const clean = sanitizeLayout(
    [
      { id: "qr", x_mm: 10, y_mm: 8, w_mm: 20, h_mm: 20, onclick: "alert(1)" },
      { id: "evil", x_mm: 0, y_mm: 0, w_mm: 10 },
      { id: "tag", x_mm: 2, y_mm: 10, w_mm: 30, h_mm: 5, visible: true },
    ],
    { labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 },
  );
  assert.deepEqual(clean.map((i) => i.id), ["qr", "tag"]);
  assert.equal("onclick" in clean[0], false);
});

test("sanitize clamps overflow and negative coordinates", () => {
  const [item] = sanitizeLayout(
    [{ id: "tag", x_mm: -40, y_mm: 90, w_mm: 400, h_mm: 400 }],
    { labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 },
  );
  assert.ok(item.x_mm >= 0);
  assert.ok(item.y_mm >= 0);
  assert.ok(item.x_mm + item.w_mm <= 63.5 + 0.01);
  assert.ok(item.y_mm + item.h_mm <= 46.6 + 0.01);
});

test("empty layout falls back to default", () => {
  const items = sanitizeLayout([], { labelWidthMm: 70, labelHeightMm: 40, qrMm: 18 });
  assert.equal(items.length, 9);
});

test("moveItem keeps the field inside the label", () => {
  const items = defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 });
  const moved = moveItem(items, "tag", 400, 400, { labelWidthMm: 63.5, labelHeightMm: 46.6 });
  const tag = moved.find((i) => i.id === "tag")!;
  assert.ok(tag.x_mm + tag.w_mm <= 63.5 + 0.01);
  assert.ok(tag.y_mm + tag.h_mm <= 46.6 + 0.01);
});

test("Avery 18-up fits three by six labels on A4", () => {
  assert.equal(labelsPerPage(6, 3), 18);
  assert.equal(
    pageOverflows({
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginTopMm: 8.7,
      marginLeftMm: 4.7,
      labelWidthMm: 63.5,
      labelHeightMm: 46.6,
      hGapMm: 2.5,
      vGapMm: 0,
      rows: 6,
      columns: 3,
    }),
    false,
  );
});

test("two-by-four grid is eight labels per page", () => {
  assert.equal(labelsPerPage(4, 2), 8);
});

test("oversized grid reports overflow", () => {
  assert.equal(
    pageOverflows({
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginTopMm: 10,
      marginLeftMm: 10,
      labelWidthMm: 100,
      labelHeightMm: 80,
      hGapMm: 5,
      vGapMm: 5,
      rows: 6,
      columns: 3,
    }),
    true,
  );
});

test("hiding an item sets visible false", () => {
  const items = setItemVisible(
    defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 }),
    "model",
    false,
  );
  assert.equal(items.find((i) => i.id === "model")?.visible, false);
});

test("toTemplateSavePayload rejects a blank name instead of sending", () => {
  const form = {
    code: "avery_l7161_permanent",
    name: "   ",
    kind: "permanent" as const,
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
    font_pt: 8,
    qr_mm: 22,
    is_default: true,
    is_active: true,
    layout: defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 }),
  };
  const result = toTemplateSavePayload(form);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "name");
});

test("toTemplateSavePayload coerces editor floats into API-safe integers", () => {
  const layout = defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 }).map((item) =>
    item.id === "qr" ? { ...item, w_mm: 20.6, h_mm: 20.6 } : item,
  );
  const result = toTemplateSavePayload({
    code: "avery_l7161_permanent",
    name: "Avery L7161 permanent",
    kind: "permanent",
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
    font_pt: 8.4,
    qr_mm: 7.2,
    is_default: true,
    is_active: true,
    layout,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.font_pt, 8);
  assert.equal(result.payload.qr_mm, 21);
  assert.equal(result.payload.layout.find((item) => item.id === "qr")?.w_mm, 20.6);
});

test("clampLayout shrinks items when the label gets smaller", () => {
  const items = defaultLayout({ labelWidthMm: 63.5, labelHeightMm: 46.6, qrMm: 22 });
  const clamped = clampLayout(items, { labelWidthMm: 40, labelHeightMm: 30, qrMm: 16 });
  for (const item of clamped) {
    assert.ok(item.x_mm + item.w_mm <= 40 + 0.01, item.id);
    assert.ok(item.y_mm + item.h_mm <= 30 + 0.01, item.id);
  }
});
