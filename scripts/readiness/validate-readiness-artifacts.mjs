#!/usr/bin/env node
import fs from "node:fs";

const requiredArtifacts = [
  "artifacts/readiness-test-catalog.json",
  "artifacts/readiness-test-catalog.csv",
  "artifacts/endpoint-coverage-matrix.json",
  "artifacts/endpoint-coverage-matrix.csv",
  "artifacts/workflow-sequencing-matrix.json",
  "artifacts/workflow-sequencing-matrix.csv",
  "artifacts/endpoint-parity.json",
  "artifacts/readiness-report.json",
  "artifacts/readiness-report.html",
];

const requiredUatPacks = [
  "docs/testing/uat/system-administrator.md",
  "docs/testing/uat/hr-admin-officer.md",
  "docs/testing/uat/finance-officer.md",
  "docs/testing/uat/director-of-finance-and-corporate-services.md",
  "docs/testing/uat/programme-manager-requesting-officer.md",
  "docs/testing/uat/line-manager-head-of-department.md",
  "docs/testing/uat/secretary-general.md",
  "docs/testing/uat/ict-officer.md",
  "docs/testing/uat/internal-auditor.md",
  "docs/testing/uat/procurement-officer.md",
  "docs/testing/uat/staff-member.md",
  "docs/testing/uat/supplier.md",
  "docs/testing/uat/external-stakeholder.md",
  "docs/testing/uat/member-of-parliament.md",
  "docs/testing/uat/parliament-staff.md",
];

const missing = [...requiredArtifacts, ...requiredUatPacks].filter((p) => !fs.existsSync(p));
if (missing.length > 0) {
  console.error("Missing readiness outputs:");
  for (const m of missing) console.error(` - ${m}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync("artifacts/readiness-report.json", "utf8"));
if (!report.pass) {
  console.error("Readiness report is not passing.");
  process.exit(1);
}

console.log("Readiness artifact validation passed.");
