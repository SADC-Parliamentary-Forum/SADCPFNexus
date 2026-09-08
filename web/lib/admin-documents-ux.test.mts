import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, catalogFor } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("admin document register uses register chrome, i18n, and labelled filters", () => {
  const source = readPage("app/(app)/admin/documents/page.tsx");

  assert.match(source, /RegisterShell/);
  assert.match(source, /useI18n/);
  assert.match(source, /documents\.register\./);
  assert.match(source, /href: "\/admin"/);
  assert.match(source, /htmlFor="doc-register-search"/);
  assert.match(source, /htmlFor="doc-register-module"/);
  assert.match(source, /htmlFor="doc-register-hold-only"/);
  assert.match(source, /htmlFor="doc-hold-reason"/);
  assert.match(source, /htmlFor="doc-retention-until"/);
  assert.match(source, /htmlFor="doc-retention-policy"/);
  assert.match(source, /EmptyState/);
  assert.match(source, /data-table/);
  assert.match(source, /btn-secondary/);
  assert.match(source, /useConfirm/);
  assert.match(source, /setRetention/);
  assert.match(source, /backupStatus/);
  assert.match(source, /<label htmlFor="/);

  assert.doesNotMatch(source, /window\.prompt/);
  assert.doesNotMatch(source, /className="p-6 /);
  assert.doesNotMatch(source, /text-primary underline/);
  assert.doesNotMatch(source, /FormField/);
});

test("admin document retention dashboard uses admin card chrome instead of stub borders", () => {
  const source = readPage("app/(app)/admin/documents/retention/page.tsx");

  assert.match(source, /ModulePageHeader/);
  assert.match(source, /useI18n/);
  assert.match(source, /documents\.retention\./);
  assert.match(source, /htmlFor="doc-campaign-name"/);
  assert.match(source, /EmptyState/);
  assert.match(source, /btn-secondary/);
  assert.match(source, /<label htmlFor="doc-campaign-name"/);

  assert.doesNotMatch(source, /className="p-6 /);
  assert.doesNotMatch(source, /text-primary underline/);
  assert.doesNotMatch(source, /border rounded p-3/);
});

test("admin document catalog covers register chrome in EN, FR and PT", () => {
  const keys = [
    "documents.register.title",
    "documents.register.search",
    "documents.retention.title",
    "documents.governance.title",
  ];
  const enTitle = catalogFor("en")["documents.register.title"];
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(String(table[key] ?? "").trim(), `${locale} missing ${key}`);
    }
    if (locale !== "en") {
      assert.notEqual(table["documents.register.title"], enTitle);
    }
  }
});

test("admin document governance uses labelled cards and buttons, not underline actions", () => {
  const source = readPage("app/(app)/admin/documents/governance/page.tsx");

  assert.match(source, /ModulePageHeader/);
  assert.match(source, /useI18n/);
  assert.match(source, /documents\.governance\./);
  assert.match(source, /htmlFor="doc-gov-status"/);
  assert.match(source, /htmlFor="doc-gov-notes"/);
  assert.match(source, /EmptyState/);
  assert.match(source, /btn-primary/);
  assert.match(source, /btn-secondary/);
  assert.match(source, /<label htmlFor="doc-gov-status"/);

  assert.doesNotMatch(source, /className="p-6 /);
  assert.doesNotMatch(source, /text-primary underline/);
  assert.doesNotMatch(source, /className="text-sm underline"/);
});
