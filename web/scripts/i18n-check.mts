// Usage: node --experimental-strip-types scripts/i18n-check.mts <group> [file ...]
// Reports hardcoded English, keys missing from a locale, and keys the group's EN/FR/PT disagree on.
import { readFileSync } from "node:fs";
import { catalogGroups } from "../lib/i18n/catalog/index.ts";
import { LOCALES, catalogFor } from "../lib/i18n/messages.ts";
import { findHardcodedCopy, usedKeys } from "../lib/i18n/hardcoded.ts";

const [groupName, ...only] = process.argv.slice(2);
const group = catalogGroups[groupName as keyof typeof catalogGroups];
if (!group) {
  console.error(`Unknown group "${groupName}". Groups: ${Object.keys(catalogGroups).join(", ")}`);
  process.exit(2);
}

let problems = 0;
const enKeys = Object.keys(group.en);
for (const [name, dict] of [["fr", group.fr], ["pt", group.pt]] as const) {
  const missing = enKeys.filter((k) => !String(dict[k] ?? "").trim());
  const extra = Object.keys(dict).filter((k) => !(k in group.en));
  if (missing.length) { problems += missing.length; console.log(`${name} missing: ${missing.join(", ")}`); }
  if (extra.length) { problems += extra.length; console.log(`${name} has keys not in en: ${extra.join(", ")}`); }
}

for (const rel of only.length ? only : group.files) {
  const source = readFileSync(rel, "utf8");
  const out: string[] = [];
  if (!/useI18n/.test(source)) out.push("  does not use useI18n");
  for (const hit of findHardcodedCopy(source)) out.push(`  ${hit.line}: ${hit.text}`);
  for (const key of new Set(usedKeys(source))) {
    for (const locale of LOCALES) {
      if (!(key in catalogFor(locale))) out.push(`  key ${key} missing from ${locale}`);
    }
  }
  if (out.length) {
    problems += out.length;
    console.log(rel);
    console.log(out.join("\n"));
  }
}
console.log(problems ? `${problems} problem(s).` : "Clean.");
process.exit(problems ? 1 : 0);
