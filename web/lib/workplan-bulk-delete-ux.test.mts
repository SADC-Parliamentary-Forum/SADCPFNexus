import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, catalogFor } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("workplan list has select-all, row checkboxes, and bulk delete", () => {
  const source = readPage("app/(app)/workplan/page.tsx");

  assert.match(source, /useRowSelection/);
  assert.match(source, /SelectAllCheckbox/);
  assert.match(source, /toggleAllSelectable/);
  assert.match(source, /RowCheckbox/);
  assert.match(source, /BulkSelectionBar/);
  assert.match(source, /handleBulkDelete/);
  assert.match(source, /workplanApi\.bulkDelete/);
  assert.match(source, /data-testid="workplan-select-all"/);
  assert.match(source, /workplan\.selectAll/);
  assert.match(source, /workplan\.deleteSelected/);
  assert.match(source, /onClick=\{\(\) => handleOpenEvent\(ev\.id\)\}/);
});

test("workplan delete shows a success or error toast", () => {
  const source = readPage("app/(app)/workplan/page.tsx");

  assert.match(source, /success\(t\("workplan\.delete\.success"\)\)/);
  assert.match(source, /success\(t\("workplan\.bulkDelete\.success"/);
  assert.match(source, /showErrorToast\(.*workplan\.delete\.failed/);
  assert.match(source, /showErrorToast\(.*workplan\.bulkDelete\.failed/);
});

test("workplan API client exposes bulk delete", () => {
  const source = readPage("lib/api.ts");

  assert.match(source, /bulkDelete:/);
  assert.match(source, /\/workplan\/events\/bulk-delete/);
});

test("workplan bulk-delete catalog covers EN, FR and PT", () => {
  const keys = [
    "workplan.selectAll",
    "workplan.selectEvent",
    "workplan.deleteSelected",
    "workplan.deleting",
    "workplan.delete.confirmTitle",
    "workplan.delete.confirmMessage",
    "workplan.delete.success",
    "workplan.delete.failed",
    "workplan.bulkDelete.confirmTitle",
    "workplan.bulkDelete.confirmMessage",
    "workplan.bulkDelete.success",
    "workplan.bulkDelete.failed",
  ];
  const enTitle = catalogFor("en")["workplan.delete.success"];
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(String(table[key] ?? "").trim(), `${locale} missing ${key}`);
    }
    if (locale !== "en") {
      assert.notEqual(table["workplan.delete.success"], enTitle);
    }
  }
});
