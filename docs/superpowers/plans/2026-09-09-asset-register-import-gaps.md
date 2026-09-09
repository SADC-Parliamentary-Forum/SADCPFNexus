# Asset Register Import Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close remaining mandate gaps on the existing Laravel + Next.js Assets import pipeline (matcher cascade, production commit gate, OpenSpout for XLSX, SoftDeletes, disposal movements, FF-0208 location recovery assertion) without rebuilding the module or mixing in procurement PR #29.

**Architecture:** Extend `api/app/Modules/Assets/` in place. Matching is a dedicated `AssetExistingMatcher` used by `AssetImportService::reconcile` after description parse. Commit auto-approve is environment-gated. SpreadsheetGrid routes BIFF `.xls` to PhpSpreadsheet and ZIP/XLSX to OpenSpout. Disposal writes append-only movements and never soft-deletes.

**Tech Stack:** Laravel 12 / PHP 8.4, Next.js App Router, PhpSpreadsheet (BIFF), OpenSpout 5 (XLSX), PHPUnit, Playwright.

---

## Assumptions

- Delivery is this PR off `main` on `cursor/asset-register-import-5deb`. Do not use `cursor/asset-register-import-3ed7` (already merged) or procurement `cursor/procurement-automation-3ed7`.
- The import pipeline, parsers, QR opaque tokens, labels, verification, fixtures, and 323-tag identity equation already exist on `main`. Do not rebuild them.
- Production COMMIT stays admin-gated. Tests (`APP_ENV=testing`) and demo/local, plus artisan `--commit` outside PHPUnit, may auto-approve non-blocking rows.
- Existing SADC PF tags remain the business identifier. Do not call `generateTag()` / invent `SADCPF-*` for this population.
- Keep bigint `assets.id`. UUID stays a separate column.
- Owner is always SADC Parliamentary Forum. Initials are never auto-linked to users.
- Do not call `Asset::computeDepreciatedValue` during import/commit.
- Missing serial/make/model → null + DQ flags. Never invent `N/A` / `UNKNOWN`.
- Do not change `package-lock.json` for inherited npm audit noise.
- PHP may be unavailable in this cloud VM; write tests anyway. Do not claim PHPUnit passed without evidence.

## Out of scope

- Recalculating official GL depreciation
- Auto-linking initials to users
- Production data commit
- Mixing this work into PR #29
- Rebuilding import UI, QR, labels, or verification from scratch

## Files

- Create: `api/app/Modules/Assets/Import/AssetExistingMatcher.php`
- Create: `api/tests/Unit/Assets/SpreadsheetGridTest.php`
- Modify: `api/app/Modules/Assets/Services/AssetImportService.php`
- Modify: `api/app/Modules/Assets/Services/AssetImportCommitService.php`
- Modify: `api/app/Modules/Assets/Import/SpreadsheetGrid.php`
- Modify: `api/app/Models/Asset.php`
- Modify: `api/app/Modules/Assets/Services/AssetDisposalService.php`
- Modify: `api/tests/Feature/Assets/AssetRegisterImportTest.php`
- Modify: `api/tests/Feature/Assets/FixedAssetPhase1Test.php`
- Modify: `web/app/(app)/assets/import/page.tsx`
- Modify: `web/tests/e2e/assets-import.spec.ts`

---

### Task 1: Matcher cascade

**Files:**
- Create: `api/app/Modules/Assets/Import/AssetExistingMatcher.php`
- Modify: `api/app/Modules/Assets/Services/AssetImportService.php` (`reconcile`)
- Test: `api/tests/Feature/Assets/AssetRegisterImportTest.php`

Matching order (never fuzzy-merge on similar description):

1. `tag_number` or `asset_code`
2. Unique `serial_number` in the tenant (skip blank / non-unique)
3. Prior-batch `asset_import_raw.row_fingerprint` → lineage → existing asset (exclude current batch)
4. Exact `legacy_description` + `legacy_location` + `purchase_date`/`acquisition_date` with count === 1; all three required

Parse description **before** matching so extracted serials can hit step 2.

- [ ] **Step 1: Write the failing tests**

Add to `AssetRegisterImportTest.php`:

