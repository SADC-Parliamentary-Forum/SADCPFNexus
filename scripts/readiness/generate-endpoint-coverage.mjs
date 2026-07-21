#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";

const scenarios = [
  "valid_authenticated",
  "missing_auth",
  "unauthorized_role",
  "invalid_payload",
  "missing_required_field",
  "invalid_id_format",
  "record_not_found",
  "duplicate_submission",
  "invalid_workflow_transition",
  "expired_token",
  "deleted_or_archived_record_access",
  "malformed_file_upload",
  "oversized_file_upload",
  "unsupported_file_type",
  "db_constraint_violation",
  "rate_limit_exceeded",
  "dependency_unavailable",
];

const routeJson = execSync("php artisan route:list --path=api/v1 --json", {
  cwd: "api",
  stdio: ["ignore", "pipe", "pipe"],
}).toString();

const routes = JSON.parse(routeJson)
  .map((r) => ({
    method: String(r.method || "").split("|")[0],
    uri: String(r.uri || ""),
    name: String(r.name || ""),
    action: String(r.action || ""),
  }))
  .filter((r) => r.uri.startsWith("api/v1/"))
  .map((r) => ({
    ...r,
    endpoint: "/" + r.uri.replace(/^api\/v1\//, "").replace(/\{[^}]+\}/g, "{id}"),
  }));

const matrix = routes.map((r) => ({
  method: r.method,
  endpoint: r.endpoint,
  route_name: r.name,
  controller_action: r.action,
  scenarios: Object.fromEntries(scenarios.map((s) => [s, "planned"])),
}));

const csvHeader = ["method", "endpoint", "route_name", "controller_action", ...scenarios].join(",");
const csvRows = matrix.map((m) => [
  m.method,
  `"${m.endpoint}"`,
  `"${m.route_name.replaceAll('"', '""')}"`,
  `"${m.controller_action.replaceAll('"', '""')}"`,
  ...scenarios.map((s) => m.scenarios[s]),
].join(","));

fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/endpoint-coverage-matrix.json", JSON.stringify({ generated_at: new Date().toISOString(), scenarios, total_endpoints: matrix.length, matrix }, null, 2));
fs.writeFileSync("artifacts/endpoint-coverage-matrix.csv", [csvHeader, ...csvRows].join("\n"));

console.log(`Generated endpoint coverage matrix for ${matrix.length} endpoints.`);
if (matrix.length === 0) {
  console.error("No endpoints found for coverage matrix.");
  process.exit(1);
}
