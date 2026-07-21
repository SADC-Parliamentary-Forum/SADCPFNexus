# Readiness Gate Definition

## Hard-Fail Gates (Production Blocking)

1. Unexpected `404` on any valid frontend route: fail.
2. Unhandled `500` on any valid frontend route/API endpoint: fail.
3. Any self-approval success path: fail.
4. Any out-of-sequence approval success path: fail.

## Enforcement Mapping

- `web/tests/e2e/readiness-routes.spec.ts`
  - fails on unexpected `404`
  - fails on `>=500` statuses and unhandled server error content
- `api/tests/Feature/Workflow/ReadinessInvariantTest.php`
  - fails if requester can self-approve
  - fails if non-assigned approver can approve
- `api/tests/Feature/Workflow/ReadinessEndpointHealthTest.php`
  - fails if any unauthenticated `GET /api/v1/*` route returns unhandled `500`
- `scripts/readiness/run-readiness.sh`
  - executes both gates and exits non-zero on failure
- `.github/workflows/readiness.yml`
  - runs readiness gate on push/PR and blocks merge when failing

## Generated Artifacts

- `artifacts/readiness-test-catalog.json`
- `artifacts/readiness-test-catalog.csv`
- `artifacts/endpoint-coverage-matrix.json`
- `artifacts/endpoint-coverage-matrix.csv`
- `artifacts/workflow-sequencing-matrix.json`
- `artifacts/workflow-sequencing-matrix.csv`
- `artifacts/readiness-report.json`
- `artifacts/readiness-report.html`
