import assert from "node:assert/strict";
import test from "node:test";
import {
  categorizeLeaveBalances,
  formatLeaveDays,
  leaveTypeName,
  leaveTypeOptionLabel,
  prefillLeaveEndDate,
} from "./leaveBalances.ts";

test("formatLeaveDays uses a labelled day unit", () => {
  assert.equal(formatLeaveDays(1), "1 day");
  assert.equal(formatLeaveDays(0), "0 days");
  assert.equal(formatLeaveDays(2.5), "2.5 days");
  assert.equal(formatLeaveDays(12), "12 days");
});

test("leaveTypeName prefers catalog names over raw codes", () => {
  assert.equal(leaveTypeName("annual", [{ code: "annual", name: "Annual Leave" }]), "Annual Leave");
  assert.equal(leaveTypeName("lil"), "Leave in Lieu");
  assert.equal(leaveTypeName("sick"), "Sick");
});

test("categorizeLeaveBalances shows remaining days per type from the ledger", () => {
  const cards = categorizeLeaveBalances(
    {
      annual_balance_days: 21,
      lil_hours_available: 16,
      sick_leave_used_days: 3,
      data: [
        { leave_type: "annual", balance: 21, pending: 2, available: 19 },
        { leave_type: "sick", balance: 30, pending: 0, available: 27 },
        { leave_type: "lil", balance: 3, pending: 0, available: 3 },
        { leave_type: "maternity", balance: 90, pending: 0, available: 90 },
      ],
    },
    [
      { code: "annual", name: "Annual Leave" },
      { code: "sick", name: "Sick Leave" },
      { code: "lil", name: "Leave in Lieu" },
      { code: "maternity", name: "Maternity Leave" },
    ],
  );

  assert.deepEqual(
    cards.map((card) => [card.code, card.headline, card.remaining, card.pending, card.name]),
    [
      ["annual", "remaining", 19, 2, "Annual Leave"],
      ["sick", "remaining", 27, 0, "Sick Leave"],
      ["lil", "remaining", 3, 0, "Leave in Lieu"],
      ["maternity", "remaining", 90, 0, "Maternity Leave"],
    ],
  );
  assert.equal(cards.every((card) => card.unit === "days"), true);
});

test("categorizeLeaveBalances falls back to annual remaining without converting LIL hours to days", () => {
  const cards = categorizeLeaveBalances({
    annual_balance_days: 18,
    lil_hours_available: 16,
    sick_leave_used_days: 4,
    special_leave_days_used: 1,
  });

  const byCode = Object.fromEntries(cards.map((card) => [card.code, card]));
  assert.equal(byCode.annual.headline, "remaining");
  assert.equal(byCode.annual.remaining, 18);
  assert.equal(byCode.lil.headline, "remaining");
  assert.equal(byCode.lil.remaining, 0);
  assert.equal(byCode.sick.headline, "used");
  assert.equal(byCode.sick.used, 4);
  assert.equal(byCode.special.headline, "used");
  assert.equal(byCode.special.used, 1);
});

test("leaveTypeOptionLabel includes eligible days for dropdown options", () => {
  const cards = categorizeLeaveBalances({
    annual_balance_days: 18,
    data: [{ leave_type: "annual", available: 16, pending: 2 }],
  });
  assert.equal(
    leaveTypeOptionLabel("annual", "Annual Leave", cards),
    "Annual Leave — 16 days available · 2 days pending",
  );
  assert.equal(leaveTypeOptionLabel("unpaid", "Unpaid Leave", cards), "Unpaid Leave — no balance limit");
});

test("prefillLeaveEndDate copies start when the end date is still blank", () => {
  assert.equal(prefillLeaveEndDate("2026-09-01", ""), "2026-09-01");
  assert.equal(prefillLeaveEndDate("2026-09-01", "2026-09-04"), "2026-09-04");
  assert.equal(prefillLeaveEndDate("", ""), "");
});
