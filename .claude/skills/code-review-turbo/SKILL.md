---
name: code-review-turbo
description: Use when running or interpreting the Code Review Turbo workflow: a triple-agent PR review using Cursor Bugbot, Claude, and Codex with cross-referenced validation before merge.
metadata:
  short-description: Triple-agent PR review policy
---

# Code Review Turbo

Use the `/code-review-turbo` Claude command for the executable workflow. This skill defines the review policy and interpretation rules for that command.

Code Review Turbo is a triple-agent PR review:

- Cursor Bugbot supplies external PR findings.
- A Claude sub-agent reviews the same PR prompt independently.
- Codex reviews the exact same prompt independently.
- The parent agent cross-references all findings and validates them against source and test evidence before issuing a verdict.

## Core Rules

- Keep the three reviewers independent. Do not inspect source code or run validation commands before Bugbot, Claude, and Codex have returned.
- Use the exact same `REVIEW_PROMPT` for Claude and Codex.
- Compile and deduplicate findings before deciding whether any finding is real.
- Validate each compiled issue against source, tests, and runtime/database evidence where relevant.
- Do not dismiss a finding only because one reviewer found it. A single-agent finding can still be the most important bug.
- Put false positives under `Dismissed Findings` with a brief reason.

## Review Priorities

Review in this order:

1. Functional bugs
2. KISS violations
3. DRY violations
4. Missing tests
5. Performance issues
6. Accessibility issues

Ignore formatting, minor TypeScript nits, and style issues that automated tooling already covers.

## Final Verdict

End every review with a `Verdict` section containing exactly one of:

- `ready to merge`: no confirmed blocking issues remain.
- `merge after fixes`: bounded confirmed issues should be fixed before merge.
- `needs significant rework`: major correctness, architecture, security, testability, or release-readiness problems require substantial rework.
