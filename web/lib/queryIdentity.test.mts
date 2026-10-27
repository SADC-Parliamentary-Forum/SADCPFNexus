import assert from "node:assert/strict";
import test from "node:test";
import { queryIdentityKey, shouldClearQueryCache } from "./queryIdentity.ts";

const staffA = { id: 1, tenant_id: 1, roles: ["Staff"] };
const staffB = { id: 2, tenant_id: 1, roles: ["Staff"] };

test("same-tab account switch clears the cache", () => {
  assert.equal(shouldClearQueryCache(queryIdentityKey(staffA), queryIdentityKey(staffB)), true);
});

test("logout clears the cache", () => {
  assert.equal(shouldClearQueryCache(queryIdentityKey(staffA), null), true);
});

test("first hydration and re-renders of the same identity keep the cache", () => {
  assert.equal(shouldClearQueryCache(null, queryIdentityKey(staffA)), false);
  assert.equal(shouldClearQueryCache(queryIdentityKey(staffA), queryIdentityKey({ ...staffA })), false);
});

test("role changes for the same user clear the cache; role order does not", () => {
  const promoted = { ...staffA, roles: ["Staff", "HR Manager"] };
  assert.equal(shouldClearQueryCache(queryIdentityKey(staffA), queryIdentityKey(promoted)), true);
  assert.equal(
    queryIdentityKey({ ...staffA, roles: ["b", "a"] }),
    queryIdentityKey({ ...staffA, roles: ["a", "b"] }),
  );
});

test("same user id in another tenant is a different identity", () => {
  assert.notEqual(queryIdentityKey(staffA), queryIdentityKey({ ...staffA, tenant_id: 2 }));
});
