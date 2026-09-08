import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app/(app)/procurement/from-document/page.tsx"), "utf8");

test("from-document upload and form actions have gap so buttons are not flush", () => {
  assert.match(source, /mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap/);
  assert.match(source, /flex flex-wrap items-center gap-3/);
  assert.doesNotMatch(source, /btn-primary mt-4/);
  assert.doesNotMatch(source, /<div className="flex gap-2">/);
  assert.doesNotMatch(source, /<div className="flex flex-wrap gap-2">/);
});

test("from-document invoice-first form fields are labelled and spaced", () => {
  assert.match(source, /space-y-3 rounded border border-amber-200/);
  assert.match(source, /<label htmlFor="intake-exception-reason"/);
  assert.match(source, /<label htmlFor="intake-exception-officer"/);
  assert.match(source, /<label htmlFor="intake-exception-request-date"/);
  assert.match(source, /<label htmlFor="intake-exception-service-date"/);
  assert.match(source, /<label htmlFor="intake-exception-justification"/);
  assert.match(source, /htmlFor="intake-project"/);
});

test("from-document unmatched supplier step creates vendor and sends login invitation", () => {
  assert.match(source, /type Step = "upload" \| "review" \| "supplier" \| "project" \| "request" \| "preview"/);
  assert.match(source, /<label htmlFor="intake-supplier-name"/);
  assert.match(source, /<label htmlFor="intake-supplier-email"/);
  assert.match(source, /<label htmlFor="intake-supplier-phone"/);
  assert.match(source, /<label htmlFor="intake-supplier-contact"/);
  assert.match(source, /<label htmlFor="intake-supplier-invite"/);
  assert.match(source, /procurementIntakeApi.createSupplier/);
  assert.match(source, /Nexus never emails a password/);
  assert.match(source, /supplier_match_status === "unmatched"/);
  assert.doesNotMatch(source, /<label className=/);
});
