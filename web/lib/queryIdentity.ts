/**
 * Identity that private React Query data belongs to. Every cached query
 * implicitly belongs to the signed-in account, so the whole cache is cleared
 * whenever this key changes rather than threading user ids through hundreds
 * of query keys. Roles are included because they change what the API returns.
 */
export interface QueryIdentityUser {
  id: number;
  tenant_id?: number | null;
  roles?: string[] | null;
}

export function queryIdentityKey(user: QueryIdentityUser | null | undefined): string | null {
  if (!user) return null;
  const roles = [...(user.roles ?? [])].sort().join(",");
  return `${user.tenant_id ?? "-"}:${user.id}:${roles}`;
}

/**
 * Clear when a signed-in identity ends (logout, eviction) or is replaced by a
 * different one. The first hydration (nothing → user) keeps the cache: it can
 * only hold queries started for that same browser session.
 */
export function shouldClearQueryCache(previous: string | null, next: string | null): boolean {
  return previous !== null && previous !== next;
}
