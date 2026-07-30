/**
 * Safely unwrap a single API entity from either a bare object or `{ data: T }`.
 * Prevents null-property crashes when Laravel resource wrapping varies.
 */
export function unwrapEntity<T extends object>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as { data?: unknown } & Record<string, unknown>;

  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as T;
  }

  // Bare entity (has common identity keys) or already-unwrapped resource
  if ("id" in root || "reference_number" in root || "title" in root || "status" in root) {
    return root as T;
  }

  return null;
}