```php
public function test_matcher_cascade_tag_serial_description_never_fuzzy(): void
{
    $tenant = Tenant::factory()->create();
    $this->asAdmin($tenant);
    $matcher = app(\App\Modules\Assets\Import\AssetExistingMatcher::class);

    $byTag = Asset::create([
        'tenant_id' => $tenant->id,
        'asset_code' => 'CE-8101',
        'tag_number' => 'CE-8101',
        'name' => 'Tagged laptop',
        'category' => 'it',
        'status' => 'active',
        'serial_number' => 'SN-OTHER',
    ]);
    $this->assertSame($byTag->id, $matcher->match($tenant->id, 'CE-8101', 'SN-IGNORED', [], [], 0)?->id);

    $bySerial = Asset::create([
        'tenant_id' => $tenant->id,
        'asset_code' => 'CE-8102',
        'tag_number' => 'CE-8102',
        'name' => 'Serial laptop',
        'category' => 'it',
        'status' => 'active',
        'serial_number' => 'SN-UNIQUE-8102',
    ]);
    $this->assertSame($bySerial->id, $matcher->match($tenant->id, 'CE-9999', 'SN-UNIQUE-8102', [], [], 0)?->id);

    $byDesc = Asset::create([
        'tenant_id' => $tenant->id,
        'asset_code' => 'FF-8103',
        'tag_number' => 'FF-8103',
        'name' => 'Oak desk',
        'category' => 'furniture',
        'status' => 'active',
        'legacy_description' => 'Oak desk',
        'legacy_location' => 'Office 9',
        'purchase_date' => '2019-01-15',
    ]);
    $this->assertSame($byDesc->id, $matcher->match($tenant->id, 'FF-0000', null, [
        'legacy_description' => 'Oak desk',
        'legacy_location' => 'Office 9',
        'acquisition_date' => '2019-01-15',
    ], [], 0)?->id);

    $this->assertNull($matcher->match($tenant->id, 'FF-0001', null, [
        'legacy_description' => 'Oak desk extra drawer',
        'legacy_location' => 'Office 9',
        'acquisition_date' => '2019-01-15',
    ], [], 0));
}

public function test_template_import_matches_existing_unique_serial(): void
{
    $tenant = Tenant::factory()->create();
    [$http] = $this->asAdmin($tenant);
    Asset::create([
        'tenant_id' => $tenant->id,
        'asset_code' => 'SADCPF-OLD',
        'tag_number' => 'SADCPF-OLD',
        'name' => 'Existing laptop',
        'category' => 'it',
        'status' => 'active',
        'serial_number' => 'SN-MATCH-1',
    ]);
    $path = sys_get_temp_dir().'/template-serial-'.uniqid().'.xlsx';
    $sheet = new Spreadsheet;
    $sheet->getActiveSheet()->fromArray([
        ['asset_tag', 'asset_name', 'serial_number'],
        ['CE-4401', 'Imported laptop', 'SN-MATCH-1'],
    ]);
    (new Xlsx($sheet))->save($path);
    $res = $http->post('/api/v1/assets/import', [
        'mode' => 'template',
        'template' => $this->uploaded($path, 'template.xlsx'),
    ]);
    $res->assertCreated();
    unlink($path);
    $row = \App\Models\AssetImportStaging::query()
        ->where('import_batch_id', $res->json('data.batch.id'))
        ->where('asset_tag', 'CE-4401')
        ->first();
    $this->assertNotNull($row->matched_asset_id);
    $this->assertSame('UPDATE', $row->proposed_action);
}
```

- [ ] **Step 2: Implement `AssetExistingMatcher` and wire `reconcile`**

Parse description first, then `$this->matcher->match(...)`.

- [ ] **Step 3: Commit**

```bash
git add api/app/Modules/Assets/Import/AssetExistingMatcher.php api/app/Modules/Assets/Services/AssetImportService.php api/tests/Feature/Assets/AssetRegisterImportTest.php
git commit -m "feat(assets): match existing register rows by tag, serial, fingerprint, then exact description"
```

---

### Task 2: Production commit gate

**Files:**
- Modify: `api/app/Modules/Assets/Services/AssetImportService.php` (`preview`, `autoApproveAllowed`)
- Modify: `api/app/Modules/Assets/Services/AssetImportCommitService.php`
- Modify: `web/app/(app)/assets/import/page.tsx`
- Modify: `web/tests/e2e/assets-import.spec.ts`
- Test: `api/tests/Feature/Assets/AssetRegisterImportTest.php`

Rules:

- `autoApproveAllowed`: true when `app()->environment(['local','testing','demo'])` OR (`runningInConsole()` and not `runningUnitTests()`).
- Production HTTP: ignore `approve_non_blocking`. `assets.import` can still commit already-approved rows.
- UI sends `approve_non_blocking: Boolean(payload.auto_approve_allowed)`.
- Playwright clicks **Approve non-blocking** before **Commit to register** so the flow works when auto-approve is off.

- [ ] **Step 1: Write production test**

