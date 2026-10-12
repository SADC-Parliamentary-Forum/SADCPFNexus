#!/usr/bin/env node
// PreToolUse guardrail: deny agent writes to real dotenv secret files
// (.env, api/.env, .env.production, ...). Template/test env files that are
// checked in (.env.example, .env.docker.example, .env.testing) stay editable.
'use strict';

const path = require('path');

const ALLOWED = /\.(example|sample|template|testing)$/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    process.exit(0); // unparseable payload: don't block unrelated work
  }

  const filePath = input?.tool_input?.file_path || input?.tool_input?.notebook_path || '';
  const base = path.basename(String(filePath).replace(/\\/g, '/'));

  if (!/^\.env(\..+)?$/i.test(base) || ALLOWED.test(base)) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Blocked write to secret env file "${filePath}". Edit .env.example / .env.docker.example instead, ` +
        'or ask the user to change the real .env themselves.',
    },
  }));
  process.exit(0);
});
