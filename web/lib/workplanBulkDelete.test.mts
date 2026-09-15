import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORKPLAN_BULK_DELETE_MAX,
  chunkWorkplanEventIds,
  dropSelectedIds,
  normalizeWorkplanEventIds,
  summarizeWorkplanBulkDelete,
} from "./workplanBulkDelete.ts";

describe("normalizeWorkplanEventIds", () => {
  it("keeps positive integer ids in first-seen order and drops junk", () => {
    assert.deepEqual(
      normalizeWorkplanEventIds(["3", 1, 1, 0, -4, "x", 2.5, "2"]),
      [3, 1, 2],
    );
  });

  it("returns an empty list when nothing is selectable", () => {
    assert.deepEqual(normalizeWorkplanEventIds([]), []);
    assert.deepEqual(normalizeWorkplanEventIds(["", NaN as unknown as number]), []);
  });
});

describe("chunkWorkplanEventIds", () => {
  it("defaults to the import-aligned bulk delete cap", () => {
    assert.equal(WORKPLAN_BULK_DELETE_MAX, 500);
    const ids = Array.from({ length: 501 }, (_, i) => i + 1);
    const chunks = chunkWorkplanEventIds(ids);
    assert.equal(chunks.length, 2);
    assert.deepEqual(chunks[0], ids.slice(0, 500));
    assert.deepEqual(chunks[1], [501]);
  });
});

describe("dropSelectedIds", () => {
  it("removes deleted ids and keeps remaining selection", () => {
    assert.deepEqual([...dropSelectedIds([1, 2, 3], [2])], [1, 3]);
    assert.deepEqual([...dropSelectedIds([1, 2], [])], [1, 2]);
  });
});

describe("summarizeWorkplanBulkDelete", () => {
  it("reports success, partial progress, or total failure", () => {
    assert.deepEqual(summarizeWorkplanBulkDelete(12, false), { kind: "success", deleted: 12 });
    assert.deepEqual(summarizeWorkplanBulkDelete(500, true), { kind: "partial", deleted: 500 });
    assert.deepEqual(summarizeWorkplanBulkDelete(0, true), { kind: "failure", deleted: 0 });
  });
});
