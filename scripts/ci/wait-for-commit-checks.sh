#!/usr/bin/env bash
# Wait until GitHub check runs for a commit have finished successfully.
# Used by Deploy production so a green main merge is required before SSH deploy.
#
# Env:
#   GITHUB_REPOSITORY   owner/repo
#   WAIT_SHA            commit SHA (defaults to GITHUB_SHA)
#   GH_TOKEN            GitHub token with checks:read
#   WAIT_TIMEOUT_SECONDS  default 2400
#   WAIT_IGNORE_PATTERN   regex of check names to ignore
set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
SHA="${WAIT_SHA:-${GITHUB_SHA:?WAIT_SHA or GITHUB_SHA is required}}"
TIMEOUT="${WAIT_TIMEOUT_SECONDS:-2400}"
IGNORE_PATTERN="${WAIT_IGNORE_PATTERN:-Deploy production|CI gate|SSH as sadcpf-nexus}"

command -v gh >/dev/null || { echo "gh CLI is required" >&2; exit 1; }

deadline=$((SECONDS + TIMEOUT))
seen=0

echo "Waiting for CI check runs on ${REPO}@${SHA} (timeout ${TIMEOUT}s)"

while (( SECONDS < deadline )); do
  payload="$(gh api "repos/${REPO}/commits/${SHA}/check-runs?per_page=100")"
  pending="$(printf '%s' "$payload" | jq --arg ign "$IGNORE_PATTERN" '
    [.check_runs[]
      | select(.name | test($ign) | not)
      | select(.status != "completed")] | length')"
  failed="$(printf '%s' "$payload" | jq --arg ign "$IGNORE_PATTERN" '
    [.check_runs[]
      | select(.name | test($ign) | not)
      | select(.conclusion == "failure" or .conclusion == "cancelled"
          or .conclusion == "timed_out" or .conclusion == "startup_failure")] | length')"
  total="$(printf '%s' "$payload" | jq --arg ign "$IGNORE_PATTERN" '
    [.check_runs[] | select(.name | test($ign) | not)] | length')"

  printf '%s' "$payload" | jq -r --arg ign "$IGNORE_PATTERN" '
    .check_runs[]
    | select(.name | test($ign) | not)
    | "  \(.name): \(.status) \(.conclusion // "-")"'

  if [ "$failed" -gt 0 ]; then
    echo "CI gate failed: ${failed} check(s) did not succeed."
    exit 1
  fi
  if [ "$total" -gt 0 ]; then
    seen=1
  fi
  if [ "$seen" -eq 1 ] && [ "$pending" -eq 0 ]; then
    echo "CI gate passed (${total} check run(s))."
    exit 0
  fi
  sleep 20
done

echo "Timed out waiting for CI checks on ${SHA}" >&2
exit 1