```php
public function test_production_commit_ignores_auto_approve(): void
{
    $tenant = Tenant::factory()->create();
    $user = $this->makeUser('staff', $tenant);
    $user->givePermissionTo('assets.import');
    $http = $this->asUser($user);

    $path = sys_get_temp_dir().'/template-prod-'.uniqid().'.xlsx';
    $sheet = new Spreadsheet;
    $sheet->getActiveSheet()->fromArray([
        ['asset_tag', 'asset_name'],
        ['CE-5501', 'Prod gate laptop'],
    ]);
    (new Xlsx($sheet))->save($path);
    $res = $http->post('/api/v1/assets/import', [
        'mode' => 'template',
        'template' => $this->uploaded($path, 'template.xlsx'),
    ]);
    $res->assertCreated();
    $this->assertFalse((bool) $res->json('data.auto_approve_allowed') || app()->environment('production'));
    unlink($path);
    $batchId = $res->json('data.batch.id');

    $this->app['env'] = 'production';
    $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true])
        ->assertStatus(422);
    $this->assertDatabaseHas('asset_import_staging', [
        'import_batch_id' => $batchId,
        'asset_tag' => 'CE-5501',
        'review_status' => 'pending',
    ]);
}
```

After ingest, `auto_approve_allowed` is true in testing. The test must set `env` to production **before** commit, and assert preview in production is false:

```php
$this->app['env'] = 'production';
$preview = $http->getJson("/api/v1/assets/import/{$batchId}");
$preview->assertOk();
$this->assertFalse((bool) $preview->json('data.auto_approve_allowed'));
```

- [ ] **Step 2: Implement gate + UI**
- [ ] **Step 3: Commit**

```bash
git commit -m "fix(assets): ignore commit-time auto-approve in production HTTP"
```

---

### Task 3: OpenSpout for XLSX

**Files:**
- Modify: `api/app/Modules/Assets/Import/SpreadsheetGrid.php`
- Test: `api/tests/Unit/Assets/SpreadsheetGridTest.php`

- PhpSpreadsheet for BIFF `.xls` (extension `.xls`/`.xlt` or non-ZIP magic).
- OpenSpout for ZIP/`PK` magic and `.xlsx`/`.xlsm` (covers upload temp paths with no extension).
- DateTimeInterface cells → `Y-m-d`.

- [ ] **Step 1: Write SpreadsheetGridTest** (real fixture staging XLSX + tiny generated XLSX)
- [ ] **Step 2: Implement routing in SpreadsheetGrid**
- [ ] **Step 3: Commit**

```bash
git commit -m "fix(assets): read XLSX import workbooks with OpenSpout"
```

---

### Task 4: SoftDeletes, disposal movement, FF-0208

**Files:**
- Modify: `api/app/Models/Asset.php` (add `SoftDeletes`; do not add `deleted_at` to fillable)
- Modify: `api/app/Modules/Assets/Services/AssetDisposalService.php` — `recordMovement` **before** clearing `assigned_to`; `write_off` vs `dispose`; `save()` status, never `delete()`
- Modify: `api/tests/Feature/Assets/FixedAssetPhase1Test.php`
- Modify: `api/tests/Feature/Assets/AssetRegisterImportTest.php` — FF-0208 `legacy_location` not empty after legacy ingest

- [ ] **Step 1: Extend disposal test**

```php
$this->assertNull($asset->fresh()->deleted_at);
$this->assertDatabaseHas('asset_movements', [
    'asset_id' => $asset->id,
    'movement_type' => 'dispose',
]);
```

- [ ] **Step 2: Implement SoftDeletes + movement + FF-0208 assertion**
- [ ] **Step 3: Commit**

```bash
git commit -m "fix(assets): keep disposed rows, record disposal movements, assert FF-0208 location"
```

---

### Task 5: Verification and PR

- [ ] Run PHPUnit if PHP is available: `cd api && php artisan test --filter=AssetRegisterImportTest --filter=FixedAssetPhase1Test --filter=SpreadsheetGridTest --filter=CrystalAssetListingParserTest`
- [ ] Do not claim API tests passed without command output
- [ ] Push `cursor/asset-register-import-5deb` and open PR vs `main`

**Success criteria**

- Empty register + fixtures still yields 323 unique tags, FF-0172 present, FF-0208 location recovered from Crystal, CE-0092 financials from Crystal, AS-0001 stays `active` / `held_for_sale`.
- Matcher does not merge on similar description.
- Production HTTP commit with only `assets.import` and `approve_non_blocking: true` does not auto-approve.
- QR still encodes `/a/{token}` only.
