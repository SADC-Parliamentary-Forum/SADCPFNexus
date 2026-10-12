#!/usr/bin/env node
// Stop hook: when a session ends, warn (never block) if uncommitted changes add lines that look like secrets.
// Reads `git diff HEAD` added lines only; prints a systemMessage when something matches.
const { execFileSync } = require("node:child_process");

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bgh[pousr]_[0-9A-Za-z]{36,}\b/, "GitHub token"],
  [/\bsk-(?:ant-)?[0-9A-Za-z_-]{24,}\b/, "API secret key"],
  [/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s${}]{12,}["']/i, "hardcoded credential"],
];

function git(args) {
  return execFileSync("git", args, {
    cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

try {
  const diff = git(["diff", "HEAD", "--unified=0", "--no-color"]);
  const hits = [];
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) hits.push(`${file}: ${label}`);
    }
  }
  const staged = git(["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  for (const name of staged) {
    if (/(^|\/)\.env(\.(?!example$|sample$|template$|testing$)[^/]+)?$/.test(name)) hits.push(`${name}: env file staged`);
  }
  if (hits.length) {
    const unique = [...new Set(hits)].slice(0, 10);
    process.stdout.write(
      JSON.stringify({
        systemMessage: `Possible secrets in uncommitted changes — review before committing:\n- ${unique.join("\n- ")}`,
      }),
    );
  }
} catch {
  // Not a git repo or git unavailable: nothing to check.
}
process.exit(0);
