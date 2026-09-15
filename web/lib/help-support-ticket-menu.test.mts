import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("ticket kebab menu exposes View, Edit, Close, and Delete actions", () => {
  const source = readPage("app/(app)/profile/support/page.tsx");

  assert.match(source, /data-testid=["']support-ticket-actions["']/);
  assert.match(source, /role="menu"/);
  assert.match(source, /label=["']View["']/);
  assert.match(source, /label=["']Edit["']/);
  assert.match(source, /label=["']Close ticket["']/);
  assert.match(source, /label=["']Delete["']/);
  assert.match(source, /testId=["']support-ticket-action-view["']/);
  assert.match(source, /testId=["']support-ticket-action-edit["']/);
  assert.match(source, /testId=["']support-ticket-action-close["']/);
  assert.match(source, /testId=["']support-ticket-action-delete["']/);
  assert.match(source, /aria-hidden=["']true["']/);
});

test("ticket kebab menu portals out of the scrolling page so items stay visible", () => {
  const source = readPage("app/(app)/profile/support/page.tsx");

  assert.match(source, /createPortal/);
  assert.match(source, /getBoundingClientRect/);
  assert.match(source, /document\.body/);
  assert.doesNotMatch(source, /absolute right-0 top-full/);
});

test("help support e2e asserts the portaled kebab menu, not a card-clipped locator", () => {
  const source = readPage("tests/e2e/help-support.spec.ts");

  assert.match(source, /support-ticket-actions-menu/);
  assert.match(source, /support-ticket-action-view/);
  assert.match(source, /support-ticket-action-edit/);
  assert.match(source, /support-ticket-action-delete/);
  assert.doesNotMatch(source, /card\.getByRole\(["']menuitem["']/);
});
