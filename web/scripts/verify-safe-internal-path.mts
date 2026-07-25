/**
 * Focused checks for open-redirect hardening (no Playwright runner required).
 * Run from web/: node --experimental-strip-types scripts/verify-safe-internal-path.mts
 */
import { safeInternalPath } from "../lib/safeInternalPath.ts";

const cases: Array<[string | null | undefined, string | null]> = [
  [null, null],
  [undefined, null],
  ["", null],
  ["https://evil.com", null],
  ["//evil.com", null],
  ["///evil.com", null],
  ["/\\evil.com", null],
  ["/%2f%2fevil.com", null],
  ["/%5cevil.com", null],
  ["/dashboard", "/dashboard"],
  ["/dashboard?tab=1", "/dashboard?tab=1"],
  ["/profile/security", "/profile/security"],
  ["/travel/123", "/travel/123"],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = safeInternalPath(input);
  if (got !== expected) {
    console.error(
      `FAIL safeInternalPath(${JSON.stringify(input)}) => ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
    failed += 1;
  } else {
    console.log(`OK   safeInternalPath(${JSON.stringify(input)}) => ${JSON.stringify(got)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll safeInternalPath checks passed");
