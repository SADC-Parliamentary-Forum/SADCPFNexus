import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, isCsrfMismatch } from "./apiError.ts";

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

test("isCsrfMismatch detects Laravel 419 CSRF token mismatch", () => {
  const err = {
    response: {
      status: 419,
      data: { message: "CSRF token mismatch." },
    },
  };
  assert.equal(isCsrfMismatch(err), true);
});

test("isCsrfMismatch detects csrf_mismatch code even without 419", () => {
  const err = {
    response: {
      status: 500,
      data: { message: "CSRF token mismatch.", code: "csrf_mismatch" },
    },
  };
  assert.equal(isCsrfMismatch(err), true);
});

test("isCsrfMismatch detects Page Expired copy", () => {
  const err = {
    response: {
      status: 419,
      data: { message: "Page Expired" },
    },
  };
  assert.equal(isCsrfMismatch(err), true);
});

test("isCsrfMismatch ignores ordinary login validation failures", () => {
  const err = {
    response: {
      status: 422,
      data: {
        message: "The given data was invalid.",
        errors: { captcha_token: ["Could not verify the security check."] },
      },
    },
  };
  assert.equal(isCsrfMismatch(err), false);
});
