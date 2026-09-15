import assert from "node:assert/strict";
import test from "node:test";
import { runAfterOverlayClose } from "./run-after-overlay-close.ts";

test("runAfterOverlayClose closes the overlay first, then runs the action on the next timer", async () => {
  const order: string[] = [];

  runAfterOverlayClose(
    () => order.push("close"),
    () => order.push("action"),
  );

  assert.deepEqual(order, ["close"]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, ["close", "action"]);
});
