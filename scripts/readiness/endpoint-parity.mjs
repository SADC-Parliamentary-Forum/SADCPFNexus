#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";

function parsePhpRoutesFromRouteListJson(raw) {
  const rows = JSON.parse(raw);
  const out = new Set();
  for (const row of rows) {
    const uri = String(row.uri || "").trim();
    if (!uri.startsWith("api/v1/")) continue;
    const n = "/" + uri.replace(/^api\/v1\//, "").replace(/\{[^}]+\}/g, "{id}");
    out.add(n);
  }
  return out;
}

function parseWebApiPaths(text) {
  const set = new Set();
  const re = /api\.(?:get|post|put|patch|delete)\s*\(\s*`([^`]+)`|api\.(?:get|post|put|patch|delete)\s*\(\s*"([^"]+)"|api\.(?:get|post|put|patch|delete)\s*\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const path = m[1] || m[2] || m[3];
    if (!path || !path.startsWith("/")) continue;
    // Skip helper-composed prefixes that are not concrete endpoint paths.
    if (path.includes("${prefix}") || path.includes("${api.defaults.baseURL}")) continue;
    const n = path
      .replace(/\$\{[^}]+\}/g, "{id}")
      .replace(/\d+/g, "{id}");
    set.add(n);
  }
  return set;
}

const routeJson = execSync("php artisan route:list --path=api/v1 --json", {
  cwd: "api",
  stdio: ["ignore", "pipe", "pipe"],
}).toString();

const phpRoutes = parsePhpRoutesFromRouteListJson(routeJson);
const apiClient = fs.readFileSync("web/lib/api.ts", "utf8");
const webRoutes = parseWebApiPaths(apiClient);

const missingInApi = [...webRoutes].filter((p) => !phpRoutes.has(p)).sort();
const notReferencedByWebClient = [...phpRoutes].filter((p) => !webRoutes.has(p)).sort();

const report = {
  generated_at: new Date().toISOString(),
  php_route_count: phpRoutes.size,
  web_client_route_count: webRoutes.size,
  missing_in_api: missingInApi,
  not_referenced_by_web_client: notReferencedByWebClient,
};

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/endpoint-parity.json", JSON.stringify(report, null, 2));

console.log(`PHP routes: ${phpRoutes.size}`);
console.log(`Web client routes: ${webRoutes.size}`);
console.log(`Missing in API: ${missingInApi.length}`);
console.log(`Not referenced by web client: ${notReferencedByWebClient.length}`);

// Hard gate only on client routes that do not exist in API.
if (missingInApi.length > 0) {
  console.error("Endpoint parity gate failed. See artifacts/endpoint-parity.json");
  process.exit(1);
}
