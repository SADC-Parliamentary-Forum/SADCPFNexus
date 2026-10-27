import assert from "node:assert/strict";
import test from "node:test";
import { moduleLink } from "./recordLinks.ts";

test("workflow modules deep-link to their record pages", () => {
  assert.equal(moduleLink("leave").href(5), "/leave/5");
  assert.equal(moduleLink("programmes").href(9), "/pif/9");
  assert.equal(moduleLink("salary_advance").href(3), "/salary-advances/3");
});

test("unknown or missing modules fall back to the approvals inbox, never a dead link", () => {
  assert.equal(moduleLink("not-a-module").href(1), "/approvals");
  assert.equal(moduleLink(null).href(1), "/approvals");
});
