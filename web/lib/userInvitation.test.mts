import assert from "node:assert/strict";
import test from "node:test";
import { invitationState } from "./userInvitation.ts";

const now = new Date("2026-11-06T10:00:00Z");
const invited = (inv: { status: string; expires_at: string; sent_at?: string | null } | null) => ({
  is_active: false,
  account_status: "invited",
  latest_account_invitation: inv,
});

test("a created account that was never emailed offers Send invitation", () => {
  const s = invitationState(invited({ status: "pending", expires_at: "2026-11-08T10:00:00Z", sent_at: null }), now);
  assert.equal(s.kind, "not_invited");
  assert.equal(s.action, "Send invitation");
  assert.equal(invitationState(invited(null), now).kind, "not_invited");
});

test("an emailed, unexpired invitation shows as sent with Resend", () => {
  const s = invitationState(invited({ status: "pending", expires_at: "2026-11-08T10:00:00Z", sent_at: "2026-11-06T09:00:00Z" }), now);
  assert.equal(s.kind, "sent");
  assert.equal(s.action, "Resend invitation");
  assert.equal(s.expiresAt, "2026-11-08T10:00:00Z");
});

test("an emailed invitation past its expiry shows as expired", () => {
  const s = invitationState(invited({ status: "pending", expires_at: "2026-11-05T10:00:00Z", sent_at: "2026-11-03T10:00:00Z" }), now);
  assert.equal(s.kind, "expired");
  assert.equal(s.action, "Resend invitation");
});

test("active and suspended accounts cannot be invited", () => {
  assert.deepEqual(
    [invitationState({ is_active: true, account_status: "active" }, now).action, invitationState({ is_active: false, account_status: "suspended" }, now).action],
    [null, null],
  );
  assert.equal(invitationState({ is_active: false, account_status: "suspended" }, now).label, "Suspended");
  assert.equal(invitationState({ is_active: false, account_status: "active" }, now).label, "Inactive");
});
