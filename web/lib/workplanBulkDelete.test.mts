import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORKPLAN_BULK_DELETE_MAX,
  chunkWorkplanEventIds,
  normalizeWorkplanEventIds,
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
