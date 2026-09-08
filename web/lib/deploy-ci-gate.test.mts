import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(process.cwd(), "..");
const workflowPath = join(repoRoot, ".github/workflows/deploy-production.yml");
const waitScriptPath = join(repoRoot, "scripts/ci/wait-for-commit-checks.sh");

// PHPUnit on main for 5198fc11 ran ~81 minutes (17:08Z–18:29Z). A 40-minute
// gate times out while that job is still in_progress and skips the SSH deploy.
const MIN_WAIT_SECONDS = 7200;

test("deploy CI gate waits longer than observed PHPUnit runtime", () => {
  const workflow = readFileSync(workflowPath, "utf8");
  const waitMatch = workflow.match(/WAIT_TIMEOUT_SECONDS:\s*"(\d+)"/);
  assert.ok(waitMatch, "WAIT_TIMEOUT_SECONDS must be set on the CI gate");
  const waitSeconds = Number(waitMatch[1]);
  assert.ok(
    waitSeconds >= MIN_WAIT_SECONDS,
    `WAIT_TIMEOUT_SECONDS must be >= ${MIN_WAIT_SECONDS}s (120 min); got ${waitSeconds}`,
  );

  const ciGateStart = workflow.indexOf("\n  ci-gate:");
  const nextJob = workflow.indexOf("\n  deploy:");
  assert.ok(ciGateStart >= 0 && nextJob > ciGateStart, "CI gate job block must exist");
  const ciGateBlock = workflow.slice(ciGateStart, nextJob);
  const jobTimeout = ciGateBlock.match(/timeout-minutes:\s*(\d+)/);
  assert.ok(jobTimeout, "CI gate job must set timeout-minutes");
  const jobSeconds = Number(jobTimeout[1]) * 60;
  assert.ok(
    jobSeconds > waitSeconds,
    `CI gate timeout-minutes (${jobTimeout[1]}) must exceed WAIT_TIMEOUT_SECONDS (${waitSeconds}s)`,
  );
});

test("wait-for-commit-checks default timeout matches the long PHPUnit gate", () => {
  const script = readFileSync(waitScriptPath, "utf8");
  const defaultMatch = script.match(/WAIT_TIMEOUT_SECONDS:-\s*(\d+)/);
  assert.ok(defaultMatch, "wait script must have a WAIT_TIMEOUT_SECONDS default");
  assert.ok(
    Number(defaultMatch[1]) >= MIN_WAIT_SECONDS,
    `wait script default must be >= ${MIN_WAIT_SECONDS}s; got ${defaultMatch[1]}`,
  );
});
