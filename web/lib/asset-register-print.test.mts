import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translate } from "./i18n/messages.ts";
import { canPrintAssetLabels } from "./authAccess.ts";
import {
  A4_LANDSCAPE_WIDTH_MM,
  A4_PORTRAIT_WIDTH_MM,
  QR_BATCH_MAX_IDS,
  REGISTER_PDF_COLUMNS,
  REGISTER_PDF_MARGIN_MM,
  chunkIds,
  collectPaginatedRows,
  parsePrintAssetIds,
  printPageHref,
  qrImagesFromBatch,
  registerExportQuery,
  registerPdfColumnWidths,
  registerPdfTableFitsPage,
  resolveExportAssets,
} from "./asset-register-print.ts";

const webRoot = join(process.cwd());

test("register PDF column widths always fit A4 landscape and portrait", () => {
  for (const pageWidth of [A4_LANDSCAPE_WIDTH_MM, A4_PORTRAIT_WIDTH_MM]) {
    const widths = registerPdfColumnWidths(pageWidth);
    assert.equal(widths.length, REGISTER_PDF_COLUMNS.length);
    assert.equal(
      registerPdfTableFitsPage(widths, pageWidth),
      true,
      `widths ${widths.join("+")} must fit ${pageWidth - REGISTER_PDF_MARGIN_MM * 2}mm`,
    );
    const available = pageWidth - REGISTER_PDF_MARGIN_MM * 2;
    const sum = widths.reduce((total, width) => total + width, 0);
    assert.ok(Math.abs(sum - available) < 0.1, `sum ${sum} should equal available ${available}`);
  }
});

