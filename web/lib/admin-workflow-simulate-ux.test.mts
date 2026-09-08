import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, catalogFor, translate } from "./i18n/messages.ts";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("workflow simulate page is module-centric, labelled, and translated", () => {
  const source = readPage("app/(app)/admin/workflows/simulate/page.tsx");

  assert.match(source, /useI18n/);
  assert.match(source, /workflows\.simulate\./);
  assert.match(source, /htmlFor="wf-sim-module"/);
  assert.match(source, /htmlFor="wf-sim-workflow"/);
  assert.match(source, /htmlFor="wf-sim-requester"/);
  assert.match(source, /<label htmlFor="/);
  assert.match(source, /simulationCatalog/);
  assert.match(source, /scenario_key/);
  assert.match(source, /requester_user_id/);
  assert.match(source, /formatApplicablePath/);
  assert.match(source, /EmptyState/);
  assert.match(source, /preset/);
  assert.match(source, /module_type/);
  assert.match(source, /id="wf-sim-result"/);
  assert.match(source, /parseSimulationResponse/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /workflows\.simulate\.successPath/);
  assert.match(source, /wf-sim-change-module/);

  assert.doesNotMatch(source, /ObjectSummary/);
  assert.doesNotMatch(source, /FormField/);
  assert.doesNotMatch(source, /test_context: \{ amount:/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test("workflow simulate API client exposes the module catalog", () => {
  const source = readFileSync(join(webRoot, "lib/api.ts"), "utf8");
  assert.match(source, /simulationCatalog:\s*\(\)\s*=>/);
  assert.match(source, /\/workflow-engine\/simulation-catalog/);
  assert.match(source, /requester_user_id\?:/);
  assert.match(source, /scenario_key\?:/);
});

test("workflow simulate catalog covers chrome in EN, FR and PT", () => {
  const keys = [
    "workflows.simulate.title",
    "workflows.simulate.subtitle",
    "workflows.simulate.module",
    "workflows.simulate.workflow",
    "workflows.simulate.requester",
    "workflows.simulate.scenario",
    "workflows.simulate.run",
    "workflows.simulate.successPath",
    "workflows.simulate.changeModule",
    "workflows.simulate.parseError",
    "workflows.simulate.dryRun",
    "workflows.simulate.path",
    "workflows.simulate.emptyModule",
    "workflows.simulate.module.leave",
    "workflows.simulate.module.procurement",
    "workflows.simulate.module.timesheet",
    "workflows.simulate.field.leave_type",
    "workflows.simulate.field.amount",
    "workflows.simulate.preset.procurement.below_finance",
    "workflows.simulate.preset.procurement.above_finance",
  ];
  const enTitle = catalogFor("en")["workflows.simulate.title"];
  for (const locale of LOCALES) {
    const table = catalogFor(locale);
    for (const key of keys) {
      assert.ok(String(table[key] ?? "").trim(), `${locale} missing ${key}`);
    }
    if (locale !== "en") {
      assert.notEqual(table["workflows.simulate.title"], enTitle);
      assert.notEqual(translate(locale, "workflows.simulate.module.leave"), translate("en", "workflows.simulate.module.leave"));
    }
  }
});
