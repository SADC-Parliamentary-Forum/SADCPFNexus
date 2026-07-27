/**
 * Regression guard for travel attachment uploads.
 *
 * Axios with default Content-Type: application/json will JSON.stringify FormData
 * (File → {}), producing a ~40-byte body that Laravel rejects as missing `file`.
 * Our api client must strip/override that header for FormData posts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiTs = fs.readFileSync(path.join(root, "lib", "api.ts"), "utf8");

const checks = [
  {
    name: "request interceptor clears Content-Type for FormData",
    ok: /config\.data instanceof FormData/.test(apiTs) && /setContentType\(false\)/.test(apiTs),
  },
  {
    name: "travelApi.uploadAttachment sends multipart FormData with file key",
    ok:
      /fd\.append\("file", file\)/.test(apiTs) &&
      /`\/travel\/requests\/\$\{id\}\/attachments`/.test(apiTs) &&
      /"Content-Type": "multipart\/form-data"/.test(apiTs),
  },
];

let failed = false;
for (const check of checks) {
  if (!check.ok) {
    console.error(`FAIL: ${check.name}`);
    failed = true;
  } else {
    console.log(`OK: ${check.name}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("verify-travel-attachment-multipart: passed");