test("empty selection prints or exports every filtered asset; selection narrows the set", () => {
  const rows = [
    { id: 1, name: "Laptop" },
    { id: 2, name: "Chair" },
    { id: 3, name: "Printer" },
  ];
  assert.deepEqual(
    resolveExportAssets(rows, []).map((row) => row.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    resolveExportAssets(rows, [2]).map((row) => row.id),
    [2],
  );
  assert.deepEqual(
    resolveExportAssets(rows, ["1", "3"]).map((row) => row.id),
    [1, 3],
  );
});

test("print page href carries selected ids", () => {
  assert.equal(printPageHref([]), "/assets/print");
  assert.equal(printPageHref([11, 22]), "/assets/print?ids=11,22");
  assert.deepEqual(parsePrintAssetIds("?ids=11,22,x"), [11, 22]);
  assert.deepEqual(parsePrintAssetIds(""), []);
});

test("excel export query uses xlsx, optional ids, and list filters when exporting all", () => {
  assert.deepEqual(registerExportQuery([]), { format: "xlsx", include_pending: 1 });
  assert.deepEqual(registerExportQuery([4, 5]), {
    format: "xlsx",
    include_pending: 1,
    ids: "4,5",
  });
  assert.deepEqual(
    registerExportQuery([], { status: "active", category: "it", search: "laptop" }),
    { format: "xlsx", include_pending: 1, status: "active", category: "it", search: "laptop" },
  );
});

test("collectPaginatedRows walks every Laravel page", async () => {
  const rows = await collectPaginatedRows(async (page) => {
    if (page === 1) return { data: [{ id: 1 }, { id: 2 }], last_page: 2 };
    return { data: [{ id: 3 }], last_page: 2 };
  });
  assert.deepEqual(rows.map((row) => row.id), [1, 2, 3]);
});

test("asset register loads every page and links through to a view page", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  const detail = readFileSync(join(webRoot, "app/(app)/assets/[id]/page.tsx"), "utf8");
  assert.match(page, /collectPaginatedRows/);
  assert.match(page, /data-testid=["']asset-register-view["']/);
  assert.match(page, /href=\{`\/assets\/\$\{asset\.id\}`\}/);
  assert.match(detail, /assetsApi\s*\n\s*\.get\(/);
  assert.match(detail, /formatDateShort/);
  assert.match(detail, /data-testid=["']asset-view-title["']/);
  assert.match(detail, /href=["']\/assets["']/);
});

test("print page walks every register page so Print all is not capped at 100", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/print/page.tsx"), "utf8");
  assert.match(page, /collectPaginatedRows\(\(page\)/);
  assert.match(page, /parsePrintAssetIds/);
  assert.match(page, /size:\s*A4 landscape/);
  assert.match(page, /table-layout:\s*fixed/);
  assert.match(page, /h-12 w-12|12mm/);
});

test("QR ids are chunked so one print does not overflow the batch limit", () => {
  assert.equal(QR_BATCH_MAX_IDS, 500);
  assert.deepEqual(chunkIds([1, 2, 3], 2), [[1, 2], [3]]);
  assert.deepEqual(chunkIds([], 500), []);
  const ids = Array.from({ length: 501 }, (_, i) => i + 1);
  const chunks = chunkIds(ids);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 500);
  assert.deepEqual(chunks[1], [501]);
});

test("batch QR payload becomes image srcs keyed by asset id", () => {
  assert.deepEqual(
    qrImagesFromBatch([
      { id: 4, image: "data:image/svg+xml;base64,abc" },
      { id: 0, image: "data:image/svg+xml;base64,skip" },
      { id: 5, image: "/not-a-data-uri" },
      { id: 6 },
    ]),
    { 4: "data:image/svg+xml;base64,abc" },
  );
});

test("print page loads QR codes in batches instead of one request per row", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/print/page.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /qrBatch:\s*\(ids/);
  assert.match(api, /\/assets\/qr-batch/);
  assert.match(page, /assetsApi\.qrBatch/);
  assert.match(page, /chunkIds/);
  assert.match(page, /qrImagesFromBatch/);
  assert.doesNotMatch(page, /\/assets\/\$\{asset\.id\}\/qr/);
});

test("reports page downloads the server CSV instead of assembling JSON in the browser", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/reports/page.tsx"), "utf8");
  assert.match(page, /assetsApi\.registerExport/);
  assert.match(page, /format:\s*["']csv["']/);
  assert.doesNotMatch(page, /register-export\?format=json/);
  assert.doesNotMatch(page, /keys\.join\(/);
});

test("assets.print (or manage/admin) can print labels from the register", () => {
  assert.equal(canPrintAssetLabels({ roles: [], permissions: ["assets.print"] }), true);
  assert.equal(canPrintAssetLabels({ roles: [], permissions: ["assets.admin"] }), true);
  assert.equal(canPrintAssetLabels({ roles: ["System Admin"], permissions: [] }), true);
  assert.equal(canPrintAssetLabels({ roles: [], permissions: ["assets.view"] }), false);
});

test("asset register offers select, print, excel, and quick labels", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/page.tsx"), "utf8");
  const modal = readFileSync(join(webRoot, "components/assets/AssetLabelsQuickPrintModal.tsx"), "utf8");
  assert.match(page, /useRowSelection/);
  assert.match(page, /data-testid=["']asset-register-select-all["']/);
  assert.match(page, /data-testid=["']asset-register-print["']/);
  assert.match(page, /data-testid=["']asset-register-export-excel["']/);
  assert.match(page, /data-testid=["']asset-register-print-labels["']/);
  assert.match(page, /printPageHref/);
  assert.match(page, /assetsApi\.registerExport/);
  assert.match(page, /AssetLabelsQuickPrintModal/);
  assert.match(page, /registerPdfColumnWidths/);
  assert.match(modal, /assetLabelsApi\.print/);
  assert.doesNotMatch(page, /cellWidth:\s*45/);
  assert.doesNotMatch(page, /href=["']\/assets\/print["']/);
});

test("assetsApi can download an Excel register export", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /registerExport:\s*\(params/);
  assert.match(api, /\/assets\/register-export/);
  assert.match(api, /responseType:\s*["']blob["']/);
  assert.match(api, /qrBatch:\s*\(ids/);
  assert.match(api, /\/assets\/qr-batch/);
});

test("register print and export copy is translated in EN, FR and PT", () => {
  const keys = [
    "assets.register.selectAll",
    "assets.register.selectHint",
    "assets.register.print",
    "assets.register.exportPdf",
    "assets.register.exportExcel",
    "assets.register.printLabels",
    "assets.register.exportEmpty",
    "assets.register.exportFailed",
    "assets.register.needTemplate",
    "assets.view",
    "assets.viewTitle",
    "assets.notFound",
    "assets.loadFailed",
    "assets.register.title",
    "assets.view.fieldCode",
    "assets.view.fieldNotes",
  ];
  for (const key of keys) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(en, key, `missing English for ${key}`);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
  }
});
