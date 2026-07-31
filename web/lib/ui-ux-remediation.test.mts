import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("AccessDenied component exists and AppShell renders it instead of silent dashboard redirect", () => {
  const accessDenied = readFileSync(join(webRoot, "components/ui/AccessDenied.tsx"), "utf8");
  const appShell = readFileSync(join(webRoot, "components/layout/AppShell.tsx"), "utf8");

  assert.match(accessDenied, /Access denied/i);
  assert.match(accessDenied, /You cannot open this page/);
  assert.match(appShell, /AccessDenied/);
  assert.doesNotMatch(appShell, /router\.replace\("\/dashboard"\)/);
});

test("Approvals inbox redirects to unified /approvals", () => {
  const inbox = readFileSync(join(webRoot, "app/(app)/approvals/inbox/page.tsx"), "utf8");
  assert.match(inbox, /redirect\("\/approvals"\)/);
});

test("badge-info and alert-info are defined", () => {
  const css = readFileSync(join(webRoot, "app/globals.css"), "utf8");
  assert.match(css, /\.badge-info\s*\{/);
  assert.match(css, /\.alert-info\s*\{/);
});
