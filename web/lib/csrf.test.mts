import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CSRF_EXPIRED_MESSAGE, isCsrfMismatch, shouldRetryCsrf } from "./csrf.ts";
import { apiErrorMessage } from "./apiError.ts";

test("isCsrfMismatch detects Laravel 419 and CSRF copy", () => {
  assert.equal(isCsrfMismatch({ response: { status: 419, data: { message: "CSRF token mismatch." } } }), true);
  assert.equal(isCsrfMismatch({ response: { status: 419, data: { message: "Page expired" } } }), true);
  assert.equal(isCsrfMismatch({ response: { status: 500, data: { message: "CSRF token mismatch." } } }), true);
  assert.equal(isCsrfMismatch({ response: { status: 422, data: { code: "csrf_mismatch" } } }), true);
  assert.equal(isCsrfMismatch({ response: { status: 422, data: { message: "Invalid credentials." } } }), false);
  assert.equal(isCsrfMismatch({}), false);
});

test("shouldRetryCsrf retries a mismatch once", () => {
  const err = { response: { status: 419, data: { message: "CSRF token mismatch." } } };
  assert.equal(shouldRetryCsrf(err, false), true);
  assert.equal(shouldRetryCsrf(err, true), false);
  assert.equal(shouldRetryCsrf({ response: { status: 401 } }, false), false);
});

test("apiErrorMessage hides raw CSRF token mismatch", () => {
  assert.equal(
    apiErrorMessage(
      { response: { status: 419, data: { message: "CSRF token mismatch." } } },
      "Login failed. Please try again.",
    ),
    CSRF_EXPIRED_MESSAGE,
  );
  assert.doesNotMatch(
    apiErrorMessage(
      { response: { status: 419, data: { message: "CSRF token mismatch." } } },
      "Login failed. Please try again.",
    ),
    /CSRF token mismatch/i,
  );
});

test("login form and API client recover from a stale CSRF cookie", () => {
  const webRoot = join(process.cwd());
  const form = readFileSync(join(webRoot, "components/auth/PortalSignInForm.tsx"), "utf8");
  const api = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  const keys = readFileSync(join(webRoot, "lib/i18n/keys.ts"), "utf8");
  assert.match(form, /loginFormErrorMessage|login\.csrfExpired/);
  assert.match(form, /isCsrfMismatch/);
  assert.match(api, /shouldRetryCsrf|ensureCsrfCookie\(true\)/);
  assert.match(keys, /"login\.csrfExpired": "Your session expired\. Refresh the page and try again\."/);
  assert.match(keys, /"login\.csrfExpired": "Votre session a expiré/);
  assert.match(keys, /"login\.csrfExpired": "A sua sessão expirou/);
});
