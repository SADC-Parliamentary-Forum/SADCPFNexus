import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(process.cwd());

function readPage(rel: string): string {
  return readFileSync(join(webRoot, rel), "utf8");
}

test("supplier profile loads categories from the portal, not the staff catalogue", () => {
  const source = readPage("app/(app)/supplier/profile/page.tsx");

  assert.match(source, /supplierPortalApi\.categories/);
  assert.doesNotMatch(source, /supplierCategoriesApi\.list\s*\(/);
  assert.match(source, /apiErrorMessage/);
  assert.doesNotMatch(source, /profileQuery\.isError \|\| categoriesQuery\.isError/);
});

test("header unread-count polling does not retry forbidden responses", () => {
  const source = readPage("components/layout/Header.tsx");

  assert.match(source, /unreadCount/);
  assert.match(source, /status === 403/);
});

test("supplier portal permission does not unlock the staff alerts page", () => {
  const access = readPage("lib/authAccess.ts");
  const notificationsLine = access.split("\n").find((line) => line.includes('path: "/notifications"'));
  assert.ok(notificationsLine);
  assert.doesNotMatch(notificationsLine, /supplier\.portal/);
});

test("supplier profile email banner only shows when verification is explicitly false", () => {
  const source = readPage("app/(app)/supplier/profile/page.tsx");

  assert.match(source, /emailVerified=\{profileQuery\.data\.email_verified === true\}/);
  assert.match(source, /emailVerified === false/);
  assert.doesNotMatch(source, /!completenessQuery\.data\?\.completeness\.email_verified/);
});

test("supplier verify-email success invalidates portal completeness caches", () => {
  const source = readPage("app/(auth)/supplier/verify-email/page.tsx");

  assert.match(source, /useQueryClient/);
  assert.match(source, /invalidateQueries\(\{\s*queryKey:\s*\["supplier-profile"\]\s*\}\)/);
  assert.match(source, /invalidateQueries\(\{\s*queryKey:\s*\["supplier-completeness"\]\s*\}\)/);
  assert.match(source, /invalidateQueries\(\{\s*queryKey:\s*\["supplier-dashboard"\]\s*\}\)/);
});

test("supplier documents has its own portal page and menu", () => {
  const sidebar = readPage("components/layout/Sidebar.tsx");
  const profile = readPage("app/(app)/supplier/profile/page.tsx");
  const documents = readPage("app/(app)/supplier/documents/page.tsx");

  assert.match(sidebar, /href:\s*"\/supplier\/documents"/);
  const manifest = readFileSync(join(webRoot, "../api/app/Modules/AccessControl/Services/NavigationManifestService.php"), "utf8");
  assert.match(manifest, /\/supplier\/documents/);
  assert.doesNotMatch(profile, /SupplierDocumentsField/);
  assert.match(profile, /\/supplier\/documents/);
  assert.match(documents, /supplierPortalApi\.documents/);
  assert.match(documents, /supplierPortalApi\.uploadDocument/);
  assert.match(documents, /data-testid="supplier-documents-table"/);
  assert.match(documents, /useI18n/);
  assert.match(documents, /row\.document\?\.remarks/);
});
