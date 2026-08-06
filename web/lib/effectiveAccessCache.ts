import { accessApi, type AccessEffectivePayload } from "@/lib/api";

/**
 * Session-lived cache for GET /access/effective, shared by every AppShell mount
 * and AuthProvider. Without this, remounting AppShell (e.g. navigating between
 * the /dashboard and (app) route groups, which sit under separate layouts)
 * re-fetched permissions from scratch on every crossing, showing a loading
 * flash each time.
 */

const TTL_MS = 5 * 60 * 1000;

let cachedPayload: AccessEffectivePayload | null = null;
let cachedAt = 0;
let inFlight: Promise<AccessEffectivePayload> | null = null;

export function getCachedEffectiveAccess(): AccessEffectivePayload | null {
  if (cachedPayload && Date.now() - cachedAt < TTL_MS) return cachedPayload;
  return null;
}

export function fetchEffectiveAccess(force = false): Promise<AccessEffectivePayload> {
  if (!force) {
    const cached = getCachedEffectiveAccess();
    if (cached) return Promise.resolve(cached);
    if (inFlight) return inFlight;
  }
  inFlight = accessApi
    .effective()
    .then(({ data }) => {
      cachedPayload = data.data;
      cachedAt = Date.now();
      inFlight = null;
      return cachedPayload;
    })
    .catch((err) => {
      inFlight = null;
      throw err;
    });
  return inFlight;
}

export function clearEffectiveAccessCache() {
  cachedPayload = null;
  cachedAt = 0;
  inFlight = null;
}
