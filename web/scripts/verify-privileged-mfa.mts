/**
 * Node check for privileged MFA redirect helper (no browser).
 * Run: npm run verify:mfa
 */
import { requiresPrivilegedMfaSetup, MFA_SETUP_PATH } from "../lib/privilegedMfa.ts";

const cases: Array<{
  name: string;
  user: { roles?: string[]; mfa_enabled?: boolean };
  expect: boolean;
}> = [
  { name: "staff without mfa", user: { roles: ["Staff"], mfa_enabled: false }, expect: false },
  { name: "admin without mfa", user: { roles: ["System Admin"], mfa_enabled: false }, expect: true },
  { name: "admin with mfa", user: { roles: ["System Admin"], mfa_enabled: true }, expect: false },
  { name: "finance without mfa", user: { roles: ["Finance Controller"], mfa_enabled: false }, expect: true },
  { name: "empty roles", user: { roles: [], mfa_enabled: false }, expect: false },
];

let failed = 0;
for (const c of cases) {
  const got = requiresPrivilegedMfaSetup(c.user);
  if (got !== c.expect) {
    console.error(`FAIL ${c.name}: got ${got}, want ${c.expect}`);
    failed += 1;
  } else {
    console.log(`ok ${c.name}`);
  }
}

if (MFA_SETUP_PATH !== "/profile/security") {
  console.error("FAIL MFA_SETUP_PATH");
  failed += 1;
}

if (failed > 0) {
  process.exit(1);
}
console.log("privileged MFA helper checks passed");
