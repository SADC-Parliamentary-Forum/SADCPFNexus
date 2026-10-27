import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source of the web API client for static assertions in unit tests:
 * lib/api.ts plus every domain/transport module under lib/api/. Tests use
 * this instead of reading lib/api.ts directly so code can move into
 * lib/api/* without silently weakening their assertions.
 */
export function readApiSource(webRoot: string): string {
  const parts = [readFileSync(join(webRoot, "lib", "api.ts"), "utf8")];
  const dir = join(webRoot, "lib", "api");
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).sort()) {
      if (file.endsWith(".ts")) parts.push(readFileSync(join(dir, file), "utf8"));
    }
  }
  return parts.join("\n");
}
