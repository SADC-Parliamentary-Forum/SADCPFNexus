import assert from "node:assert/strict";
import test from "node:test";
import { clearAllFormDrafts, formDraftKey, readFormDraft, writeFormDraft } from "./formDraft.ts";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

test("drafts are scoped per tenant and user: another account never reads them", () => {
  const store = new MemoryStorage();
  const a = formDraftKey({ id: 1, tenant_id: 1 }, "travel.create");
  const b = formDraftKey({ id: 2, tenant_id: 1 }, "travel.create");
  const otherTenant = formDraftKey({ id: 1, tenant_id: 2 }, "travel.create");
  writeFormDraft(a, { purpose: "Workshop" }, store);

  assert.deepEqual(readFormDraft<{ purpose: string }>(a, store)?.value, { purpose: "Workshop" });
  assert.equal(readFormDraft(b, store), null);
  assert.equal(readFormDraft(otherTenant, store), null);
});

test("no signed-in user means no key and nothing is stored", () => {
  const store = new MemoryStorage();
  assert.equal(formDraftKey(null, "travel.create"), null);
  writeFormDraft(null, { x: 1 }, store);
  assert.equal(store.length, 0);
});

test("logout clears every draft but leaves unrelated storage", () => {
  const store = new MemoryStorage();
  writeFormDraft(formDraftKey({ id: 1, tenant_id: 1 }, "a"), 1, store);
  writeFormDraft(formDraftKey({ id: 2, tenant_id: 1 }, "b"), 2, store);
  store.setItem("sadcpf_theme", "dark");
  clearAllFormDrafts(store);
  assert.equal(store.length, 1);
  assert.equal(store.getItem("sadcpf_theme"), "dark");
});

test("corrupt or foreign entries are ignored rather than crashing the form", () => {
  const store = new MemoryStorage();
  const k = formDraftKey({ id: 1, tenant_id: 1 }, "x");
  store.setItem(k!, "{not json");
  assert.equal(readFormDraft(k, store), null);
  store.setItem(k!, JSON.stringify({ version: 99, value: 1 }));
  assert.equal(readFormDraft(k, store), null);
});
