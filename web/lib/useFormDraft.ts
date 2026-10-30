"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { clearFormDraft, formDraftKey, readFormDraft, writeFormDraft, type StoredDraft } from "@/lib/formDraft";

interface Options {
  /** Autosave only while true (e.g. not while editing an existing server record). */
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Autosave a form's state locally and offer to restore it after a reload or
 * crash. Also provides a stable operation key for the form session so a
 * retried create is idempotent on the server.
 */
export function useFormDraft<T>(formKey: string, value: T, { enabled = true, debounceMs = 800 }: Options = {}) {
  const [key, setKey] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<StoredDraft<T> | null>(null);
  const operationKey = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const decided = useRef(false);

  // Resolve the owner-scoped key after mount (stored user is client-only).
  useEffect(() => {
    if (!enabled) return;
    const k = formDraftKey(getStoredUser(), formKey);
    setKey(k);
    const existing = readFormDraft<T>(k);
    if (existing) setRestorable(existing);
    else decided.current = true;
  }, [enabled, formKey]);

  // Debounced save — only once the user has dealt with any restore prompt,
  // so an untouched blank form never overwrites a recoverable draft.
  useEffect(() => {
    if (!enabled || !key || !decided.current) return;
    const t = setTimeout(() => writeFormDraft(key, value), debounceMs);
    return () => clearTimeout(t);
  }, [enabled, key, value, debounceMs]);

  const restore = useCallback((): T | null => {
    decided.current = true;
    const v = restorable?.value ?? null;
    setRestorable(null);
    return v;
  }, [restorable]);

  const discard = useCallback(() => {
    decided.current = true;
    clearFormDraft(key);
    setRestorable(null);
  }, [key]);

  /** Call after a successful save/submit. */
  const clear = useCallback(() => clearFormDraft(key), [key]);

  return { restorable, restore, discard, clear, operationKey: operationKey.current };
}
