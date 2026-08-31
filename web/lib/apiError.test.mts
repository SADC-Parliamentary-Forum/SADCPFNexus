import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage } from "./apiError.ts";

test("apiErrorMessage prefers Laravel validation errors over Axios status text", () => {
  const err = {
    message: "Request failed with status code 422",
    response: {
      data: {
        message: "Finance budget confirmation is required before this action.",
        errors: {
          budget: ["Finance budget confirmation is required before this action."],
        },
      },
    },
  };
  Object.setPrototypeOf(err, Error.prototype);
  assert.equal(
    apiErrorMessage(err, "Failed to issue RFQ."),
    "Finance budget confirmation is required before this action.",
  );
});

test("apiErrorMessage falls back when the payload has no message", () => {
  assert.equal(apiErrorMessage({}, "Failed to issue RFQ."), "Failed to issue RFQ.");
});
