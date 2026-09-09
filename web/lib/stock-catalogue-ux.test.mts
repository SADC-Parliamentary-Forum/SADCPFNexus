import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canConfigureStockCatalogue, canManageStock } from "./authAccess.ts";
import { translate } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

test("stock.manage can configure UoM and categories; stock.create cannot", () => {
  assert.equal(canConfigureStockCatalogue({ roles: [], permissions: ["stock.manage"] }), true);
  assert.equal(canConfigureStockCatalogue({ roles: [], permissions: ["stock.admin"] }), true);
  assert.equal(canConfigureStockCatalogue({ roles: ["System Admin"], permissions: [] }), true);
  assert.equal(canConfigureStockCatalogue({ roles: [], permissions: ["stock.create"] }), false);
  assert.equal(canConfigureStockCatalogue({ roles: [], permissions: ["stock.edit"] }), false);
  assert.equal(canManageStock({ roles: [], permissions: ["stock.create"] }), true);
});

test("item form can select and create category and unit of measure", () => {
  const form = readFileSync(join(webRoot, "components/stock/StockItemFormModal.tsx"), "utf8");

  assert.match(form, /data-testid=["']stock-item-category-select["']/);
  assert.match(form, /data-testid=["']stock-item-unit-select["']/);
  assert.match(form, /data-testid=["']stock-add-category["']/);
  assert.match(form, /data-testid=["']stock-add-unit["']/);
  assert.match(form, /stockCategoriesApi\.list/);
  assert.match(form, /stockCategoriesApi\.create/);
  assert.match(form, /stockUnitsApi\.create/);
  assert.match(form, /canConfigureStockCatalogue/);
  assert.match(form, /stock\.category/);
  assert.match(form, /stock\.unitOfMeasure/);
});

test("stock register links to units and categories catalogues", () => {
  const page = readFileSync(join(webRoot, "app/(app)/stock/page.tsx"), "utf8");

  assert.match(page, /href=["']\/stock\/units["']/);
  assert.match(page, /href=["']\/stock\/categories["']/);
  assert.match(page, /canConfigureStockCatalogue/);
  assert.match(page, /data-testid=["']stock-manage-units["']/);
  assert.match(page, /data-testid=["']stock-manage-categories["']/);
});

test("stock catalogue copy is translated in EN, FR and PT", () => {
  const keys = [
    "stock.category",
    "stock.uncategorised",
    "stock.unitOfMeasure",
    "stock.selectUnit",
    "stock.addCategory",
    "stock.addUnit",
    "stock.manageCategories",
    "stock.manageUnits",
    "stock.noCategoriesHint",
    "stock.noUnitsHint",
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
