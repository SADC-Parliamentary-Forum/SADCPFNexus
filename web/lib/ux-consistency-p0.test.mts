import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(fullPath, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tsx")) acc.push(fullPath);
  }
  return acc;
}

test("native window.alert/confirm/prompt are not used in app pages or shared components", () => {
  const offenders: string[] = [];
  for (const fullPath of [...walkTsx(join(webRoot, "app")), ...walkTsx(join(webRoot, "components"))]) {
    const source = readFileSync(fullPath, "utf8");
    if (/window\.(alert|confirm|prompt)\s*\(/.test(source)) {
      offenders.push(fullPath.replace(webRoot, ""));
    }
  }
  assert.deepEqual(offenders, []);
});

test("confirm dialog exposes a labelled prompt for reason capture", () => {
  const source = readFileSync(join(webRoot, "components/ui/ConfirmDialog.tsx"), "utf8");
  assert.match(source, /prompt:\s*\(options: PromptOptions\) => Promise<string \| null>/);
  assert.match(source, /htmlFor=\{inputId\}/);
  assert.match(source, /id=\{inputId\}/);
  assert.match(source, /aria-required=\{options\.required \|\| undefined\}/);
});

test("travel TOIL queue uses shared chrome, empty state, and prompt dialog", () => {
  const source = readFileSync(join(webRoot, "app/(app)/travel/toil/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /EmptyState/);
  assert.match(source, /useConfirm/);
  assert.match(source, /travel\.toil\.title/);
  assert.doesNotMatch(source, /window\.prompt/);
  assert.doesNotMatch(source, /text-2xl font-semibold/);
});

test("balance register update surfaces API errors without JSON dumps", () => {
  const source = readFileSync(join(webRoot, "app/(app)/finance/balance-register/[id]/update/page.tsx"), "utf8");
  assert.match(source, /apiErrorMessage/);
  assert.match(source, /htmlFor="bcre-txn-type"/);
  assert.match(source, /id="bcre-txn-type"/);
  assert.match(source, /htmlFor="bcre-amount"/);
  assert.match(source, /id="bcre-amount"/);
  assert.doesNotMatch(source, /JSON\.stringify\(msg\)/);
});

test("assignment calendar regenerates subscribe URLs through useConfirm", () => {
  const source = readFileSync(join(webRoot, "app/(app)/assignments/calendar/page.tsx"), "utf8");
  assert.match(source, /useConfirm/);
  assert.match(source, /assignments\.calendar\.regenerateTitle/);
  assert.doesNotMatch(source, /window\.confirm/);
});

test("travel queue tables use ModulePageHeader, EmptyState, and button actions", () => {
  const source = readFileSync(join(webRoot, "components/travel/TravelQueueTable.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.match(source, /PageBreadcrumbs/);
  assert.match(source, /EmptyState/);
  assert.doesNotMatch(source, /hover:underline/);
  assert.doesNotMatch(source, /<h1 className="page-title">/);
});
