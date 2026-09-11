import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, catalogFor } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("workplan page offers a labelled CSV template download and event list upload", () => {
  const source = readPage("app/(app)/workplan/page.tsx");

  assert.match(source, /workplanApi\.importTemplate/);
  assert.match(source, /workplanApi\.importEvents/);
  assert.match(source, /htmlFor="workplan-events-import"/);
  assert.match(source, /id="workplan-events-import"/);
  assert.match(source, /accept="\.csv,text\/csv"/);
  assert.match(source, /workplan\.import\.template/);
  assert.match(source, /workplan\.import\.upload/);
  assert.match(source, /workplan-events-template\.csv/);
  assert.match(source, /<label htmlFor="workplan-events-import"/);
  assert.doesNotMatch(source, /<label className=/);
  assert.doesNotMatch(source, /text-primary underline/);
  assert.doesNotMatch(source, /FormField/);
});

test("workplan API client exposes event import template and upload", () => {
  const source = readPage("lib/api.ts");

  assert.match(source, /\/workplan\/events\/import\/template/);
  assert.match(source, /\/workplan\/events\/import"/);
  assert.match(source, /importTemplate:/);
  assert.match(source, /importEvents:/);
});

test("workplan import catalog covers EN, FR and PT", () => {
  const keys = [
    "workplan.import.template",
    "workplan.import.upload",
    "workplan.import.file",
    "workplan.import.hint",
    "workplan.import.success",
    "workplan.import.failed",
  ];
  const enTitle = catalogFor("en")["workplan.import.template"];
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(String(table[key] ?? "").trim(), `${locale} missing ${key}`);
    }
    if (locale !== "en") {
      assert.notEqual(table["workplan.import.template"], enTitle);
    }
  }
});
