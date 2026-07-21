---
name: code-review-turbo
description: Run a triple-agent code review on the current branch's PR. Waits for Cursor Bugbot, runs a Claude sub-agent and Codex in parallel, then cross-references all findings to filter out hallucinations. Use when you want a thorough, multi-perspective code review before merging.
metadata:
  short-description: Triple-agent PR review with Bugbot, Claude, and Codex
  disable-model-invocation: true
  argument-hint: "[pr-number]"
allowed-tools: Bash(gh:*), Bash(codex:*), Bash(cat:*), Bash(tee:*), Bash(sleep:*), Agent, Read, Grep, Glob, Write(/tmp/*)
---

# Code Review Turbo

Triple-agent code review: Cursor Bugbot + Claude sub-agent + Codex, with cross-referencing to separate real bugs from hallucinations.

## Step 1: Ensure PR Exists and Trigger Bugbot

Determine the PR number. If `$ARGUMENTS` is provided, use that as the PR number. Otherwise, try to detect it from the current branch:

```bash
gh pr view --json number,isDraft -q '{number: .number, isDraft: .isDraft}'
```

### If no PR exists

Create a draft PR for the current branch and comment to trigger Bugbot:

```bash
gh pr create --draft --fill
gh pr comment <number> --body "@cursor review"
```

Tell the user you created a draft PR and triggered Bugbot.

### If the PR exists and is a draft

Check whether a `@cursor review` or `@bugbot review` trigger comment already exists:

```bash
gh pr view <number> --json comments --jq '.comments[].body'
```

If no trigger comment is found, add one:

```bash
gh pr comment <number> --body "@cursor review"
```

### If the PR exists and is not a draft

Bugbot runs automatically on non-draft PRs, so no trigger comment is needed unless the review is stale.

### Check for stale Bugbot review

Bugbot posts one comment per issue it finds, and resolves individual comments when the issue is fixed. "Bugbot has reviewed" means there are Bugbot comments on the PR, and "stale" means commits were pushed after Bugbot's review pass.

To detect staleness:

1. Get the timestamps of all Bugbot comments. It may post multiple comments, one per issue:

```bash
gh pr view <number> --json comments --jq '[.comments[] | select(.author.login | test("bugbot|cursor"; "i")) | .createdAt]'
```

2. Also check review comments inline on the diff:

```bash
gh api repos/{owner}/{repo}/pulls/<number>/comments --jq '[.[] | select(.user.login | test("bugbot|cursor"; "i")) | .created_at]'
```

3. Get the timestamp of the most recent commit on the PR:

```bash
gh pr view <number> --json commits --jq '.commits | last | .committedDate'
```

4. Treat Bugbot as current only when Bugbot/Cursor comments exist and the newest Bugbot/Cursor comment is newer than or equal to the latest PR commit.

If the latest commit is newer than all Bugbot/Cursor comments, or if Bugbot/Cursor has never commented, the review is stale. Post a new trigger comment:

```bash
gh pr comment <number> --body "@cursor review"
```

Tell the user: "Bugbot's review is stale (commits landed after its last review). Triggered a fresh review."

### Poll for Bugbot's review

If you triggered a fresh review due to staleness, a draft PR, or a new PR, poll for Bugbot comments to appear. Run individual commands. Do not write a bash loop.

1. Run:

```bash
gh pr view <number> --json comments --jq '[.comments[] | select(.author.login | test("bugbot|cursor"; "i"))]'
```

2. If empty, run:

```bash
sleep 30
```

3. Repeat up to 30 times, for 15 minutes total.

If Bugbot never shows up, warn the user and ask whether to proceed anyway or keep waiting.

### Collect Bugbot's findings

Bugbot posts inline review comments, one per issue, and resolves individual comments when the issue is fixed. Use the GraphQL API to check resolution status, because the REST API does not expose it.

First, get the repo owner and name:

```bash
gh repo view --json owner,name --jq '.owner.login + "/" + .name'
```

Then fetch all review threads with their resolution status and filter to Bugbot/Cursor comments:

```bash
gh api graphql -f query='
  query {
    repository(owner: "<OWNER>", name: "<REPO>") {
      pullRequest(number: <NUMBER>) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            comments(first: 10) {
              nodes {
                author { login }
                body
                path
                line
              }
            }
          }
        }
      }
    }
  }
'
```

From the result, keep only threads where:

1. `isResolved` is `false`
2. At least one comment has an `author.login` matching `bugbot` or `cursor` case-insensitively

Ignore all resolved threads. These are issues Bugbot already confirmed as fixed.

Also check top-level PR comments. These are rare for Bugbot but possible:

```bash
gh pr view <number> --json comments --jq '[.comments[] | select(.author.login | test("bugbot|cursor"; "i")) | select(.isMinimized | not)]'
```

Save all active non-resolved Bugbot findings for later comparison.

## Step 2: Build the Review Prompt

Gather the PR context by running these commands:

```bash
gh pr diff <number>
gh pr view <number> --json title,body,baseRefName,headRefName
```

Then construct the following review prompt, referred to as `REVIEW_PROMPT` below. This exact prompt must be used for both the Claude sub-agent and Codex. Do not alter it between the two.

---

START OF REVIEW_PROMPT

You are reviewing a pull request. Here is the diff:

PR title:

PR description:

Base branch:

Head branch:

Review this PR thoroughly. Focus on these categories IN ORDER OF IMPORTANCE:

### 1. Functional Bugs (MOST IMPORTANT)

Look for logic errors, off-by-one errors, null/undefined issues, race conditions, incorrect conditionals, missing edge cases, wrong variable usage, broken control flow, and any code that simply won't work as intended. This is BY FAR the most important category.

### 2. KISS Violations

Overly complex solutions where simpler ones exist. Unnecessary abstractions, premature generalizations, or convoluted logic.

### 3. DRY Violations

Duplicated logic that should be extracted. Copy-pasted code with minor variations.

### 4. Missing Tests

New functionality or bug fixes lacking appropriate test coverage.

### 5. Performance Issues

- For SQL queries: DO NOT GUESS what the query planner will do. Instead, run `EXPLAIN ANALYZE` on the actual local database to verify.
- For migrations: Will they lock tables for too long? Are they safe for large tables?
- For application code: N+1 queries, unnecessary allocations, missing batching, O(n^2) loops on large datasets.

### 6. Accessibility Issues

For any TSX/JSX files: missing aria labels, improper heading hierarchy, missing alt text, keyboard navigation issues, color contrast concerns.

DO NOT report:

- Code formatting or style issues. These are linted automatically.
- Minor TypeScript type issues. These are also linted.
- Nitpicks that don't affect correctness or maintainability.

For each issue found, report:

- File and line number from the diff
- Severity: critical / high / medium / low
- Category: which of the above categories
- Description: what the issue is and why it matters
- Suggestion: how to fix it

Return a structured list grouped by severity: critical first, then high, medium, low.

END OF REVIEW_PROMPT

---

When constructing the actual prompt, insert the PR diff after "Here is the diff:" and fill in PR title, PR description, base branch, and head branch from the `gh pr view` output.

## Step 3: Run Claude Sub-Agent and Codex in Parallel

Launch both of these at the same time, in parallel.

### 3a. Claude Sub-Agent

Use the Agent tool to spawn a sub-agent with the full `REVIEW_PROMPT`. This agent should have access to Bash, Read, Grep, and Glob tools so it can run EXPLAIN queries and inspect code.

The Claude sub-agent must return structured findings grouped by severity with file/line, category, description, and suggestion.

### 3b. Codex

Run the exact same `REVIEW_PROMPT` through Codex. First write the prompt to a randomly named temp file using the Write tool. Generate a unique random 8-character suffix to avoid collisions with concurrent agents:

```text
/tmp/review-prompt-<random-8-chars>.txt
```

Then pipe it via stdin and capture visible output with `tee`:

```bash
codex exec --full-auto - < /tmp/review-prompt-<random>.txt | tee /tmp/code-review-turbo-codex-<random>.txt
```

The `--full-auto` flag prevents Codex from prompting for approval on shell commands, such as EXPLAIN queries. The `-` tells Codex to read the prompt from stdin. Use the saved Codex output file during cross-reference.

## Step 4: Cross-Reference and Validate

CRITICAL: Do not do any of your own code research, file reading, or EXPLAIN queries until all three agents, Bugbot, Claude sub-agent, and Codex, have returned their results. If you investigate the code first, you will form your own opinions and become a fourth reviewer with a veto over the other three, biased toward confirming your own findings and dismissing theirs. The point of this step is to be an objective judge of three independent reviewers.

### Step 4a: Compile findings first, with no research yet

Collect and deduplicate all findings from the three agents into a single list. For each unique issue, note which agent or agents reported it. Do not yet judge whether the issues are real. Just organize them.

### Step 4b: Now do your own research to validate

Only after compiling the full list, go through each finding and verify it:

- Read the actual source code around each reported issue, not just the diff.
- Run EXPLAIN ANALYZE on any flagged SQL queries against the local database.
- Check test files to see if flagged "missing tests" actually exist.
- Trace the logic for any reported functional bugs and verify the bug is real.

For each unique issue, determine:

- Is it a real issue confirmed by your investigation?
- Is it a hallucination because the code does not actually have this problem?
- Which agents found it and which missed it?

Be especially careful not to dismiss a finding just because only one agent reported it. Sometimes the lone dissenter found the most critical bug.

## Step 5: Final Report

Present the validated findings in this format:

### Critical Issues

Issues you confirmed are real and need fixing before merge.

### High Issues

Real issues that should be fixed.

### Medium Issues

Real but lower-risk issues.

### Low Issues

Minor improvements, optional.

### Dismissed Findings

Issues reported by agents that turned out to be hallucinations or false positives. Briefly explain why each was dismissed.

### Agent Agreement Summary

A table showing which agent found which real issue:

| Issue | Bugbot | Claude | Codex | Verdict |
| --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... |

### Verdict

End with exactly one clear merge recommendation:

- `ready to merge`
- `merge after fixes`
- `needs significant rework`
