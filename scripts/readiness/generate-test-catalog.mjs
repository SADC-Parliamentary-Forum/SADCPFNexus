#!/usr/bin/env node
import fs from "node:fs";

const sourcePath = "docs/testing/readiness-test-catalog-source.md";
const md = fs.readFileSync(sourcePath, "utf8");

const lines = md.split(/\r?\n/);
let module = "";
const tests = [];

for (const line of lines) {
  const moduleMatch = line.match(/^##\s+([A-Z0-9_-]+)/);
  if (moduleMatch) {
    module = moduleMatch[1];
    continue;
  }

  const row = line.match(/^\|\s*([A-Z]+-\d{3})\s*\|\s*(.+?)\s*\|\s*$/);
  if (!row) continue;

  tests.push({
    id: row[1],
    module,
    title: row[2],
    severity: row[1].startsWith("AUTH-") || row[1].startsWith("RBAC-") || row[1].startsWith("AUDIT-") ? "SEV-0/1 if failed" : "SEV-1/2 if failed",
    automation_candidate: true,
  });
}

const jsonOut = {
  generated_at: new Date().toISOString(),
  source: sourcePath,
  total_tests: tests.length,
  tests,
};

const csvHeader = "id,module,title,severity,automation_candidate";
const csvRows = tests.map((t) =>
  [t.id, t.module, `"${t.title.replaceAll('"', '""')}"`, `"${t.severity}"`, t.automation_candidate ? "yes" : "no"].join(",")
);

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/readiness-test-catalog.json", JSON.stringify(jsonOut, null, 2));
fs.writeFileSync("artifacts/readiness-test-catalog.csv", [csvHeader, ...csvRows].join("\n"));

console.log(`Generated test catalog with ${tests.length} tests.`);
if (tests.length < 250) {
  console.error("Catalog appears incomplete (<250 tests).");
  process.exit(1);
}
