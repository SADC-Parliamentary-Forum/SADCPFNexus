import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translate } from "./i18n/messages.ts";
import { canPrintAssetLabels } from "./authAccess.ts";
import {
  A4_LANDSCAPE_WIDTH_MM,
  A4_PORTRAIT_WIDTH_MM,
  REGISTER_PDF_COLUMNS,
  REGISTER_PDF_MARGIN_MM,
  parsePrintAssetIds,
  printPageHref,
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

test("excel export query uses xlsx and optional ids", () => {
  assert.deepEqual(registerExportQuery([]), { format: "xlsx", include_pending: 1 });
  assert.deepEqual(registerExportQuery([4, 5]), {
    format: "xlsx",
    include_pending: 1,
    ids: "4,5",
  });
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

test("print page filters by ids and uses a landscape sheet that fits", () => {
  const page = readFileSync(join(webRoot, "app/(app)/assets/print/page.tsx"), "utf8");
  assert.match(page, /parsePrintAssetIds/);
  assert.match(page, /size:\s*A4 landscape/);
  assert.match(page, /table-layout:\s*fixed/);
  assert.match(page, /h-12 w-12|12mm/);
});

test("assetsApi can download an Excel register export", () => {
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(api, /registerExport:\s*\(params/);
  assert.match(api, /\/assets\/register-export/);
  assert.match(api, /responseType:\s*["']blob["']/);
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
