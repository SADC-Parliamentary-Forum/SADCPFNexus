import assert from "node:assert/strict";
import test from "node:test";
import { isBudgetConfirmed } from "./procurementBudget.ts";

test("isBudgetConfirmed trusts the API flag", () => {
  assert.equal(isBudgetConfirmed({ budget_confirmed: true }), true);
  assert.equal(isBudgetConfirmed({ budget_confirmed: 1 }), true);
  assert.equal(isBudgetConfirmed({ budget_confirmed: false }), false);
});

test("isBudgetConfirmed treats an unreleased reservation as confirmation", () => {
  assert.equal(
    isBudgetConfirmed({
      budgetReservations: [{ status: "confirmed", released_at: null }],
    }),
    true,
  );
});

test("isBudgetConfirmed is false when there is no reservation", () => {
  assert.equal(isBudgetConfirmed({}), false);
});
