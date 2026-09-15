import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translate } from "./i18n/messages.ts";
import {
  actionIcon,
  completenessTone,
  compliancePresentation,
  humanizeSnake,
  registrationPresentation,
} from "./supplierDashboard.ts";

test("compliancePresentation makes non_compliant readable", () => {
  const presentation = compliancePresentation("non_compliant");
  assert.equal(presentation.code, "non_compliant");
  assert.equal(presentation.labelKey, "supplier.compliance.non_compliant");
  assert.equal(presentation.fallback, "Non-compliant");
  assert.equal(presentation.icon, "gpp_bad");
  assert.equal(presentation.tone, "danger");
  assert.equal(translate("en", presentation.labelKey), "Non-compliant");
  assert.equal(translate("fr", presentation.labelKey), "Non conforme");
  assert.equal(translate("pt", presentation.labelKey), "Não conforme");
});

test("compliancePresentation maps valid and expiring statuses", () => {
  const valid = compliancePresentation("valid");
  assert.equal(valid.icon, "verified");
  assert.equal(valid.tone, "success");
  assert.equal(translate("en", valid.labelKey), "Compliant");

  const expiring = compliancePresentation("expiring");
  assert.equal(expiring.icon, "event_upcoming");
  assert.equal(expiring.tone, "warning");
  assert.equal(translate("en", expiring.labelKey), "Expiring soon");
});

test("registrationPresentation replaces snake_case with readable labels", () => {
  const underReview = registrationPresentation("under_review");
  assert.equal(translate("en", underReview.labelKey), "Under review");
  assert.equal(underReview.icon, "hourglass_top");
  assert.equal(humanizeSnake("correction_required"), "Correction Required");
});

test("completenessTone and action icons are assigned", () => {
  assert.equal(completenessTone(100), "success");
  assert.equal(completenessTone(70), "warning");
  assert.equal(completenessTone(20), "danger");
  assert.equal(actionIcon("open_rfqs"), "request_quote");
  assert.equal(actionIcon("unknown_code"), "task_alt");
});

test("supplier dashboard labels RFQs as open and PO/invoice totals as totals", () => {
  const source = readFileSync(join(process.cwd(), "app/(app)/supplier/page.tsx"), "utf8");
  assert.match(source, /open_rfq_count/);
  assert.match(source, /countKey: "supplier.dashboard.openCount"/);
  assert.match(source, /purchase_order_count/);
  assert.match(source, /invoice_count/);
  assert.match(source, /countKey: "supplier.dashboard.totalCount"/);
  assert.equal(translate("en", "supplier.dashboard.totalCount", { count: 3 }), "3 total");
  assert.notEqual(translate("fr", "supplier.dashboard.totalCount"), translate("en", "supplier.dashboard.totalCount"));
  assert.notEqual(translate("pt", "supplier.dashboard.totalCount"), translate("en", "supplier.dashboard.totalCount"));
});

test("supplier dashboard renders status icons and never prints raw non_compliant", () => {
  const source = readFileSync(join(process.cwd(), "app/(app)/supplier/page.tsx"), "utf8");
  assert.match(source, /compliancePresentation/);
  assert.match(source, /material-symbols-outlined/);
  assert.match(source, /useI18n/);
  assert.doesNotMatch(source, /\{data\.compliance_status/);
});
