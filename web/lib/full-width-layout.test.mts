import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("register shell and page-container fill the AppShell content column", () => {
  const shell = readFileSync(join(webRoot, "components/registers/RegisterShell.tsx"), "utf8");
  const canvas = readFileSync(join(webRoot, "components/ui/ContentCanvas.tsx"), "utf8");
  const css = readFileSync(join(webRoot, "app/globals.css"), "utf8");
  const header = readFileSync(join(webRoot, "components/ui/ModulePageHeader.tsx"), "utf8");

  assert.match(shell, /w-full min-w-0 space-y-5/);
  assert.doesNotMatch(shell, /mx-auto max-w-6xl/);
  assert.match(canvas, /w-full min-w-0 space-y-6/);
  assert.match(css, /\.page-container \{[\s\S]*w-full min-w-0 space-y-5/);
  assert.doesNotMatch(css, /\.page-container \{[\s\S]*mx-auto max-w-6xl/);
  assert.doesNotMatch(header, /maxWidth !== "none" && "mx-auto"/);
});

test("timesheets remain the full-width layout reference", () => {
  const source = readFileSync(join(webRoot, "app/(app)/hr/timesheets/page.tsx"), "utf8");
  assert.match(source, /ModulePageHeader/);
  assert.doesNotMatch(source, /mx-auto max-w-(2xl|3xl|4xl|5xl|6xl)/);
});

test("HR module pages do not centre a max-width column", () => {
  const pages = [
    "app/(app)/hr/page.tsx",
    "app/(app)/hr/leave/page.tsx",
    "app/(app)/hr/leave/balances/page.tsx",
    "app/(app)/hr/leave/import/page.tsx",
    "app/(app)/hr/incidents/[id]/page.tsx",
    "app/(app)/hr/appraisals/page.tsx",
    "app/(app)/hr/conduct/page.tsx",
    "app/(app)/hr/files/page.tsx",
    "app/(app)/hr/departments/page.tsx",
    "app/(app)/hr/positions/page.tsx",
    "app/dashboard/page.tsx",
    "app/(app)/analytics/page.tsx",
    "app/(app)/workplan/page.tsx",
    "app/(app)/correspondence/letterhead/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, rel), "utf8");
    assert.doesNotMatch(
      source,
      /className="[^"]*mx-auto max-w-(2xl|3xl|4xl|5xl|6xl|7xl)/,
      `${rel} still centres a max-width page shell`,
    );
    assert.doesNotMatch(
      source,
      /className="[^"]*w-full min-w-0[^"]*mx-auto/,
      `${rel} still centres after filling the column`,
    );
  }
});

test("authenticated module canvases fill the AppShell column", () => {
  const pages = [
    "app/(app)/admin/settings/page.tsx",
    "app/(app)/risk/[id]/page.tsx",
    "app/(app)/salary-advances/[id]/page.tsx",
    "app/(app)/people/onboarding/page.tsx",
    "app/(app)/people/offboarding/page.tsx",
    "app/(app)/saam/verify/page.tsx",
    "app/(app)/saam/verify/upload/page.tsx",
  ];
  for (const rel of pages) {
    const source = readFileSync(join(webRoot, rel), "utf8");
    assert.match(source, /w-full min-w-0/, `${rel} should fill the content column`);
    assert.doesNotMatch(
      source,
      /className="[^"]*mx-auto max-w-(lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/,
      `${rel} still centres a max-width page shell`,
    );
  }
});
