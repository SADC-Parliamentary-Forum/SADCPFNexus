import assert from "node:assert/strict";
import test from "node:test";
import { loginFormErrorMessage, shouldResetLoginCaptcha } from "./loginFormError.ts";

const t = (key: string) => {
  if (key === "login.csrfExpired" || key === "login.sessionExpired") {
    return "Your session expired. Refresh the security check and try signing in again.";
  }
  if (key === "login.error") {
    return "Login failed. Please try again.";
  }
  return key;
};

test("loginFormErrorMessage never surfaces raw CSRF token mismatch copy", () => {
  const err = {
    response: {
      status: 419,
      data: { message: "CSRF token mismatch." },
    },
  };
  const message = loginFormErrorMessage(err, t);
  assert.match(message, /session expired/i);
  assert.doesNotMatch(message, /CSRF token mismatch/i);
});

test("loginFormErrorMessage maps csrf_mismatch code to the session-expired copy", () => {
  const err = {
    response: {
      status: 500,
      data: { message: "CSRF token mismatch.", code: "csrf_mismatch" },
    },
  };
  assert.equal(
    loginFormErrorMessage(err, t),
    "Your session expired. Refresh the security check and try signing in again.",
  );
});

test("loginFormErrorMessage keeps captcha validation messages", () => {
  const err = {
    response: {
      status: 422,
      data: {
        message: "The given data was invalid.",
        errors: { captcha_token: ["Could not verify the security check."] },
      },
    },
  };
  assert.equal(loginFormErrorMessage(err, t), "Could not verify the security check.");
});

test("shouldResetLoginCaptcha after CSRF or captcha token errors", () => {
  assert.equal(
    shouldResetLoginCaptcha({ response: { status: 419, data: { message: "CSRF token mismatch." } } }),
    true,
  );
  assert.equal(
    shouldResetLoginCaptcha({
      response: { status: 422, data: { errors: { captcha_token: ["bad"] } } },
    }),
    true,
  );
  assert.equal(
    shouldResetLoginCaptcha({
      response: { status: 422, data: { errors: { email: ["These credentials do not match."] } } },
    }),
    false,
  );
});
