import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSettingsIds,
  selectedSettingsRows,
  settingsIdsToActivate,
  settingsIdsToDeactivate,
  summarizeSettingsBulk,
} from "./contract-settings-bulk.ts";

const rows = [
  { id: 1, is_active: true, name: "A" },
  { id: 2, is_active: false, name: "B" },
  { id: 3, is_active: true, name: "C" },
  { id: 4, is_active: true, name: "Default NAD", is_default: true },
];

test("normalizeSettingsIds keeps unique positive integers", () => {
  assert.deepEqual(normalizeSettingsIds([1, "2", 0, -3, "x", 1, 2]), [1, 2]);
});

test("selectedSettingsRows returns only checked rows in list order", () => {
  assert.deepEqual(
    selectedSettingsRows(rows, [3, "1", 99]).map((r) => r.id),
    [1, 3],
  );
});

test("settingsIdsToDeactivate targets active selected rows and skips a default currency", () => {
  assert.deepEqual(settingsIdsToDeactivate(rows, [1, 2, 3, 4]), [1, 3]);
});

test("settingsIdsToActivate targets inactive selected rows only", () => {
  assert.deepEqual(settingsIdsToActivate(rows, [1, 2, 4]), [2]);
});

test("summarizeSettingsBulk reports success, partial, and failure", () => {
  assert.deepEqual(summarizeSettingsBulk(3, 0), { kind: "success", succeeded: 3, failed: 0 });
  assert.deepEqual(summarizeSettingsBulk(2, 1), { kind: "partial", succeeded: 2, failed: 1 });
  assert.deepEqual(summarizeSettingsBulk(0, 2), { kind: "failure", succeeded: 0, failed: 2 });
});
