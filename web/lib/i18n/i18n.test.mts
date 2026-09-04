import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALES,
  catalogKeys,
  catalogFor,
  interpolate,
  localeBcp47,
  translate,
} from "./messages.ts";

const webRoot = join(process.cwd());

test("EN, FR and PT catalogs expose the same keys", () => {
  const keys = catalogKeys();
  assert.ok(keys.length > 80, `expected a full UI catalog, got ${keys.length} keys`);
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    const missing = keys.filter((key) => !(key in table) || String(table[key]).trim() === "");
    assert.deepEqual(missing, [], `${locale} is missing translations`);
  }
});

test("interpolate replaces named placeholders", () => {
  assert.equal(interpolate("Page {page} of {total}", { page: 2, total: 5 }), "Page 2 of 5");
  assert.equal(
    translate("fr", "common.pageOf", { page: 2, total: 5 }),
    catalogFor("fr")["common.pageOf"]?.replace("{page}", "2").replace("{total}", "5"),
  );
  assert.match(translate("fr", "common.pageOf", { page: 2, total: 5 }), /2/);
  assert.match(translate("pt", "common.pageOf", { page: 2, total: 5 }), /2/);
});

test("core chrome strings differ in French and Portuguese", () => {
  const samples = [
    "nav.dashboard",
    "nav.signOut",
    "common.save",
    "common.cancel",
    "common.search",
    "Dashboard",
    "Approvals",
    "My Work",
    "Access denied",
  ];
  for (const key of samples) {
    const en = translate("en", key);
    const fr = translate("fr", key);
    const pt = translate("pt", key);
    assert.notEqual(fr, en, `French should differ for ${key}`);
    assert.notEqual(pt, en, `Portuguese should differ for ${key}`);
    assert.notEqual(fr, key === "Dashboard" ? "Dashboard" : en);
  }
});

test("locale BCP 47 tags use SADC-relevant regional formats", () => {
  assert.equal(localeBcp47("en"), "en-GB");
  assert.equal(localeBcp47("fr"), "fr-FR");
  assert.equal(localeBcp47("pt"), "pt-PT");
});

test("every sidebar label and section is in the catalog", () => {
  const sidebar = readFileSync(join(webRoot, "components/layout/Sidebar.tsx"), "utf8");
  const labels = [...sidebar.matchAll(/\b(?:label|section):\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(labels.length > 40, "expected sidebar labels");
  const keys = new Set(catalogKeys());
  const missing = [...new Set(labels)].filter((label) => !keys.has(label));
  assert.deepEqual(missing, [], "sidebar labels missing from i18n catalog");
});

test("shared chrome components translate user-facing copy", () => {
  const files = [
    "components/ui/ModulePageHeader.tsx",
    "components/registers/RegisterShell.tsx",
    "components/ui/FormSection.tsx",
    "components/ui/EmptyState.tsx",
    "components/ui/AccessDenied.tsx",
    "components/ui/ModuleHubCards.tsx",
    "components/ui/ListPagination.tsx",
    "components/ui/AppShellLoading.tsx",
    "components/layout/Header.tsx",
    "components/layout/Sidebar.tsx",
    "components/layout/GlobalSearch.tsx",
    "app/dashboard/page.tsx",
    "app/(app)/assets/import/page.tsx",
    "app/(app)/assets/labels/page.tsx",
    "app/(app)/assets/verification/page.tsx",
    "app/a/[token]/page.tsx",
  ];
  for (const rel of files) {
    const source = readFileSync(join(webRoot, rel), "utf8");
    assert.match(source, /useI18n/, `${rel} should call useI18n`);
  }
});

test("API client sends Accept-Language from the stored locale", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /Accept-Language/);
  assert.match(source, /readStoredLocale/);
});

test("asset import review table uses translated column headers", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assets/import/page.tsx"), "utf8");
  assert.match(source, /assets\.import\.colTag/);
  assert.doesNotMatch(source, /<th>Tag<\/th>/);
  assert.match(source, /assets\.import\.mapLocation/);
  assert.match(source, /assets\.import\.mapCustodian/);
  assert.match(source, /filterAll/);
});

test("language switcher remains available without logout", () => {
  const header = readFileSync(join(webRoot, "components/layout/Header.tsx"), "utf8");
  const login = readFileSync(join(webRoot, "app/(auth)/login/page.tsx"), "utf8");
  const provider = readFileSync(join(webRoot, "lib/i18n/LocaleProvider.tsx"), "utf8");
  const messages = readFileSync(join(webRoot, "lib/i18n/messages.ts"), "utf8");
  assert.match(header, /LocaleIconSwitcher/);
  assert.match(login, /LocaleSwitcher/);
  assert.match(messages, /sadcpf_locale/);
  assert.match(provider, /setLocale/);
  assert.doesNotMatch(provider, /\blogout\b/);
});
