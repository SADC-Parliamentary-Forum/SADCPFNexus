export function peopleRowMatchesQuery(row: Record<string, unknown>, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const parts: string[] = [];
  const walk = (value: unknown, depth: number) => {
    if (depth > 2 || value == null) return;
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      return;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === "id" || key.endsWith("_id")) continue;
        walk(child, depth + 1);
      }
    }
  };
  walk(row, 0);
  return parts.join(" ").toLowerCase().includes(term);
}
