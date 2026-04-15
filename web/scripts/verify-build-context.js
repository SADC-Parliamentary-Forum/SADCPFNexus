/**
 * Fail fast when the Docker/web build context is stale or incomplete.
 *
 * The production Docker build previously saw `web/lib/api.ts` as if setup/auth
 * exports were missing even though the checked-out source contained them. This
 * script makes that mismatch explicit before Next.js compiles.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const checks = [
  {
    file: "lib/api.ts",
    includes: [
      "export function setSetupCompleteCookie(): void {",
      "export function clearSetupCompleteCookie(): void {",
      "export const setupApi = {",
    ],
  },
  {
    file: "app/(auth)/login/page.tsx",
    includes: [
      'from "@/lib/api"',
      "setSetupCompleteCookie",
      "clearSetupCompleteCookie",
    ],
  },
  {
    file: "app/(auth)/reset-password/page.tsx",
    includes: [
      'from "@/lib/api"',
      "setSetupCompleteCookie",
      "clearSetupCompleteCookie",
    ],
  },
  {
    file: "components/layout/Header.tsx",
    includes: [
      'from "@/lib/api"',
      "clearSetupCompleteCookie",
    ],
  },
  {
    file: "app/setup/page.tsx",
    includes: [
      'from "@/lib/api"',
      "await setupApi.updateIdentity({",
      "await profileApi.update({",
      "await setupApi.complete();",
      'title="Emergency Contact"',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const absolutePath = path.join(root, check.file);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`${check.file}: file is missing from the web build context`);
    continue;
  }

  const contents = fs.readFileSync(absolutePath, "utf8");
  for (const needle of check.includes) {
    if (!contents.includes(needle)) {
      failures.push(`${check.file}: missing expected text -> ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[verify-build-context] Build context verification failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[verify-build-context] Web build context looks consistent.");
