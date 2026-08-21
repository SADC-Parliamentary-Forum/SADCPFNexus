import assert from "node:assert/strict";
import { test } from "node:test";
import { commaListHas, inclusiveDayCount, optionsWithCurrent, personLabel, toggleCommaList } from "./pifForm.ts";

test("inclusiveDayCount is inclusive and date-only", () => {
  assert.equal(inclusiveDayCount("2026-08-21", "2026-08-21"), 1);
  assert.equal(inclusiveDayCount("2026-08-21", "2026-08-24"), 4);
  assert.equal(inclusiveDayCount("2026-08-24", "2026-08-21"), null);
  assert.equal(inclusiveDayCount("", "2026-08-21"), null);
});

test("optionsWithCurrent keeps a stored value that left the catalogue", () => {
  assert.deepEqual(optionsWithCurrent(["USD", "NAD"], ""), ["USD", "NAD"]);
  assert.deepEqual(optionsWithCurrent(["USD", "NAD"], "USD"), ["USD", "NAD"]);
  assert.deepEqual(optionsWithCurrent(["USD", "NAD"], "EUR"), ["EUR", "USD", "NAD"]);
});

test("toggleCommaList adds and removes language chips without duplicates", () => {
  assert.equal(toggleCommaList("", "English"), "English");
  assert.equal(toggleCommaList("English", "French"), "English, French");
  assert.equal(toggleCommaList("English, French", "English"), "French");
  assert.ok(commaListHas("English, French", "french"));
});

test("personLabel never returns a user object React cannot render", () => {
  assert.equal(personLabel("Jane Officer"), "Jane Officer");
  assert.equal(personLabel({ id: 12, name: "Jane Officer", email: "jane@example.org" }), "Jane Officer");
  assert.equal(personLabel(null, "Responsible officer"), "Responsible officer");
  assert.equal(personLabel(undefined, "—"), "—");
});
