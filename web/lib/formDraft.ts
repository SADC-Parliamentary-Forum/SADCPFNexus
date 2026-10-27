/**
 * Browser-local autosave for long forms. Drafts are keyed by tenant + user +
 * form, so another account on the same browser never sees them, and every
 * draft is removed on logout (shared devices). Storage failures (private
 * mode, quota) are swallowed: autosave is a convenience, never a dependency.
 */
export const FORM_DRAFT_PREFIX = "sadcpf:draft:";

export interface DraftOwner {
  id: number;
  tenant_id?: number | null;
}

export interface StoredDraft<T> {
  version: 1;
  savedAt: string;
  value: T;
}

export function formDraftKey(owner: DraftOwner | null | undefined, formKey: string): string | null {
  if (!owner?.id) return null;
  return `${FORM_DRAFT_PREFIX}${owner.tenant_id ?? "-"}:${owner.id}:${formKey}`;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readFormDraft<T>(key: string | null, store: Storage | null = storage()): StoredDraft<T> | null {
  if (!key || !store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    return parsed?.version === 1 && parsed.value !== undefined ? parsed : null;
  } catch {
    return null;
  }
}

export function writeFormDraft<T>(key: string | null, value: T, store: Storage | null = storage(), now: Date = new Date()): void {
  if (!key || !store) return;
  try {
    const draft: StoredDraft<T> = { version: 1, savedAt: now.toISOString(), value };
    store.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota or disabled storage: skip silently */
  }
}

export function clearFormDraft(key: string | null, store: Storage | null = storage()): void {
  if (!key || !store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Remove every autosaved draft (all users) — called on logout. */
export function clearAllFormDrafts(store: Storage | null = storage()): void {
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(FORM_DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* ignore */
  }
}
