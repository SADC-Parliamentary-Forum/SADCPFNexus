#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mkdir -p artifacts

echo "[READINESS] Endpoint parity"
node scripts/readiness/endpoint-parity.mjs

echo "[READINESS] Test catalog generation"
node scripts/readiness/generate-test-catalog.mjs

echo "[READINESS] Endpoint coverage matrix generation"
node scripts/readiness/generate-endpoint-coverage.mjs

echo "[READINESS] Workflow sequencing matrix generation"
node scripts/readiness/generate-workflow-matrix.mjs

echo "[READINESS] UAT pack generation"
node scripts/readiness/generate-uat-pack.mjs

echo "[READINESS] Workflow invariants (PHPUnit)"
cd api
# One process: RefreshDatabase migrate:fresh runs once. Separate artisan
# invocations re-drop 400+ tables and exhaust Postgres max_locks_per_transaction.
php artisan test --stop-on-failure --filter='ReadinessInvariantTest|ReadinessEndpointHealthTest|ApiRouteScenarioRunnerTest|LeaveWorkflowPatternTest'
cd "$ROOT_DIR"

echo "[READINESS] Route/link 404/500 smoke (Playwright)"
cd web
npx playwright test tests/e2e/readiness-routes.spec.ts --project=staff --project=admin
cd "$ROOT_DIR"

echo "[READINESS] Build report"
node scripts/readiness/build-readiness-report.mjs

echo "[READINESS] Validate readiness artifacts"
node scripts/readiness/validate-readiness-artifacts.mjs

echo "[READINESS] Complete"
