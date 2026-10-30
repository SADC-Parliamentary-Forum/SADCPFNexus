import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteSecondFactor, normalizeSecondFactorInput } from "./secondFactorInput.ts";

test("6-digit authenticator codes are complete", () => {
  assert.equal(isCompleteSecondFactor(normalizeSecondFactorInput("123 456")), true);
  assert.equal(isCompleteSecondFactor("12345"), false);
});

test("recovery codes can be typed with or without the dash", () => {
  assert.equal(normalizeSecondFactorInput("a1b2c-3d4e5"), "a1b2c-3d4e5");
  assert.equal(isCompleteSecondFactor("a1b2c-3d4e5"), true);
  assert.equal(isCompleteSecondFactor("A1B2C3D4E5"), true);
  assert.equal(isCompleteSecondFactor("a1b2c-3d4"), false);
});

test("input is length-capped and stripped of other characters", () => {
  assert.equal(normalizeSecondFactorInput("a1b2c-3d4e5-extra!"), "a1b2c-3d4e5");
});
