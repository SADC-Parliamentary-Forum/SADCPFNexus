import assert from "node:assert/strict";
import test from "node:test";
import { safeExternalUrl } from "./safeExternalUrl.ts";

test("safeExternalUrl keeps http and https links", () => {
  assert.equal(safeExternalUrl("https://example.org/report.pdf"), "https://example.org/report.pdf");
  assert.equal(safeExternalUrl("  http://example.org  "), "http://example.org/");
});

test("safeExternalUrl rejects script and embedded-content schemes", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl(" JavaScript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeExternalUrl("vbscript:msgbox(1)"), null);
});

test("safeExternalUrl rejects relative, empty and malformed values", () => {
  assert.equal(safeExternalUrl("/dashboard"), null);
  assert.equal(safeExternalUrl(""), null);
  assert.equal(safeExternalUrl(null), null);
  assert.equal(safeExternalUrl("not a url"), null);
});
