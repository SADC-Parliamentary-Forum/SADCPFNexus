#!/usr/bin/env node
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync("artifacts/readiness-test-catalog.json", "utf8"));

const personas = [
  "System Administrator",
  "HR/Admin Officer",
  "Finance Officer",
  "Director of Finance and Corporate Services",
  "Programme Manager / Requesting Officer",
  "Line Manager / Head of Department",
  "Secretary General",
  "ICT Officer",
  "Internal Auditor",
  "Procurement Officer",
  "Staff Member",
  "Supplier",
  "External Stakeholder",
  "Member of Parliament",
  "Parliament Staff",
];

const includeByPersona = {
  "System Administrator": ["AUTH", "RBAC", "AUDIT", "DB"],
  "HR/Admin Officer": ["AUTH", "PROFILE", "LEAVE", "TIME", "WEEKLY"],
  "Finance Officer": ["ADV", "TRAVEL", "PROC", "REIMB", "WEEKLY"],
  "Director of Finance and Corporate Services": ["ADV", "TRAVEL", "PIF", "PROC", "WEEKLY"],
  "Programme Manager / Requesting Officer": ["PIF", "TRAVEL", "TIME", "WEEKLY"],
  "Line Manager / Head of Department": ["LEAVE", "TRAVEL", "TIME", "WEEKLY"],
  "Secretary General": ["LEAVE", "TRAVEL", "PIF", "WEEKLY", "AUDIT"],
  "ICT Officer": ["AUTH", "RBAC", "FILE", "DB"],
  "Internal Auditor": ["AUDIT", "RBAC", "RISK", "WEEKLY"],
  "Procurement Officer": ["PROC", "FILE", "AUDIT"],
  "Staff Member": ["AUTH", "PROFILE", "LEAVE", "ADV", "TIME"],
  "Supplier": ["PROC", "AUTH", "FILE"],
  "External Stakeholder": ["MEET", "AUTH"],
  "Member of Parliament": ["MEET", "AUTH"],
  "Parliament Staff": ["MEET", "AUTH"],
};

fs.mkdirSync("docs/testing/uat", { recursive: true });

for (const persona of personas) {
  const modules = includeByPersona[persona] || [];
  const tests = catalog.tests.filter((t) => modules.includes(t.module));
  const slug = persona.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const outPath = `docs/testing/uat/${slug}.md`;

  const lines = [
    `# UAT Script - ${persona}`,
    "",
    `Date: __________`,
    `Tester: __________`,
    `Environment: Staging / Pre-Prod`,
    "",
    "## Evidence",
    "- Screenshot or recording attached: [ ]",
    "- Defects logged with IDs: [ ]",
    "- Retest evidence attached: [ ]",
    "",
    "## Test Cases",
  ];

  for (const t of tests) {
    lines.push(`- [ ] ${t.id} (${t.module}): ${t.title}`);
  }

  lines.push("", "## Sign-off", "- Module owner sign-off: ____________________", "- QA lead sign-off: ____________________");

  fs.writeFileSync(outPath, lines.join("\n"));
}

console.log(`Generated UAT packs for ${personas.length} personas.`);
