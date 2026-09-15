import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuotedList,
  formatWorkplanImportErrorLines,
  uniqueMissingMeetingTypes,
} from "./workplanImportErrors.ts";

test("uniqueMissingMeetingTypes lists each missing type once", () => {
  const names = uniqueMissingMeetingTypes([
    { message: 'Meeting type "Plenary" not found.' },
    { message: 'Meeting type "Plenary" not found.' },
    { message: 'Meeting type "ExCo" not found.' },
    { message: "Date is required (YYYY-MM-DD)." },
  ]);
  assert.deepEqual(names, ["Plenary", "ExCo"]);
});

test("formatWorkplanImportErrorLines keeps the first errors and notes the remainder", () => {
  const preview = formatWorkplanImportErrorLines(
    [
      { row: 2, message: 'Meeting type "Plenary" not found.' },
      { row: 3, message: 'Meeting type "Plenary" not found.' },
      { row: 4, message: 'Meeting type "Plenary" not found.' },
    ],
    2,
  );
  assert.equal(
    preview,
    'Line 2: Meeting type "Plenary" not found. Line 3: Meeting type "Plenary" not found. …and 1 more.',
  );
});

test("formatQuotedList wraps names for the missing-types summary", () => {
  assert.equal(formatQuotedList(["Plenary", "ExCo"]), '"Plenary", "ExCo"');
});
