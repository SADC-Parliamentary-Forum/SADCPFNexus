import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Forward slashes on every OS so the paths below match on Windows too.
const webRoot = join(process.cwd()).replaceAll("\\", "/");

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      walkTsx(fullPath, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".tsx")) acc.push(fullPath);
  }
  return acc;
}

// An API call that changes data: create, update, delete, approve, submit, upload and so on.
const MUTATION =
  /\b\w+Api\.(create|store|update|save|submit|delete|destroy|remove|approve|reject|add|assign|send|upload|import|cancel|archive|restore|publish|close|reopen|return|post|put|patch)\w*\s*\(/;

// Files whose API writes are not user actions on that screen, or whose parent shows the toast.
// Each entry needs a reason.
const EXEMPT: Record<string, string> = {};

test("every screen that changes data tells the user whether it worked (shared toast)", () => {
  const offenders: string[] = [];
  for (const fullPath of [...walkTsx(join(webRoot, "app")), ...walkTsx(join(webRoot, "components"))]) {
    const rel = fullPath.replace(`${webRoot}/`, "");
    if (rel in EXEMPT) continue;
    const source = readFileSync(fullPath, "utf8");
    if (MUTATION.test(source) && !/\buseToast\(\)/.test(source)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], "Show toast.success / toast.error (useToast) after each save, submit or delete.");
});
