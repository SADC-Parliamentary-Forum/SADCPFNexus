import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

test("admin email page labels SMTP and both designated IMAP mailboxes", () => {
  const source = readFileSync(join(webRoot, "app/(app)/admin/email/page.tsx"), "utf8");

  assert.match(source, /settingsApi\.email\(/);
  assert.match(source, /settingsApi\.updateEmail\(/);
  assert.match(source, /Outgoing SMTP/);
  assert.match(source, /Incoming — correspondence registry/);
  assert.match(source, /Incoming — procurement invoices/);
  assert.match(source, /<label htmlFor="smtp-host"/);
  assert.match(source, /<label htmlFor="smtp-password"/);
  assert.match(source, /htmlFor=\{\`\$\{idPrefix\}-host\`\}/);
  assert.match(source, /Leave blank to keep the saved password/);
  assert.match(source, /href="\/correspondence\/mailbox"/);
  assert.match(source, /href="\/procurement\/inbox"/);
  assert.doesNotMatch(source, /FormField/);
});
