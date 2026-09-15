import assert from "node:assert/strict";
import test from "node:test";
import { accountProfilePath, isSupplierUser, postAuthDestination } from "./postAuthDestination.ts";
import type { AuthUser } from "./api.ts";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: "Test",
    email: "test@sadcpf.org",
    tenant_id: 1,
    classification: "UNCLASSIFIED",
    roles: ["staff"],
    permissions: [],
    setup_completed: true,
    ...overrides,
  };
}

test("staff with completed setup go to the dashboard", () => {
  assert.equal(postAuthDestination(user()), "/dashboard");
});

test("staff without setup go to the employee wizard", () => {
  assert.equal(postAuthDestination(user({ setup_completed: false })), "/setup");
});

test("suppliers skip the employee wizard even when setup_completed is false", () => {
  assert.equal(
    postAuthDestination(user({ roles: ["Supplier"], setup_completed: false })),
    "/supplier",
  );
});

test("suppliers honour an internal supplier deep link", () => {
  assert.equal(
    postAuthDestination(user({ roles: ["Supplier"] }), "/supplier/rfqs"),
    "/supplier/rfqs",
  );
});

test("suppliers ignore staff deep links", () => {
  assert.equal(
    postAuthDestination(user({ roles: ["Supplier"] }), "/dashboard"),
    "/supplier",
  );
});

test("isSupplierUser recognises supplier roles", () => {
  assert.equal(isSupplierUser(user({ roles: ["Supplier"] })), true);
  assert.equal(isSupplierUser(user({ roles: ["staff"] })), false);
});

test("accountProfilePath sends suppliers to the supplier profile, not staff HR profile", () => {
  assert.equal(accountProfilePath(user({ roles: ["Supplier"] })), "/supplier/profile");
  assert.equal(accountProfilePath(user({ roles: ["Supplier Finance User"] })), "/supplier/profile");
  assert.equal(accountProfilePath(user({ roles: ["staff"] })), "/profile");
  assert.equal(accountProfilePath(null), "/profile");
});
