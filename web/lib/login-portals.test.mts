import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = process.cwd();

test("staff login page links to the supplier portal", () => {
  const src = readFileSync(join(webRoot, "app/(auth)/login/page.tsx"), "utf8");
  assert.match(src, /href=\{?"\/supplier\/login"?\}?/);
  assert.match(src, /login\.supplierInstead/);
  assert.match(src, /login\.supplierPortalLink/);
});

test("staff and supplier login share the captcha gate", () => {
  const staff = readFileSync(join(webRoot, "components/auth/PortalSignInForm.tsx"), "utf8");
  const gate = readFileSync(join(webRoot, "components/auth/CaptchaGate.tsx"), "utf8");
  assert.match(staff, /CaptchaGate/);
  assert.match(gate, /login\.captchaRetry/);
  assert.match(gate, /loadConfig/);
});
