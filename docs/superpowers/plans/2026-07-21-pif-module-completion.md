# PIF Module Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the PIF (Programme Implementation Form) gap identified against the PRD: add the missing form sections, a clean read-only M&E connection, batched procurement transfer, a full PDF export, a simplified declaration, honest M&E-link status reporting, hardened conditional validation, and a controlled amendment workflow for approved PIFs — backend and frontend.

**Architecture:** Extend the existing `Programme` model/`programmes` table with new flat columns per section; add two new child tables (`programme_documents`, `programme_arrival_departures`) mirroring the existing `ProgrammeBudgetLine`/`ProgrammeProcurementItem` pattern exactly; add a `hasOne` relationship to the existing `MeActivityReport` (no M&E data duplicated on `Programme`); extend `ProgrammeProcurementItem` with a procurement-request link; reuse the existing dompdf/QR infrastructure from `SaamService` for a PDF export; add a self-referential amendment/supersede lifecycle to `Programme`.

**Tech Stack:** Laravel 11 (PHP), PostgreSQL, Spatie Laravel-Permission, barryvdh/laravel-dompdf, endroid/qr-code, PHPUnit feature tests; Next.js/React/TypeScript frontend, Playwright e2e.

**Source spec:** `docs/superpowers/specs/2026-07-21-pif-missing-sections-design.md`

---

## Conventions used throughout this plan

- API tests run with `php artisan test tests/Feature/Programmes/<File>.php` (also runnable via `vendor/bin/phpunit`).
- Test helpers already exist in `tests/TestCase.php`: `$this->asStaff($tenant)` / `$this->asAdmin($tenant)` return `[$http, $user]`; `$this->makeUser('role-name', $tenant)` creates and role-assigns a user.
- All new migrations go in `api/database/migrations/`, timestamped sequentially starting at `2026_07_21_100000` (the latest existing migration is `2026_06_25_100001_add_prepared_by_to_workflowable_tables.php`).
- Follow the existing `ProgrammeBudgetLineController`/`ProgrammeBudgetLine` pattern exactly for new child resources: simple `HasFactory` model, thin controller that validates then delegates to `ProgrammeService`, routes via `Route::apiResource('{programme}/x', XController::class)->only(['store','update','destroy'])`.
- `AuditLog::record('event.name', ['auditable_type' => Programme::class, 'auditable_id' => $programme->id, 'new_values' => [...], 'tags' => 'programme'])` is the existing signature (verified in `ProgrammeService`, `SaamService`, `DelegationService`).

---

## Phase 1 — Schema and Models

### Task 1: Extend `programmes` table with new section columns

**Files:**
- Create: `api/database/migrations/2026_07_21_100000_add_pif_sections_to_programmes_table.php`
- Test: `api/tests/Feature/Programmes/ProgrammeSectionsTest.php`

- [ ] **Step 1: Write the failing test asserting the columns exist**

```php
<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProgrammeSectionsTest extends TestCase
{
    public function test_programmes_table_has_new_section_columns(): void
    {
        $expected = [
            // Venue
            'venue_country', 'venue_city', 'venue_proposed_hotel',
            'venue_accommodation_required', 'venue_accommodation_count',
            'venue_conferencing_required', 'venue_conferencing_participants',
            'venue_quotation_attached', 'venue_hotel_quotation_attached',
            'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
            // Budget / participant provisions
            'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
            'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
            'proposed_funding_difference', 'estimated_activity_amount',
            'budget_availability_status', 'finance_comments',
            // Consultants
            'secretariat_staff_required', 'secretariat_staff_count',
            'consultants_required', 'consultants_count', 'consultants_rate',
            'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
            'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
            'media_liaison_required', 'media_liaison_count',
            'local_support_required', 'local_support_count', 'local_support_rate',
            'personnel_comments',
            // Interpretation
            'interpretation_required',
            'en_fr_required', 'en_fr_interpreters_count',
            'en_pt_required', 'en_pt_interpreters_count',
            'fr_pt_required', 'fr_pt_interpreters_count',
            'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
            'interpretation_equipment_required', 'translation_required',
            'languages_required', 'interpretation_comments',
            // Support services
            'support_services', 'support_services_other_note',
            // Conflict of interest
            'conflict_declared', 'conflict_details', 'conflict_mitigation',
            'conflict_declared_by', 'conflict_declared_at',
            // Declaration
            'declaration_confirmed', 'declaration_confirmed_by',
            'declaration_confirmed_at', 'declaration_version',
            // Amendment tracking
            'amended_from_id', 'superseded_at',
        ];

        foreach ($expected as $column) {
            $this->assertTrue(
                Schema::hasColumn('programmes', $column),
                "programmes table is missing column: {$column}"
            );
        }
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: FAIL — every column assertion fails since the migration doesn't exist yet.

- [ ] **Step 3: Write the migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            // Section C — Venue
            $table->string('venue_country')->nullable();
            $table->string('venue_city')->nullable();
            $table->string('venue_proposed_hotel')->nullable();
            $table->boolean('venue_accommodation_required')->default(false);
            $table->integer('venue_accommodation_count')->nullable();
            $table->boolean('venue_conferencing_required')->default(false);
            $table->integer('venue_conferencing_participants')->nullable();
            $table->boolean('venue_quotation_attached')->default(false);
            $table->boolean('venue_hotel_quotation_attached')->default(false);
            $table->text('venue_accessibility_requirements')->nullable();
            $table->text('venue_security_considerations')->nullable();
            $table->text('venue_comments')->nullable();

            // Section D — Budget and Participant Provisions
            $table->decimal('proposed_dsa_rate', 10, 2)->nullable();
            $table->decimal('original_budget_rate', 10, 2)->nullable();
            $table->text('dsa_variance_reason')->nullable();
            $table->integer('proposed_participants')->nullable();
            $table->integer('budgeted_participants')->nullable();
            $table->text('participants_variance_reason')->nullable();
            $table->decimal('proposed_funding_difference', 15, 2)->nullable();
            $table->decimal('estimated_activity_amount', 15, 2)->nullable();
            $table->string('budget_availability_status')->default('not_checked');
            // not_checked|available|partially_available|unavailable|confirmed_with_conditions
            $table->text('finance_comments')->nullable();

            // Section E — Consultants and Support Personnel
            $table->boolean('secretariat_staff_required')->default(false);
            $table->integer('secretariat_staff_count')->nullable();
            $table->boolean('consultants_required')->default(false);
            $table->integer('consultants_count')->nullable();
            $table->decimal('consultants_rate', 10, 2)->nullable();
            $table->boolean('resource_persons_required')->default(false);
            $table->integer('resource_persons_count')->nullable();
            $table->decimal('resource_persons_rate', 10, 2)->nullable();
            $table->boolean('rapporteurs_required')->default(false);
            $table->integer('rapporteurs_count')->nullable();
            $table->decimal('rapporteurs_rate', 10, 2)->nullable();
            $table->boolean('media_liaison_required')->default(false);
            $table->integer('media_liaison_count')->nullable();
            $table->boolean('local_support_required')->default(false);
            $table->integer('local_support_count')->nullable();
            $table->decimal('local_support_rate', 10, 2)->nullable();
            $table->text('personnel_comments')->nullable();

            // Section F — Interpretation and Languages
            $table->boolean('interpretation_required')->default(false);
            $table->boolean('en_fr_required')->default(false);
            $table->integer('en_fr_interpreters_count')->nullable();
            $table->boolean('en_pt_required')->default(false);
            $table->integer('en_pt_interpreters_count')->nullable();
            $table->boolean('fr_pt_required')->default(false);
            $table->integer('fr_pt_interpreters_count')->nullable();
            $table->decimal('interpreter_rate', 10, 2)->nullable();
            $table->string('interpreter_source')->nullable(); // internal|supplier|partner|other
            $table->string('interpreter_source_other_note')->nullable();
            $table->boolean('interpretation_equipment_required')->default(false);
            $table->boolean('translation_required')->default(false);
            $table->text('languages_required')->nullable(); // JSON array
            $table->text('interpretation_comments')->nullable();

            // Section H — Support Services
            $table->text('support_services')->nullable(); // JSON array of keys
            $table->text('support_services_other_note')->nullable();

            // Section M — Conflict of Interest
            $table->boolean('conflict_declared')->default(false);
            $table->text('conflict_details')->nullable();
            $table->text('conflict_mitigation')->nullable();
            $table->foreignId('conflict_declared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('conflict_declared_at')->nullable();

            // Section N — Declaration (simplified, single confirmation)
            $table->boolean('declaration_confirmed')->default(false);
            $table->foreignId('declaration_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('declaration_confirmed_at')->nullable();
            $table->string('declaration_version')->nullable();

            // Amendment / supersede tracking
            $table->foreignId('amended_from_id')->nullable()->constrained('programmes')->nullOnDelete();
            $table->timestamp('superseded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('conflict_declared_by');
            $table->dropConstrainedForeignId('declaration_confirmed_by');
            $table->dropConstrainedForeignId('amended_from_id');
            $table->dropColumn([
                'venue_country', 'venue_city', 'venue_proposed_hotel',
                'venue_accommodation_required', 'venue_accommodation_count',
                'venue_conferencing_required', 'venue_conferencing_participants',
                'venue_quotation_attached', 'venue_hotel_quotation_attached',
                'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
                'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
                'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
                'proposed_funding_difference', 'estimated_activity_amount',
                'budget_availability_status', 'finance_comments',
                'secretariat_staff_required', 'secretariat_staff_count',
                'consultants_required', 'consultants_count', 'consultants_rate',
                'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
                'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
                'media_liaison_required', 'media_liaison_count',
                'local_support_required', 'local_support_count', 'local_support_rate',
                'personnel_comments',
                'interpretation_required',
                'en_fr_required', 'en_fr_interpreters_count',
                'en_pt_required', 'en_pt_interpreters_count',
                'fr_pt_required', 'fr_pt_interpreters_count',
                'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
                'interpretation_equipment_required', 'translation_required',
                'languages_required', 'interpretation_comments',
                'support_services', 'support_services_other_note',
                'conflict_declared', 'conflict_details', 'conflict_mitigation', 'conflict_declared_at',
                'declaration_confirmed', 'declaration_confirmed_at', 'declaration_version',
                'superseded_at',
            ]);
        });
    }
};
```

- [ ] **Step 4: Run the migration**

Run: `php artisan migrate`
Expected: `2026_07_21_100000_add_pif_sections_to_programmes_table` migrated successfully.

- [ ] **Step 5: Run the test to verify it passes**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/database/migrations/2026_07_21_100000_add_pif_sections_to_programmes_table.php api/tests/Feature/Programmes/ProgrammeSectionsTest.php
git commit -m "feat(pif): add venue, budget, personnel, interpretation, support-services, conflict-of-interest, declaration, and amendment columns to programmes"
```

---

### Task 2: Update `Programme` model — fillable, casts, relations

**Files:**
- Modify: `api/app/Models/Programme.php`
- Test: `api/tests/Feature/Programmes/ProgrammeSectionsTest.php` (extend)

- [ ] **Step 1: Add a failing test for mass-assignment and casting**

Add to `ProgrammeSectionsTest.php`:

```php
    public function test_programme_mass_assigns_and_casts_new_section_fields(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = \App\Models\Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Venue Test',
            'status'           => 'draft',
            'venue_country'                    => 'Namibia',
            'venue_accommodation_required'     => true,
            'venue_accommodation_count'        => 12,
            'support_services'                 => ['ground_transport', 'catering'],
            'languages_required'               => ['English', 'French'],
            'conflict_declared'                => false,
            'declaration_confirmed'            => false,
        ]);

        $this->assertTrue($programme->venue_accommodation_required);
        $this->assertSame(12, $programme->venue_accommodation_count);
        $this->assertIsArray($programme->support_services);
        $this->assertSame(['ground_transport', 'catering'], $programme->support_services);
        $this->assertIsArray($programme->languages_required);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: FAIL — `support_services`/`languages_required` won't cast to array yet (not in `$fillable`, so mass-assignment silently drops them, or `MassAssignmentException` in strict mode).

- [ ] **Step 3: Update `Programme.php`**

Add to `$fillable` (append to the existing array in `api/app/Models/Programme.php:13-26`):

```php
        // Venue
        'venue_country', 'venue_city', 'venue_proposed_hotel',
        'venue_accommodation_required', 'venue_accommodation_count',
        'venue_conferencing_required', 'venue_conferencing_participants',
        'venue_quotation_attached', 'venue_hotel_quotation_attached',
        'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
        // Budget / participant provisions
        'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
        'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
        'proposed_funding_difference', 'estimated_activity_amount',
        // budget_availability_status and finance_comments are intentionally NOT
        // fillable here — they are only writable via ProgrammeController::updateFinanceReview()
        // Consultants
        'secretariat_staff_required', 'secretariat_staff_count',
        'consultants_required', 'consultants_count', 'consultants_rate',
        'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
        'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
        'media_liaison_required', 'media_liaison_count',
        'local_support_required', 'local_support_count', 'local_support_rate',
        'personnel_comments',
        // Interpretation
        'interpretation_required',
        'en_fr_required', 'en_fr_interpreters_count',
        'en_pt_required', 'en_pt_interpreters_count',
        'fr_pt_required', 'fr_pt_interpreters_count',
        'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
        'interpretation_equipment_required', 'translation_required',
        'languages_required', 'interpretation_comments',
        // Support services
        'support_services', 'support_services_other_note',
        // Conflict of interest (conflict_declared_by/at are set server-side only, still fillable
        // internally via ->update() calls made from the service, just excluded from controller validation)
        'conflict_declared', 'conflict_details', 'conflict_mitigation',
        'conflict_declared_by', 'conflict_declared_at',
        // Declaration
        'declaration_confirmed', 'declaration_confirmed_by',
        'declaration_confirmed_at', 'declaration_version',
        // Amendment tracking
        'amended_from_id', 'superseded_at',
        'budget_availability_status', 'finance_comments',
```

Add to `$casts` (append to the existing array in `api/app/Models/Programme.php:28-50`):

```php
        'venue_accommodation_required'  => 'boolean',
        'venue_conferencing_required'   => 'boolean',
        'venue_quotation_attached'      => 'boolean',
        'venue_hotel_quotation_attached'=> 'boolean',
        'proposed_dsa_rate'             => 'decimal:2',
        'original_budget_rate'          => 'decimal:2',
        'proposed_funding_difference'   => 'decimal:2',
        'estimated_activity_amount'     => 'decimal:2',
        'secretariat_staff_required'    => 'boolean',
        'consultants_required'          => 'boolean',
        'consultants_rate'              => 'decimal:2',
        'resource_persons_required'     => 'boolean',
        'resource_persons_rate'         => 'decimal:2',
        'rapporteurs_required'          => 'boolean',
        'rapporteurs_rate'              => 'decimal:2',
        'media_liaison_required'        => 'boolean',
        'local_support_required'        => 'boolean',
        'local_support_rate'            => 'decimal:2',
        'interpretation_required'       => 'boolean',
        'en_fr_required'                => 'boolean',
        'en_pt_required'                => 'boolean',
        'fr_pt_required'                => 'boolean',
        'interpreter_rate'              => 'decimal:2',
        'interpretation_equipment_required' => 'boolean',
        'translation_required'          => 'boolean',
        'languages_required'            => 'array',
        'support_services'              => 'array',
        'conflict_declared'             => 'boolean',
        'conflict_declared_at'          => 'datetime',
        'declaration_confirmed'         => 'boolean',
        'declaration_confirmed_at'      => 'datetime',
        'superseded_at'                 => 'datetime',
```

Add relations and the M&E status accessor (append to `Programme.php`, after the existing `attachments()` method, before `isDraft()`):

```php
    public function conflictDeclaredBy()
    {
        return $this->belongsTo(User::class, 'conflict_declared_by');
    }

    public function declarationConfirmedBy()
    {
        return $this->belongsTo(User::class, 'declaration_confirmed_by');
    }

    public function documents()
    {
        return $this->hasMany(ProgrammeDocument::class);
    }

    public function arrivalDepartures()
    {
        return $this->hasMany(ProgrammeArrivalDeparture::class);
    }

    public function meActivityReport()
    {
        return $this->hasOne(MeActivityReport::class, 'programme_id');
    }

    public function amendedFrom()
    {
        return $this->belongsTo(Programme::class, 'amended_from_id');
    }

    public function amendments()
    {
        return $this->hasMany(Programme::class, 'amended_from_id');
    }

    public function getMeStatusAttribute(): string
    {
        $report = $this->meActivityReport;

        if ($report) {
            if ($report->closure_status === 'closed' || $report->review_status === MeActivityReport::STATUS_CLOSED) {
                return 'closed';
            }
            return match ($report->review_status) {
                MeActivityReport::STATUS_NOT_SUBMITTED => 'report_pending',
                MeActivityReport::STATUS_SUBMITTED     => 'report_submitted',
                MeActivityReport::STATUS_RETURNED      => 'returned_for_correction',
                MeActivityReport::STATUS_REVIEWED      => 'me_reviewed',
                MeActivityReport::STATUS_ACCEPTED      => 'accepted',
                default => 'link_unavailable',
            };
        }

        $wasLinked = MeActivityReport::onlyTrashed()->where('programme_id', $this->id)->exists();
        return $wasLinked ? 'linked_record_archived' : 'not_yet_linked';
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/Models/Programme.php
git commit -m "feat(pif): wire new section fields, M&E relation, and me_status accessor into Programme model"
```

---

### Task 3: `programme_documents` table and model

**Files:**
- Create: `api/database/migrations/2026_07_21_100001_create_programme_documents_table.php`
- Create: `api/app/Models/ProgrammeDocument.php`
- Test: `api/tests/Feature/Programmes/ProgrammeDocumentsTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeDocumentsTest extends TestCase
{
    private function draftProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Doc Test Programme',
            'status'           => 'draft',
        ]);
    }

    public function test_staff_can_add_a_document_row_to_a_draft_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'               => 'Concept Note',
            'document_type'       => 'concept_note',
            'translation_required'=> true,
            'target_languages'    => ['French'],
            'owner_name'          => 'Jane Partner',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('programme_documents', [
            'programme_id' => $programme->id,
            'title'        => 'Concept Note',
        ]);
    }

    public function test_document_requires_owner_user_or_owner_name(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'         => 'No Owner Doc',
            'document_type' => 'agenda',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['owner_name']);
    }

    public function test_translation_required_document_requires_target_languages(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'                => 'Needs Translation',
            'document_type'        => 'agenda',
            'owner_name'           => 'Jane Partner',
            'translation_required' => true,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['target_languages']);
    }

    public function test_staff_can_update_and_delete_a_document_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $doc = ProgrammeDocument::create([
            'programme_id' => $programme->id,
            'title'        => 'Old Title',
            'document_type'=> 'agenda',
            'owner_name'   => 'Jane Partner',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}", [
            'title' => 'New Title',
        ])->assertOk();
        $this->assertDatabaseHas('programme_documents', ['id' => $doc->id, 'title' => 'New Title']);

        $http->deleteJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}")->assertOk();
        $this->assertSoftDeleted('programme_documents', ['id' => $doc->id]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeDocumentsTest.php`
Expected: FAIL — table/route/controller don't exist yet (404s / class-not-found).

- [ ] **Step 3: Write the migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('programme_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('document_type');
            $table->integer('word_count')->nullable();
            $table->boolean('translation_required')->default(false);
            $table->string('source_language')->nullable();
            $table->text('target_languages')->nullable(); // JSON array
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('owner_name')->nullable();
            $table->string('owner_organisation')->nullable();
            $table->date('deadline')->nullable();
            $table->string('budget_line')->nullable();
            $table->text('comments')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programme_documents');
    }
};
```

- [ ] **Step 4: Write the model**

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammeDocument extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'programme_id', 'title', 'document_type', 'word_count',
        'translation_required', 'source_language', 'target_languages',
        'owner_user_id', 'owner_name', 'owner_organisation',
        'deadline', 'budget_line', 'comments',
    ];

    protected $casts = [
        'translation_required' => 'boolean',
        'target_languages'     => 'array',
        'deadline'              => 'date',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
```

- [ ] **Step 5: Write the controller**

Create `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeDocumentController.php`:

```php
<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgrammeDocumentController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';
        return [
            'title'                => [$required, 'string', 'max:255'],
            'document_type'        => [$required, 'string', 'max:100'],
            'word_count'           => ['nullable', 'integer', 'min:0'],
            'translation_required' => ['nullable', 'boolean'],
            'source_language'      => ['nullable', 'string', 'max:100'],
            'target_languages'     => [
                Rule::requiredIf(fn () => (bool) request()->input('translation_required')),
                'nullable', 'array',
            ],
            'target_languages.*'   => ['string', 'max:100'],
            'owner_user_id'        => ['nullable', 'integer', 'exists:users,id'],
            'owner_name'           => [
                Rule::requiredIf(fn () => empty(request()->input('owner_user_id'))),
                'nullable', 'string', 'max:255',
            ],
            'owner_organisation'   => ['nullable', 'string', 'max:255'],
            'deadline'             => ['nullable', 'date'],
            'budget_line'          => ['nullable', 'string', 'max:255'],
            'comments'             => ['nullable', 'string'],
        ];
    }

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate($this->rules());
        $document = $this->service->addDocument($programme, $data);
        return response()->json(['message' => 'Document added.', 'data' => $document], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeDocument $document): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $document = $this->service->updateDocument($document, $data);
        return response()->json(['message' => 'Document updated.', 'data' => $document]);
    }

    public function destroy(Programme $programme, ProgrammeDocument $document): JsonResponse
    {
        $this->service->deleteDocument($document);
        return response()->json(['message' => 'Document deleted.']);
    }
}
```

- [ ] **Step 6: Add service methods**

Add to `api/app/Modules/Programmes/Services/ProgrammeService.php`, in the "Sub-resource" section (after `deleteProcurementItem`), and import `ProgrammeDocument` at the top:

```php
use App\Models\ProgrammeDocument;
```

```php
    // --- Sub-resource: Documents ---

    public function addDocument(Programme $programme, array $data): ProgrammeDocument
    {
        $document = $programme->documents()->create($data);

        AuditLog::record('programme.document_added', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['document_id' => $document->id, 'title' => $document->title],
            'tags'           => 'programme',
        ]);

        return $document;
    }

    public function updateDocument(ProgrammeDocument $document, array $data): ProgrammeDocument
    {
        $document->update($data);
        return $document->fresh();
    }

    public function deleteDocument(ProgrammeDocument $document): void
    {
        AuditLog::record('programme.document_removed', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $document->programme_id,
            'new_values'     => ['document_id' => $document->id],
            'tags'           => 'programme',
        ]);

        $document->delete();
    }
```

- [ ] **Step 7: Register routes**

In `api/routes/api.php`, inside the `Route::prefix('programmes')->group(...)` block (after the existing `procurement` `apiResource`, around line 601-602):

```php
            Route::apiResource('{programme}/documents', \App\Http\Controllers\Api\V1\Programmes\ProgrammeDocumentController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['documents' => 'document']);
```

- [ ] **Step 8: Run migration and tests**

Run: `php artisan migrate`
Run: `php artisan test tests/Feature/Programmes/ProgrammeDocumentsTest.php`
Expected: PASS (all 4 tests)

- [ ] **Step 9: Commit**

```bash
git add api/database/migrations/2026_07_21_100001_create_programme_documents_table.php \
        api/app/Models/ProgrammeDocument.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeDocumentController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammeDocumentsTest.php
git commit -m "feat(pif): add programme_documents child table with owner-flexible CRUD"
```

---

### Task 4: `programme_arrival_departures` table and model

**Files:**
- Create: `api/database/migrations/2026_07_21_100002_create_programme_arrival_departures_table.php`
- Create: `api/app/Models/ProgrammeArrivalDeparture.php`
- Create: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeArrivalDepartureController.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/Programmes/ProgrammeArrivalDeparturesTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeArrivalDeparture;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeArrivalDeparturesTest extends TestCase
{
    private function draftProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Arrival Test Programme',
            'status'           => 'draft',
        ]);
    }

    public function test_staff_can_add_an_arrival_departure_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/arrival-departures", [
            'category'       => 'participant',
            'arrival_date'   => '2026-08-01',
            'departure_date' => '2026-08-03',
        ])->assertCreated();

        $this->assertDatabaseHas('programme_arrival_departures', [
            'programme_id' => $programme->id,
            'category'     => 'participant',
        ]);
    }

    public function test_departure_before_arrival_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/arrival-departures", [
            'category'       => 'participant',
            'arrival_date'   => '2026-08-03',
            'departure_date' => '2026-08-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['departure_date']);
    }

    public function test_staff_can_delete_an_arrival_departure_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $row = ProgrammeArrivalDeparture::create([
            'programme_id' => $programme->id,
            'category'     => 'consultant',
        ]);

        $http->deleteJson("/api/v1/programmes/{$programme->id}/arrival-departures/{$row->id}")->assertOk();
        $this->assertSoftDeleted('programme_arrival_departures', ['id' => $row->id]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeArrivalDeparturesTest.php`
Expected: FAIL — table/route/controller don't exist.

- [ ] **Step 3: Write the migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('programme_arrival_departures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programme_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            // participant|secretariat|rapporteur|consultant|resource_person|
            // media_liaison|expert|ict_support|interpreter|local_support|other
            $table->date('arrival_date')->nullable();
            $table->date('departure_date')->nullable();
            $table->string('airport')->nullable();
            $table->text('flight_details')->nullable();
            $table->boolean('transport_required')->default(false);
            $table->boolean('accommodation_required')->default(false);
            $table->text('comments')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programme_arrival_departures');
    }
};
```

- [ ] **Step 4: Write the model**

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammeArrivalDeparture extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'programme_id', 'category', 'arrival_date', 'departure_date',
        'airport', 'flight_details', 'transport_required', 'accommodation_required', 'comments',
    ];

    protected $casts = [
        'arrival_date'            => 'date',
        'departure_date'          => 'date',
        'transport_required'      => 'boolean',
        'accommodation_required'  => 'boolean',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }
}
```

- [ ] **Step 5: Write the controller**

```php
<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeArrivalDeparture;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeArrivalDepartureController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';
        return [
            'category'                => [$required, 'string', 'max:100'],
            'arrival_date'            => ['nullable', 'date'],
            'departure_date'          => ['nullable', 'date', 'after_or_equal:arrival_date'],
            'airport'                 => ['nullable', 'string', 'max:255'],
            'flight_details'          => ['nullable', 'string'],
            'transport_required'      => ['nullable', 'boolean'],
            'accommodation_required'  => ['nullable', 'boolean'],
            'comments'                => ['nullable', 'string'],
        ];
    }

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate($this->rules());
        $row = $this->service->addArrivalDeparture($programme, $data);
        return response()->json(['message' => 'Arrival/departure row added.', 'data' => $row], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeArrivalDeparture $arrivalDeparture): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $row = $this->service->updateArrivalDeparture($arrivalDeparture, $data);
        return response()->json(['message' => 'Arrival/departure row updated.', 'data' => $row]);
    }

    public function destroy(Programme $programme, ProgrammeArrivalDeparture $arrivalDeparture): JsonResponse
    {
        $this->service->deleteArrivalDeparture($arrivalDeparture);
        return response()->json(['message' => 'Arrival/departure row deleted.']);
    }
}
```

- [ ] **Step 6: Add service methods**

Add to `ProgrammeService.php` (after the Documents sub-resource block added in Task 3), and add `use App\Models\ProgrammeArrivalDeparture;` at the top:

```php
    // --- Sub-resource: Arrival/Departure ---

    public function addArrivalDeparture(Programme $programme, array $data): ProgrammeArrivalDeparture
    {
        return $programme->arrivalDepartures()->create($data);
    }

    public function updateArrivalDeparture(ProgrammeArrivalDeparture $row, array $data): ProgrammeArrivalDeparture
    {
        $row->update($data);
        return $row->fresh();
    }

    public function deleteArrivalDeparture(ProgrammeArrivalDeparture $row): void
    {
        $row->delete();
    }
```

- [ ] **Step 7: Register routes**

In `routes/api.php`, after the `documents` route added in Task 3:

```php
            Route::apiResource('{programme}/arrival-departures', \App\Http\Controllers\Api\V1\Programmes\ProgrammeArrivalDepartureController::class)
                ->only(['store', 'update', 'destroy'])->parameters(['arrival-departures' => 'arrivalDeparture']);
```

- [ ] **Step 8: Run migration and tests**

Run: `php artisan migrate`
Run: `php artisan test tests/Feature/Programmes/ProgrammeArrivalDeparturesTest.php`
Expected: PASS (all 3 tests)

- [ ] **Step 9: Commit**

```bash
git add api/database/migrations/2026_07_21_100002_create_programme_arrival_departures_table.php \
        api/app/Models/ProgrammeArrivalDeparture.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeArrivalDepartureController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammeArrivalDeparturesTest.php
git commit -m "feat(pif): add programme_arrival_departures child table with date-order validation"
```

---

### Task 5: Extend `ProgrammeProcurementItem` with procurement linkage columns

**Files:**
- Create: `api/database/migrations/2026_07_21_100003_add_procurement_link_to_programme_procurement_items_table.php`
- Modify: `api/app/Models/ProgrammeProcurementItem.php`
- Test: `api/tests/Feature/Programmes/ProgrammeProcurementItemsTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProgrammeProcurementItemsTest extends TestCase
{
    public function test_programme_procurement_items_table_has_linkage_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'procurement_request_id'));
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'currency'));
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'rfq_required'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeProcurementItemsTest.php`
Expected: FAIL

- [ ] **Step 3: Write the migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programme_procurement_items', function (Blueprint $table) {
            $table->foreignId('procurement_request_id')->nullable()->constrained('procurement_requests')->nullOnDelete();
            $table->string('currency')->nullable();
            $table->boolean('rfq_required')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('programme_procurement_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('procurement_request_id');
            $table->dropColumn(['currency', 'rfq_required']);
        });
    }
};
```

- [ ] **Step 4: Update the model**

Update `api/app/Models/ProgrammeProcurementItem.php`:

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeProcurementItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'description', 'estimated_cost', 'method',
        'vendor', 'delivery_date', 'status',
        'procurement_request_id', 'currency', 'rfq_required',
    ];

    protected $casts = [
        'estimated_cost' => 'decimal:2',
        'delivery_date'  => 'date',
        'rfq_required'   => 'boolean',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }
}
```

- [ ] **Step 5: Run migration and test**

Run: `php artisan migrate`
Run: `php artisan test tests/Feature/Programmes/ProgrammeProcurementItemsTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/database/migrations/2026_07_21_100003_add_procurement_link_to_programme_procurement_items_table.php \
        api/app/Models/ProgrammeProcurementItem.php \
        api/tests/Feature/Programmes/ProgrammeProcurementItemsTest.php
git commit -m "feat(pif): add procurement_request_id/currency/rfq_required to ProgrammeProcurementItem"
```

---

## Phase 2 — Core Validation, Draft-First Creation, Conditional Rules

### Task 6: Draft-first creation — minimal `store()`, full validation moves to `update()`

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Test: `api/tests/Feature/Programmes/ProgrammesTest.php` (extend)

- [ ] **Step 1: Write the failing test**

Add to `ProgrammesTest.php`:

```php
    public function test_staff_can_create_a_minimal_draft_with_only_a_title(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/programmes', ['title' => 'Untitled PIF']);

        $response->assertCreated();
        $response->assertJsonPath('data.status', 'draft');
        $this->assertNotNull($response->json('data.id'));
    }

    public function test_new_draft_can_immediately_receive_a_document_row(): void
    {
        [$http] = $this->asStaff();

        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Untitled PIF'])
            ->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/documents", [
            'title'         => 'Concept Note',
            'document_type' => 'concept_note',
            'owner_name'    => 'Jane Partner',
        ])->assertCreated();
    }
```

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `php artisan test tests/Feature/Programmes/ProgrammesTest.php`
Expected: Both PASS already, since `store()` only requires `title` today (verified in `ProgrammeController.php:27-68` — `title` is the only `required` rule) and the nested document route now exists from Task 3. This step confirms the draft-first flow the frontend will rely on is already correct on the backend — no backend change needed for this task; it exists to make the contract explicit and regression-proof before the frontend starts depending on it.

- [ ] **Step 3: Commit**

```bash
git add api/tests/Feature/Programmes/ProgrammesTest.php
git commit -m "test(pif): lock in draft-first creation contract (minimal title-only store, immediate child-row creation)"
```

---

### Task 7: Extend `store()`/`update()` validation with all new section fields and conditional rules

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Test: `api/tests/Feature/Programmes/ProgrammeSectionsTest.php` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `ProgrammeSectionsTest.php`:

```php
    public function test_venue_accommodation_count_required_when_accommodation_required(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_accommodation_required' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['venue_accommodation_count']);
    }

    public function test_support_services_other_requires_note_even_as_array(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Support Services Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services' => ['ground_transport', 'other'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['support_services_other_note']);

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services'            => ['ground_transport', 'other'],
            'support_services_other_note' => 'Boat transfer for delegates',
        ])->assertOk();
    }

    public function test_dsa_variance_reason_required_when_rates_differ(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'DSA Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
        ])->assertUnprocessable()->assertJsonValidationErrors(['dsa_variance_reason']);

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
            'dsa_variance_reason'  => 'Venue city has higher accommodation costs',
        ])->assertOk();
    }

    public function test_conflict_mitigation_required_when_conflict_declared(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared' => true,
            'conflict_details'  => 'Spouse works at the proposed vendor',
        ])->assertUnprocessable()->assertJsonValidationErrors(['conflict_mitigation']);
    }

    public function test_conflict_declared_by_and_at_are_set_server_side_not_from_payload(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Stamp Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared'    => true,
            'conflict_details'     => 'Details',
            'conflict_mitigation'  => 'Mitigation',
            'conflict_declared_by' => $other->id, // must be ignored
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                    => $programmeId,
            'conflict_declared_by'  => $user->id,
        ]);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: FAIL — none of these validation rules exist yet, and `conflict_declared_by` would currently accept the attacker-supplied value since it's plain-mass-assigned.

- [ ] **Step 3: Extend `ProgrammeController::store()` and `update()` validation**

In `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`, add `use Illuminate\Validation\Rule;` to the imports, and append these rules to both the `store()` and `update()` validation arrays (in `store()` after `'procurement_items' => [...]` at line 67; in `update()` after `'procurement_required' => [...]` at line 103):

```php
            // Venue
            'venue_country'                     => ['nullable', 'string', 'max:255'],
            'venue_city'                         => ['nullable', 'string', 'max:255'],
            'venue_proposed_hotel'               => ['nullable', 'string', 'max:255'],
            'venue_accommodation_required'       => ['nullable', 'boolean'],
            'venue_accommodation_count'          => [
                Rule::requiredIf(fn () => (bool) $request->input('venue_accommodation_required')),
                'nullable', 'integer', 'min:1',
            ],
            'venue_conferencing_required'        => ['nullable', 'boolean'],
            'venue_conferencing_participants'    => [
                Rule::requiredIf(fn () => (bool) $request->input('venue_conferencing_required')),
                'nullable', 'integer', 'min:1',
            ],
            'venue_quotation_attached'           => ['nullable', 'boolean'],
            'venue_hotel_quotation_attached'     => ['nullable', 'boolean'],
            'venue_accessibility_requirements'   => ['nullable', 'string'],
            'venue_security_considerations'      => ['nullable', 'string'],
            'venue_comments'                     => ['nullable', 'string'],
            // Budget / participant provisions (Finance-only fields intentionally excluded)
            'proposed_dsa_rate'                  => ['nullable', 'numeric', 'min:0'],
            'original_budget_rate'               => ['nullable', 'numeric', 'min:0'],
            'dsa_variance_reason'                => [
                Rule::requiredIf(fn () =>
                    $request->filled('proposed_dsa_rate') && $request->filled('original_budget_rate')
                    && (float) $request->input('proposed_dsa_rate') !== (float) $request->input('original_budget_rate')
                ),
                'nullable', 'string',
            ],
            'proposed_participants'              => ['nullable', 'integer', 'min:0'],
            'budgeted_participants'               => ['nullable', 'integer', 'min:0'],
            'participants_variance_reason'       => [
                Rule::requiredIf(fn () =>
                    $request->filled('proposed_participants') && $request->filled('budgeted_participants')
                    && (int) $request->input('proposed_participants') !== (int) $request->input('budgeted_participants')
                ),
                'nullable', 'string',
            ],
            'proposed_funding_difference'        => ['nullable', 'numeric', 'min:0'],
            'estimated_activity_amount'          => ['nullable', 'numeric', 'min:0'],
            // Consultants
            'secretariat_staff_required'         => ['nullable', 'boolean'],
            'secretariat_staff_count'            => ['nullable', 'integer', 'min:0'],
            'consultants_required'               => ['nullable', 'boolean'],
            'consultants_count'                  => ['nullable', 'integer', 'min:0'],
            'consultants_rate'                   => ['nullable', 'numeric', 'min:0'],
            'resource_persons_required'          => ['nullable', 'boolean'],
            'resource_persons_count'             => ['nullable', 'integer', 'min:0'],
            'resource_persons_rate'              => ['nullable', 'numeric', 'min:0'],
            'rapporteurs_required'               => ['nullable', 'boolean'],
            'rapporteurs_count'                  => ['nullable', 'integer', 'min:0'],
            'rapporteurs_rate'                   => ['nullable', 'numeric', 'min:0'],
            'media_liaison_required'             => ['nullable', 'boolean'],
            'media_liaison_count'                => ['nullable', 'integer', 'min:0'],
            'local_support_required'             => ['nullable', 'boolean'],
            'local_support_count'                => ['nullable', 'integer', 'min:0'],
            'local_support_rate'                 => ['nullable', 'numeric', 'min:0'],
            'personnel_comments'                 => ['nullable', 'string'],
            // Interpretation
            'interpretation_required'            => ['nullable', 'boolean'],
            'en_fr_required'                     => ['nullable', 'boolean'],
            'en_fr_interpreters_count'           => [
                Rule::requiredIf(fn () => (bool) $request->input('en_fr_required')), 'nullable', 'integer', 'min:1',
            ],
            'en_pt_required'                     => ['nullable', 'boolean'],
            'en_pt_interpreters_count'           => [
                Rule::requiredIf(fn () => (bool) $request->input('en_pt_required')), 'nullable', 'integer', 'min:1',
            ],
            'fr_pt_required'                     => ['nullable', 'boolean'],
            'fr_pt_interpreters_count'           => [
                Rule::requiredIf(fn () => (bool) $request->input('fr_pt_required')), 'nullable', 'integer', 'min:1',
            ],
            'interpreter_rate'                   => ['nullable', 'numeric', 'min:0'],
            'interpreter_source'                 => ['nullable', 'string', Rule::in(['internal', 'supplier', 'partner', 'other'])],
            'interpreter_source_other_note'      => [
                Rule::requiredIf(fn () => $request->input('interpreter_source') === 'other'), 'nullable', 'string',
            ],
            'interpretation_equipment_required'  => ['nullable', 'boolean'],
            'translation_required'               => ['nullable', 'boolean'],
            'languages_required'                 => [
                Rule::requiredIf(fn () => (bool) $request->input('translation_required')), 'nullable', 'array',
            ],
            'languages_required.*'               => ['string', 'max:100'],
            'interpretation_comments'            => ['nullable', 'string'],
            // Support services
            'support_services'                   => ['nullable', 'array'],
            'support_services.*'                 => ['string'],
            'support_services_other_note'        => [
                Rule::requiredIf(fn () => in_array('other', (array) $request->input('support_services', []), true)),
                'nullable', 'string',
            ],
            // Conflict of interest — conflict_declared_by/at deliberately absent (server-side only)
            'conflict_declared'                  => ['nullable', 'boolean'],
            'conflict_details'                   => [
                Rule::requiredIf(fn () => (bool) $request->input('conflict_declared')), 'nullable', 'string',
            ],
            'conflict_mitigation'                => [
                Rule::requiredIf(fn () => (bool) $request->input('conflict_declared')), 'nullable', 'string',
            ],
```

- [ ] **Step 4: Update `ProgrammeService::create()` and `update()` to persist the new fields and stamp conflict metadata server-side**

In `ProgrammeService.php`, add the new keys to the `Programme::create([...])` array in `create()` (append before the closing `]);` around line 96):

```php
            'venue_country'                    => $data['venue_country'] ?? null,
            'venue_city'                        => $data['venue_city'] ?? null,
            'venue_proposed_hotel'              => $data['venue_proposed_hotel'] ?? null,
            'venue_accommodation_required'      => $data['venue_accommodation_required'] ?? false,
            'venue_accommodation_count'         => $data['venue_accommodation_count'] ?? null,
            'venue_conferencing_required'       => $data['venue_conferencing_required'] ?? false,
            'venue_conferencing_participants'   => $data['venue_conferencing_participants'] ?? null,
            'venue_quotation_attached'          => $data['venue_quotation_attached'] ?? false,
            'venue_hotel_quotation_attached'    => $data['venue_hotel_quotation_attached'] ?? false,
            'venue_accessibility_requirements'  => $data['venue_accessibility_requirements'] ?? null,
            'venue_security_considerations'     => $data['venue_security_considerations'] ?? null,
            'venue_comments'                     => $data['venue_comments'] ?? null,
            'proposed_dsa_rate'                  => $data['proposed_dsa_rate'] ?? null,
            'original_budget_rate'               => $data['original_budget_rate'] ?? null,
            'dsa_variance_reason'                => $data['dsa_variance_reason'] ?? null,
            'proposed_participants'              => $data['proposed_participants'] ?? null,
            'budgeted_participants'              => $data['budgeted_participants'] ?? null,
            'participants_variance_reason'       => $data['participants_variance_reason'] ?? null,
            'proposed_funding_difference'        => $data['proposed_funding_difference'] ?? null,
            'estimated_activity_amount'          => $data['estimated_activity_amount'] ?? null,
            'secretariat_staff_required'         => $data['secretariat_staff_required'] ?? false,
            'secretariat_staff_count'            => $data['secretariat_staff_count'] ?? null,
            'consultants_required'               => $data['consultants_required'] ?? false,
            'consultants_count'                  => $data['consultants_count'] ?? null,
            'consultants_rate'                   => $data['consultants_rate'] ?? null,
            'resource_persons_required'          => $data['resource_persons_required'] ?? false,
            'resource_persons_count'             => $data['resource_persons_count'] ?? null,
            'resource_persons_rate'              => $data['resource_persons_rate'] ?? null,
            'rapporteurs_required'               => $data['rapporteurs_required'] ?? false,
            'rapporteurs_count'                  => $data['rapporteurs_count'] ?? null,
            'rapporteurs_rate'                   => $data['rapporteurs_rate'] ?? null,
            'media_liaison_required'             => $data['media_liaison_required'] ?? false,
            'media_liaison_count'                => $data['media_liaison_count'] ?? null,
            'local_support_required'             => $data['local_support_required'] ?? false,
            'local_support_count'                => $data['local_support_count'] ?? null,
            'local_support_rate'                 => $data['local_support_rate'] ?? null,
            'personnel_comments'                 => $data['personnel_comments'] ?? null,
            'interpretation_required'            => $data['interpretation_required'] ?? false,
            'en_fr_required'                     => $data['en_fr_required'] ?? false,
            'en_fr_interpreters_count'           => $data['en_fr_interpreters_count'] ?? null,
            'en_pt_required'                     => $data['en_pt_required'] ?? false,
            'en_pt_interpreters_count'           => $data['en_pt_interpreters_count'] ?? null,
            'fr_pt_required'                     => $data['fr_pt_required'] ?? false,
            'fr_pt_interpreters_count'           => $data['fr_pt_interpreters_count'] ?? null,
            'interpreter_rate'                   => $data['interpreter_rate'] ?? null,
            'interpreter_source'                 => $data['interpreter_source'] ?? null,
            'interpreter_source_other_note'      => $data['interpreter_source_other_note'] ?? null,
            'interpretation_equipment_required'  => $data['interpretation_equipment_required'] ?? false,
            'translation_required'               => $data['translation_required'] ?? false,
            'languages_required'                 => $data['languages_required'] ?? null,
            'interpretation_comments'            => $data['interpretation_comments'] ?? null,
            'support_services'                   => $data['support_services'] ?? null,
            'support_services_other_note'        => $data['support_services_other_note'] ?? null,
```

Then, immediately after that `Programme::create([...])` call (still inside `create()`), add the conflict-declaration server-side stamping shared by both `create()` and `update()` as a private helper, and call it. Add this private method at the bottom of the "Private helpers" section:

```php
    /**
     * Applies conflict-of-interest fields, stamping declared_by/declared_at
     * server-side from the acting user — never from the request payload.
     */
    private function applyConflictDeclaration(Programme $programme, array $data, User $user): void
    {
        if (!array_key_exists('conflict_declared', $data)) {
            return;
        }

        $wasDeclared = (bool) $programme->conflict_declared;
        $nowDeclared = (bool) $data['conflict_declared'];

        $payload = [
            'conflict_declared'   => $nowDeclared,
            'conflict_details'    => $data['conflict_details'] ?? null,
            'conflict_mitigation' => $data['conflict_mitigation'] ?? null,
        ];

        if ($nowDeclared && !$wasDeclared) {
            $payload['conflict_declared_by'] = $user->id;
            $payload['conflict_declared_at'] = now();

            AuditLog::record('programme.conflict_declared', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->id,
                'tags'           => 'programme',
            ]);
        } elseif ($nowDeclared && $wasDeclared) {
            AuditLog::record('programme.conflict_amended', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->id,
                'tags'           => 'programme',
            ]);
        }

        $programme->update($payload);
    }
```

In `create()`, after `$this->syncSubRecords($programme, $data);` (line 98), add:

```php
        $this->applyConflictDeclaration($programme, $data, $user);
```

In `update()`, after `$programme->update(array_filter($updatePayload, fn ($v) => $v !== null));` (line 171), add the same call, plus append all the new non-conflict, non-finance fields to `$updatePayload` (mirroring the `create()` list above, using `$data['field'] ?? null` and letting the existing `array_filter(..., fn ($v) => $v !== null)` drop absent ones):

```php
        $this->applyConflictDeclaration($programme, $data, $user);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammeSectionsTest.php`
Expected: PASS (all tests, including the conflict-stamping and conditional-validation ones)

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/tests/Feature/Programmes/ProgrammeSectionsTest.php
git commit -m "feat(pif): validate and persist venue/budget/personnel/interpretation/support-services/conflict sections with array-safe conditional rules"
```

---

## Phase 3 — Finance-Only Field Protection

### Task 8: Seed `programme.finance-review` permission

**Files:**
- Modify: `api/database/seeders/RolesAndPermissionsSeeder.php`
- Test: `api/tests/Feature/Programmes/ProgrammeFinanceReviewTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProgrammeFinanceReviewTest extends TestCase
{
    public function test_finance_review_permission_is_seeded_and_assigned_to_finance_controller(): void
    {
        Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\RolesAndPermissionsSeeder']);

        $this->assertTrue(Permission::where('name', 'programme.finance-review')->exists());

        $role = \Spatie\Permission\Models\Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->hasPermissionTo('programme.finance-review', 'sanctum'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammeFinanceReviewTest.php`
Expected: FAIL — permission doesn't exist yet.

- [ ] **Step 3: Add the permission**

In `RolesAndPermissionsSeeder.php`, add to the `$permissions` array (after the `'pif.view', 'pif.create', 'pif.approve', 'pif.admin',` line, verified at line ~35):

```php
            'programme.finance-review',
```

Then, in the guard loop, find the block granting `$financeController` its permissions (there are multiple `givePermissionTo` calls for `$financeController` throughout the file — add a new one near the other Programmes/PIF-related grants, or immediately after the M&E block shown earlier):

```php
            // Finance Controller reviews PIF budget-availability and finance comments.
            $financeController->givePermissionTo(
                Permission::where('name', 'programme.finance-review')->where('guard_name', $guard)->get()
            );
```

Also grant it to Director Finance if that role exists in the seeder — search for a role variable representing "Director of Finance and Corporate Services" (grep `director.*finance` case-insensitively in the seeder); if found, add the same `givePermissionTo` call for that role variable. If no such role exists yet, note this as a follow-up and grant only to `$financeController` for now (do not invent a new role in this task — that's out of scope).

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Programmes/ProgrammeFinanceReviewTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/database/seeders/RolesAndPermissionsSeeder.php api/tests/Feature/Programmes/ProgrammeFinanceReviewTest.php
git commit -m "feat(pif): seed programme.finance-review permission for Finance Controller"
```

---

### Task 9: `updateFinanceReview()` endpoint

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/Programmes/ProgrammeFinanceReviewTest.php` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `ProgrammeFinanceReviewTest.php`:

```php
    public function test_staff_cannot_update_finance_only_fields_via_finance_review_endpoint(): void
    {
        Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\RolesAndPermissionsSeeder']);
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance Gate Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'available',
            'finance_comments'           => 'Confirmed.',
        ])->assertForbidden();
    }

    public function test_staff_cannot_smuggle_finance_fields_through_normal_update(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance Smuggle Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'budget_availability_status' => 'available',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'budget_availability_status'  => 'not_checked', // unchanged — field is silently ignored, not validated on this endpoint
        ]);
    }

    public function test_finance_controller_can_update_finance_only_fields(): void
    {
        Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\RolesAndPermissionsSeeder']);
        $tenant = \App\Models\Tenant::factory()->create();
        [$http] = $this->asStaff($tenant); // create the programme as staff
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Finance OK Test'])->json('data.id');

        [$financeHttp] = $this->asUser($this->makeUser('Finance Controller', $tenant)) ?? [null];
        $financeHttp = $financeHttp ?: $this->actingAsRole('Finance Controller', $tenant);

        $financeHttp->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
            'budget_availability_status' => 'available',
            'finance_comments'           => 'Confirmed with Finance.',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'budget_availability_status'  => 'available',
        ]);
    }
```

Note: the exact helper for acting as a `Finance Controller` user must match what `TestCase.php` already exposes — before writing this test for real, grep `tests/TestCase.php` for `financeController` or `FinanceController` helper methods (similar to the existing `asAdmin`/`asHrManager` pattern) and use whichever one exists (e.g. `$this->asFinanceController($tenant)` if present); if none exists, use `[$this->asUser($this->makeUser('Finance Controller', $tenant)), null]` directly, matching the `asStaff()`/`asAdmin()` implementation pattern shown in `tests/TestCase.php:92-102`. Adjust the test to whichever helper actually exists — do not guess a method name that doesn't compile.

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeFinanceReviewTest.php`
Expected: FAIL — endpoint doesn't exist (404).

- [ ] **Step 3: Add the controller method**

In `ProgrammeController.php`, add after `update()`:

```php
    public function updateFinanceReview(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'budget_availability_status' => ['required', 'string', Rule::in([
                'not_checked', 'available', 'partially_available', 'unavailable', 'confirmed_with_conditions',
            ])],
            'finance_comments' => ['nullable', 'string'],
        ]);

        $programme = $this->service->updateFinanceReview($programme, $data);
        return response()->json(['message' => 'Finance review updated.', 'data' => $programme]);
    }
```

- [ ] **Step 4: Add the service method**

In `ProgrammeService.php`:

```php
    public function updateFinanceReview(Programme $programme, array $data): Programme
    {
        $programme->update([
            'budget_availability_status' => $data['budget_availability_status'],
            'finance_comments'           => $data['finance_comments'] ?? null,
        ]);

        AuditLog::record('programme.finance_review_updated', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['budget_availability_status' => $data['budget_availability_status']],
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
    }
```

- [ ] **Step 5: Register the permission-gated route**

In `routes/api.php`, inside the `programmes` prefix group, after the `reject` route:

```php
            Route::middleware('can:programme.finance-review')
                ->put('{programme}/finance-review', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'updateFinanceReview']);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammeFinanceReviewTest.php`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammeFinanceReviewTest.php
git commit -m "feat(pif): add permission-gated finance-review endpoint for budget_availability_status/finance_comments"
```

---

## Phase 4 — Simplified Declaration and Submission Gate

### Task 10: Single declaration confirmation gate on `submit()`

**Files:**
- Modify: `api/config/pif.php` (new)
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Test: `api/tests/Feature/Programmes/ProgrammeDeclarationTest.php`

- [ ] **Step 1: Write the failing tests**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeDeclarationTest extends TestCase
{
    public function test_submit_fails_without_declaration_confirmation(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Declaration Test'])->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['declaration_confirmed']);
    }

    public function test_submit_succeeds_and_stamps_declaration_when_confirmed(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Declaration Test'])->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/submit", [
            'declaration_confirmed' => true,
        ])->assertOk();

        $programme = Programme::find($programmeId);
        $this->assertTrue($programme->declaration_confirmed);
        $this->assertSame($user->id, $programme->declaration_confirmed_by);
        $this->assertNotNull($programme->declaration_confirmed_at);
        $this->assertNotNull($programme->declaration_version);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeDeclarationTest.php`
Expected: FAIL — `submit()` currently accepts no body and always succeeds.

- [ ] **Step 3: Add the versioned declaration text config**

Create `api/config/pif.php`:

```php
<?php

return [
    'declaration_versions' => [
        'v1' => 'I confirm that this PIF relates to one activity, the information provided is accurate to the best of my knowledge, required supporting documents have been included, and any known conflict of interest has been disclosed.',
    ],
    'current_declaration_version' => 'v1',
];
```

- [ ] **Step 4: Update `ProgrammeController::submit()` and `ProgrammeService::submit()`**

In `ProgrammeController.php`, change `submit()`:

```php
    public function submit(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'declaration_confirmed' => ['required', 'accepted'],
        ]);

        $result = $this->service->submit($programme, $request->user());
        return response()->json(['message' => 'Programme submitted.', 'data' => $result]);
    }
```

In `ProgrammeService.php`, update `submit()`:

```php
    public function submit(Programme $programme, User $user): Programme
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be submitted.']);
        }

        $programme->update([
            'status'                    => 'submitted',
            'submitted_at'              => now(),
            'declaration_confirmed'     => true,
            'declaration_confirmed_by'  => $user->id,
            'declaration_confirmed_at'  => now(),
            'declaration_version'       => config('pif.current_declaration_version'),
        ]);

        AuditLog::record('programme.submitted', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        AuditLog::record('programme.declaration_confirmed', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['declaration_version' => config('pif.current_declaration_version')],
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammeDeclarationTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/config/pif.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/tests/Feature/Programmes/ProgrammeDeclarationTest.php
git commit -m "feat(pif): require single versioned declaration confirmation to submit a PIF"
```

---

## Phase 5 — M&E Connection

### Task 11: `me_status` accessor coverage across all 9 states

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php` (expose in `show()`)
- Test: `api/tests/Feature/Programmes/ProgrammeMeStatusTest.php`

- [ ] **Step 1: Write the failing tests**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeMeStatusTest extends TestCase
{
    private function approvedProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'ME Status Test',
            'status'           => 'approved',
            'approved_at'      => now(),
        ]);
    }

    public function test_me_status_is_not_yet_linked_when_no_report_exists(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $this->assertSame('not_yet_linked', $programme->me_status);
    }

    /** @dataProvider reviewStatusProvider */
    public function test_me_status_maps_each_review_status(string $reviewStatus, string $expected): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => $programme->id,
            'activity_title' => 'ME Status Test',
            'review_status'  => $reviewStatus,
            'created_by'     => $user->id,
        ]);

        $this->assertSame($expected, $programme->fresh()->me_status);
    }

    public static function reviewStatusProvider(): array
    {
        return [
            'not submitted' => [MeActivityReport::STATUS_NOT_SUBMITTED, 'report_pending'],
            'submitted'     => [MeActivityReport::STATUS_SUBMITTED, 'report_submitted'],
            'returned'      => [MeActivityReport::STATUS_RETURNED, 'returned_for_correction'],
            'reviewed'      => [MeActivityReport::STATUS_REVIEWED, 'me_reviewed'],
            'accepted'      => [MeActivityReport::STATUS_ACCEPTED, 'accepted'],
            'closed'        => [MeActivityReport::STATUS_CLOSED, 'closed'],
        ];
    }

    public function test_me_status_is_archived_when_linked_report_was_soft_deleted(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $report = MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => $programme->id,
            'activity_title' => 'ME Status Test',
            'review_status'  => MeActivityReport::STATUS_SUBMITTED,
            'created_by'     => $user->id,
        ]);
        $report->delete();

        $this->assertSame('linked_record_archived', $programme->fresh()->me_status);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass or fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeMeStatusTest.php`
Expected: These should already PASS given the accessor written in Task 2 — this task exists to lock the full state-space in as a regression suite, not to write new production code. If any case fails, fix `getMeStatusAttribute()` in `Programme.php` to match (most likely gap: `MeActivityReport::create()` requires a `reference_number`, which is auto-generated in `booted()` — verify the factory/creation call above works as-is; if `tenant_id` scoping causes an issue with `onlyTrashed()->where('programme_id', ...)` across tenants, add `->where('tenant_id', $this->tenant_id)` to that query).

- [ ] **Step 3: Expose `me_status` in the API response**

In `ProgrammeService::get()` (`api/app/Modules/Programmes/Services/ProgrammeService.php:40-47`), the accessor is already available on the model automatically once appended — confirm by adding `'me_status'` to Programme's `$appends` array so it serializes in JSON responses:

In `Programme.php`, add near the top of the class (after `$casts`):

```php
    protected $appends = ['me_status'];
```

- [ ] **Step 4: Add an API-level test that `me_status` appears in the show response**

Add to `ProgrammeMeStatusTest.php`:

```php
    public function test_me_status_is_included_in_the_show_response(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $http->getJson("/api/v1/programmes/{$programme->id}")
            ->assertOk()
            ->assertJsonPath('data.me_status', 'not_yet_linked');
    }
```

- [ ] **Step 5: Run all tests**

Run: `php artisan test tests/Feature/Programmes/ProgrammeMeStatusTest.php`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add api/app/Models/Programme.php api/tests/Feature/Programmes/ProgrammeMeStatusTest.php
git commit -m "test(pif): lock in me_status accessor across all 9 states and expose it on the API response"
```

---

### Task 12: Filter the M&E intake queue to unlinked PIFs

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/MAndE/MeActivityReportController.php`
- Test: `api/tests/Feature/MAndE/PifLinkagesTest.php` (create if no M&E test directory convention exists — check `tests/Feature` for an `MAndE` directory first; if one exists with a different naming convention, match it instead of creating a new one)

- [ ] **Step 1: Check for an existing M&E test directory/convention**

Run: `find api/tests/Feature -iname "*MAndE*" -o -iname "*activity*report*"`
If a test file already covers `linkablePifs`, extend it instead of creating a new file. If none exists, create `api/tests/Feature/MAndE/PifLinkagesTest.php`.

- [ ] **Step 2: Write the failing test**

```php
<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class PifLinkagesTest extends TestCase
{
    public function test_unlinked_filter_excludes_programmes_with_a_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant); // adjust to whichever role holds mande.view — check RolesAndPermissionsSeeder

        $linked = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Linked', 'status' => 'approved', 'approved_at' => now(),
        ]);
        $unlinked = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Unlinked', 'status' => 'approved', 'approved_at' => now(),
        ]);
        MeActivityReport::create([
            'tenant_id' => $tenant->id, 'programme_id' => $linked->id,
            'activity_title' => 'Linked', 'created_by' => $user->id,
        ]);

        $response = $http->getJson('/api/v1/mande/pif-linkages?unlinked=true')->assertOk();

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($unlinked->id));
        $this->assertFalse($ids->contains($linked->id));
    }
}
```

- [ ] **Step 3: Run test to verify it fails or needs permission adjustment**

Run: `php artisan test tests/Feature/MAndE/PifLinkagesTest.php`
Expected: FAIL initially (filter doesn't exist); if it fails on a 403 instead, check which permission gates `GET /mande/pif-linkages` in `routes/api.php` (it's under the `can:mande.view` middleware group per the earlier route audit) and swap `$this->asStaff($tenant)` for a user with `mande.view` (staff already has `mande.view`/`mande.create` per the seeder — verify before assuming, since a 403 vs a missing-filter failure look different in the test output).

- [ ] **Step 4: Add the filter**

In `MeActivityReportController::linkablePifs()` (`api/app/Http/Controllers/Api/V1/MAndE/MeActivityReportController.php:56-83`), change the `$programmes` query to accept the filter:

```php
    public function linkablePifs(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $query = Programme::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved');

        $reportedIds = MeActivityReport::where('tenant_id', $tenantId)
            ->distinct()
            ->pluck('programme_id')
            ->all();

        if ($request->boolean('unlinked')) {
            $query->whereNotIn('id', $reportedIds);
        }

        $programmes = $query
            ->withCount(['attachments'])
            ->orderByDesc('approved_at')
            ->get(['id', 'reference_number', 'title', 'strategic_pillar', 'responsible_officer_id', 'start_date', 'end_date', 'approved_at']);

        $data = $programmes->map(function (Programme $p) use ($reportedIds) {
            return [
                'id'               => $p->id,
                'reference_number' => $p->reference_number,
                'title'            => $p->title,
                'strategic_pillar' => $p->strategic_pillar,
                'start_date'       => $p->start_date,
                'end_date'         => $p->end_date,
                'has_report'       => in_array($p->id, $reportedIds, true),
            ];
        });

        return response()->json(['data' => $data]);
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test tests/Feature/MAndE/PifLinkagesTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/Api/V1/MAndE/MeActivityReportController.php api/tests/Feature/MAndE/PifLinkagesTest.php
git commit -m "feat(pif): add unlinked=true filter to the M&E PIF-linkages intake queue"
```

---

### Task 13: Notify Responsible Officer and M&E on PIF approval

**Files:**
- Modify: `api/app/Services/NotificationService.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Test: `api/tests/Feature/Programmes/ProgrammesTest.php` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `ProgrammesTest.php`:

```php
    public function test_approving_a_programme_notifies_the_responsible_officer(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'               => $tenant->id,
            'created_by'              => $staff->id,
            'reference_number'        => 'PIF-' . uniqid(),
            'title'                   => 'Notify Me',
            'status'                  => 'submitted',
            'responsible_officer_id'  => $staff->id,
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $staff->id,
            'trigger' => 'programme.approved_for_me',
        ]);
    }

    public function test_approving_a_programme_notifies_me_officers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant); // staff already holds mande.create per seeder
        $meOfficer = $this->makeUser('Governance Officer', $tenant); // holds mande.admin per seeder

        $programme = Programme::create([
            'tenant_id'               => $tenant->id,
            'created_by'              => $staff->id,
            'reference_number'        => 'PIF-' . uniqid(),
            'title'                   => 'Notify ME',
            'status'                  => 'submitted',
            'responsible_officer_id'  => $staff->id,
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $meOfficer->id,
            'trigger' => 'programme.me_intake_available',
        ]);
    }
```

Note: verify the exact role names (`Governance Officer` etc.) against `RolesAndPermissionsSeeder.php` before running — use whichever role name actually holds `mande.admin`/`mande.create` in that file (confirmed earlier in this conversation: `$governanceOfficer` holds `mande.admin`, `$staff` holds `mande.create`), and run `Artisan::call('db:seed', ...)` in the test if permissions need to exist for `hasPermissionTo` lookups to work (the notification dispatch itself queries `User::permission('mande.create')` or similar — see Step 3).

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammesTest.php`
Expected: FAIL — no notifications are currently dispatched from `approve()`.

- [ ] **Step 3: Add notification trigger templates**

In `NotificationService.php`, add to the `$defaults` array (near the other module sections, e.g. after the Travel block):

```php
            // Programmes / PIF → M&E handoff
            'programme.approved_for_me' => [
                'subject' => 'Your PIF is approved — ready for M&E reporting',
                'body'    => "Dear {{name}},\n\nYour approved PIF ({{reference}}) \"{{title}}\" is now ready for post-activity reporting in the M&E module once the activity is implemented.\n\nRegards,\nSADC-PF Nexus",
            ],
            'programme.me_intake_available' => [
                'subject' => 'A new approved PIF is available for M&E linkage',
                'body'    => "Dear {{name}},\n\nA newly approved PIF ({{reference}}) \"{{title}}\" is available in the M&E PIF-linkages queue for reporting setup.\n\nRegards,\nSADC-PF Nexus",
            ],
```

- [ ] **Step 4: Dispatch from `ProgrammeService::approve()`**

Update `approve()` in `ProgrammeService.php` (add `use App\Services\NotificationService;` at the top, and inject or resolve it):

```php
    public function approve(Programme $programme, User $approver): Programme
    {
        if (!$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be approved.']);
        }

        if ($programme->created_by && (int) $programme->created_by === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $programme->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('programme.approved', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        $this->notifyMeOfPifApproval($programme);

        return $programme->fresh(['creator', 'approver']);
    }

    private function notifyMeOfPifApproval(Programme $programme): void
    {
        $notifier = app(NotificationService::class);
        $vars = ['reference' => $programme->reference_number, 'title' => $programme->title];

        $officer = $programme->responsible_officer_id
            ? User::find($programme->responsible_officer_id)
            : null;
        if ($officer) {
            $notifier->dispatch(
                $officer,
                'programme.approved_for_me',
                array_merge($vars, ['name' => $officer->name]),
                ['module' => 'programme', 'record_id' => $programme->id, 'url' => '/pif/' . $programme->id]
            );
        }

        $meOfficers = User::where('tenant_id', $programme->tenant_id)
            ->permission('mande.create')
            ->get();

        $notifier->dispatchToMany(
            $meOfficers,
            'programme.me_intake_available',
            $vars,
            ['module' => 'mande', 'record_id' => $programme->id, 'url' => '/mande/pif-linkages']
        );
    }
```

Note: `User::permission('mande.create')` relies on Spatie's `HasRoles`/`HasPermissions` query scope being available on the `User` model — verify `app/Models/User.php` uses the `Spatie\Permission\Traits\HasRoles` trait (it does, given `$user->assignRole()` is used throughout the existing test suite) and that the `permission()` local scope is available (it is, as part of that trait). If `dispatchToMany`'s signature differs from what's assumed here, re-check `NotificationService::dispatchToMany()` (verified signature: `(iterable $recipients, string $triggerKey, array $vars = [], array $meta = [], bool $sendEmail = true): void` — no `$name` var needed per-recipient since `dispatchToMany` likely resolves `{{name}}` per recipient internally; confirm by reading the method body before assuming, and adjust the `vars` array if it expects `name` to be supplied per-call instead).

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammesTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/app/Services/NotificationService.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/tests/Feature/Programmes/ProgrammesTest.php
git commit -m "feat(pif): notify responsible officer and M&E officers when a PIF is approved"
```

---

## Phase 6 — Batched Procurement Transfer

### Task 14: `POST /programmes/{programme}/send-to-procurement`

**Files:**
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/Programmes/ProgrammeProcurementTransferTest.php`

- [ ] **Step 1: Write the failing tests**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeProcurementItem;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeProcurementTransferTest extends TestCase
{
    private function approvedProgrammeWithItems(Tenant $tenant, int $userId): array
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Procurement Transfer Test',
            'status' => 'approved', 'approved_at' => now(),
        ]);
        $item1 = ProgrammeProcurementItem::create([
            'programme_id' => $programme->id, 'description' => 'Catering', 'estimated_cost' => 500,
        ]);
        $item2 = ProgrammeProcurementItem::create([
            'programme_id' => $programme->id, 'description' => 'Printing', 'estimated_cost' => 150,
        ]);
        return [$programme, $item1, $item2];
    }

    public function test_send_to_procurement_creates_one_request_with_multiple_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        [$programme, $item1, $item2] = $this->approvedProgrammeWithItems($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id, $item2->id],
            'request_title'        => 'Procurement requirements for approved activity',
        ]);

        $response->assertOk();
        $requestId = $response->json('data.id');

        $this->assertDatabaseCount('procurement_items', 2);
        $this->assertDatabaseHas('programme_procurement_items', ['id' => $item1->id, 'procurement_request_id' => $requestId]);
        $this->assertDatabaseHas('programme_procurement_items', ['id' => $item2->id, 'procurement_request_id' => $requestId]);
    }

    public function test_send_to_procurement_rejects_when_programme_not_approved(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Not Approved', 'status' => 'draft',
        ]);
        $item = ProgrammeProcurementItem::create(['programme_id' => $programme->id, 'description' => 'X', 'estimated_cost' => 10]);

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item->id],
            'request_title'        => 'Too Early',
        ])->assertUnprocessable();
    }

    public function test_send_to_procurement_rejects_already_linked_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        [$programme, $item1] = $this->approvedProgrammeWithItems($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id], 'request_title' => 'First',
        ])->assertOk();

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id], 'request_title' => 'Duplicate',
        ])->assertStatus(409);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeProcurementTransferTest.php`
Expected: FAIL — endpoint doesn't exist.

- [ ] **Step 3: Add the controller method**

In `ProgrammeController.php` (add `use App\Models\ProcurementRequest;` and `use Illuminate\Validation\ValidationException;` if not already imported):

```php
    public function sendToProcurement(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'procurement_item_ids'   => ['required', 'array', 'min:1'],
            'procurement_item_ids.*' => ['integer', 'exists:programme_procurement_items,id'],
            'request_title'          => ['required', 'string', 'max:255'],
        ]);

        $procurementRequest = $this->service->sendToProcurement($programme, $data, $request->user());
        return response()->json(['message' => 'Procurement request created.', 'data' => $procurementRequest]);
    }
```

- [ ] **Step 4: Add the service method**

In `ProgrammeService.php` (add `use App\Models\ProcurementItem;` and `use App\Models\ProcurementRequest;` at the top):

```php
    public function sendToProcurement(Programme $programme, array $data, User $user): ProcurementRequest
    {
        if (!$programme->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved programmes can send items to procurement.']);
        }

        $items = $programme->procurementItems()->whereIn('id', $data['procurement_item_ids'])->get();

        $alreadyLinked = $items->whereNotNull('procurement_request_id');
        if ($alreadyLinked->isNotEmpty()) {
            abort(409, 'One or more selected items have already been sent to procurement.');
        }

        $procurementRequest = ProcurementRequest::create([
            'tenant_id'     => $programme->tenant_id,
            'requester_id'  => $user->id,
            'title'         => $data['request_title'],
            'description'   => 'Generated from approved PIF ' . $programme->reference_number,
            'status'        => 'draft',
            'currency'      => $programme->primary_currency ?? 'USD',
        ]);

        foreach ($items as $item) {
            ProcurementItem::create([
                'procurement_request_id' => $procurementRequest->id,
                'description'             => $item->description,
                'quantity'                => 1,
                'unit'                    => 'item',
                'estimated_unit_price'    => $item->estimated_cost,
                'total_price'             => $item->estimated_cost,
            ]);
            $item->update(['procurement_request_id' => $procurementRequest->id]);
        }

        AuditLog::record('programme.procurement_sent', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => [
                'procurement_item_ids'    => $data['procurement_item_ids'],
                'procurement_request_id'  => $procurementRequest->id,
            ],
            'tags' => 'programme',
        ]);

        return $procurementRequest->fresh();
    }
```

- [ ] **Step 5: Register the route**

In `routes/api.php`, inside the `programmes` prefix group:

```php
            Route::post('{programme}/send-to-procurement', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'sendToProcurement']);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammeProcurementTransferTest.php`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammeProcurementTransferTest.php
git commit -m "feat(pif): batch-transfer approved procurement items into a single ProcurementRequest"
```

---

## Phase 7 — Full PIF PDF Export

### Task 15: `GET /programmes/{programme}/pdf`

**Files:**
- Create: `api/resources/views/pdf/programme.blade.php`
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/Programmes/ProgrammePdfTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammePdfTest extends TestCase
{
    public function test_pdf_can_be_downloaded_for_an_approved_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'PDF Test',
            'status' => 'approved', 'approved_at' => now(),
            'venue_country' => 'Namibia', 'venue_city' => 'Windhoek',
        ]);

        $response = $http->get("/api/v1/programmes/{$programme->id}/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Programmes/ProgrammePdfTest.php`
Expected: FAIL — route/view don't exist.

- [ ] **Step 3: Write the Blade view**

Create `api/resources/views/pdf/programme.blade.php` (a plain, print-oriented HTML document — dompdf does not support most modern CSS, keep it simple, mirroring the style already used in `resources/views/pdf/signed_document.blade.php` if that file exists; check it first with `find api/resources/views/pdf -type f` and reuse its base styling/table conventions rather than inventing new ones):

```blade
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        h2 { font-size: 13px; border-bottom: 1px solid #333; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        td, th { padding: 3px 6px; text-align: left; vertical-align: top; }
        .label { font-weight: bold; width: 35%; }
        .qr { text-align: right; }
    </style>
</head>
<body>
    <table>
        <tr>
            <td>
                <h1>Programme Implementation Form</h1>
                <div>Reference: {{ $programme->reference_number }}</div>
                <div>Status: {{ ucwords(str_replace('_', ' ', $programme->status)) }}</div>
            </td>
            <td class="qr"><img src="data:image/png;base64,{{ $qrBase64 }}" width="90" height="90"></td>
        </tr>
    </table>

    <h2>Section A — Requester and Activity Information</h2>
    <table>
        <tr><td class="label">Title</td><td>{{ $programme->title }}</td></tr>
        <tr><td class="label">Created by</td><td>{{ $programme->creator?->name }}</td></tr>
        <tr><td class="label">Responsible Officer</td><td>{{ $programme->responsibleOfficer?->name }}</td></tr>
        <tr><td class="label">Start / End Date</td><td>{{ $programme->start_date }} — {{ $programme->end_date }}</td></tr>
    </table>

    <h2>Section C — Proposed Venue</h2>
    <table>
        <tr><td class="label">Country / City</td><td>{{ $programme->venue_country }} / {{ $programme->venue_city }}</td></tr>
        <tr><td class="label">Proposed hotel</td><td>{{ $programme->venue_proposed_hotel }}</td></tr>
        <tr><td class="label">Accommodation required</td><td>{{ $programme->venue_accommodation_required ? 'Yes (' . $programme->venue_accommodation_count . ')' : 'No' }}</td></tr>
    </table>

    <h2>Section D — Budget and Participant Provisions</h2>
    <table>
        <tr><td class="label">Proposed DSA rate</td><td>{{ $programme->proposed_dsa_rate }}</td></tr>
        <tr><td class="label">Budget availability status</td><td>{{ $programme->budget_availability_status }}</td></tr>
        <tr><td class="label">Finance comments</td><td>{{ $programme->finance_comments }}</td></tr>
    </table>

    <h2>Section M — Conflict of Interest</h2>
    <table>
        <tr><td class="label">Declared</td><td>{{ $programme->conflict_declared ? 'Yes' : 'No' }}</td></tr>
        @if($programme->conflict_declared)
        <tr><td class="label">Details</td><td>{{ $programme->conflict_details }}</td></tr>
        <tr><td class="label">Mitigation</td><td>{{ $programme->conflict_mitigation }}</td></tr>
        <tr><td class="label">Declared by</td><td>{{ $programme->conflictDeclaredBy?->name }} on {{ $programme->conflict_declared_at }}</td></tr>
        @endif
    </table>

    <h2>Attachments</h2>
    <table>
        <tr><th>Type</th><th>Uploaded by</th><th>Date</th></tr>
        @foreach($attachments as $a)
        <tr><td>{{ $a->document_type }}</td><td>{{ $a->uploadedBy?->name }}</td><td>{{ $a->created_at?->format('d M Y H:i') }}</td></tr>
        @endforeach
    </table>

    <h2>Approval History</h2>
    <table>
        <tr><th>Stage</th><th>Approver</th><th>Decision</th><th>Date</th><th>Comment</th></tr>
        @foreach($approvalHistory as $h)
        <tr>
            <td>{{ $h['stage'] ?? '' }}</td>
            <td>{{ $h['approver'] ?? '' }}</td>
            <td>{{ $h['decision'] ?? '' }}</td>
            <td>{{ $h['date'] ?? '' }}</td>
            <td>{{ $h['comment'] ?? '' }}</td>
        </tr>
        @endforeach
    </table>

    <p>Verify this document: {{ $verifyUrl }}</p>
</body>
</html>
```

Note: the `approvalHistory` array shape must match whatever `WorkflowService::snapshot()` or the `ApprovalHistory` model actually returns for a `Programme`-backed `ApprovalRequest` — before finalizing this template, read `WorkflowService::snapshot()`'s return shape (referenced in the design spec as already returning `currentlyWith`/`currentStep`/history) and adjust the `foreach` field names (`$h['stage']` etc.) to match its real keys rather than the placeholder names guessed here.

- [ ] **Step 4: Add the service method**

In `ProgrammeService.php` (add `use Barryvdh\DomPDF\Facade\Pdf;` and `use Endroid\QrCode\Builder\Builder;` at the top):

```php
    public function generatePdf(Programme $programme): \Barryvdh\DomPDF\PDF
    {
        $programme->load(['creator', 'approver', 'responsibleOfficer', 'attachments']);

        $verifyUrl = config('app.url') . '/pif/verify/' . $programme->id;
        $qrResult  = Builder::create()->data($verifyUrl)->size(90)->build();
        $qrBase64  = base64_encode($qrResult->getString());

        $approvalHistory = app(\App\Services\WorkflowService::class)->snapshot($programme)['history'] ?? [];

        return Pdf::loadView('pdf.programme', [
            'programme'       => $programme,
            'attachments'     => $programme->attachments,
            'approvalHistory' => $approvalHistory,
            'qrBase64'        => $qrBase64,
            'verifyUrl'       => $verifyUrl,
        ])->setPaper('a4');
    }
```

Note: `WorkflowService::snapshot()` takes an `ApprovalRequest`, not a `Programme`, per the earlier-verified signature (`WorkflowService::snapshot()` at `app/Services/WorkflowService.php:323`, called via `ApprovalController::snapshot()` against an `ApprovalRequest`). Before finalizing this method, check how `Programme` relates to its `ApprovalRequest` (likely a `morphOne`, mirroring `ProcurementRequest::approvalRequest()` verified earlier) — if `Programme` doesn't yet expose an `approvalRequest()` relation, add one (`return $this->morphOne(ApprovalRequest::class, 'approvable');`) before calling `snapshot()` on it, and pass the resolved `ApprovalRequest`, not the `Programme`, into `snapshot()`.

- [ ] **Step 5: Add the controller method and route**

In `ProgrammeController.php`:

```php
    public function pdf(Programme $programme)
    {
        $pdf = $this->service->generatePdf($programme);
        return $pdf->stream("PIF-{$programme->reference_number}.pdf");
    }
```

In `routes/api.php`, inside the `programmes` prefix group:

```php
            Route::get('{programme}/pdf', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'pdf']);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `php artisan test tests/Feature/Programmes/ProgrammePdfTest.php`
Expected: PASS. If it fails due to the `WorkflowService::snapshot()` signature mismatch noted above, fix the call site to match the real method signature before re-running — do not leave a broken call in place.

- [ ] **Step 7: Commit**

```bash
git add api/resources/views/pdf/programme.blade.php \
        api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammePdfTest.php
git commit -m "feat(pif): generate a complete PIF PDF with QR verification and approval history"
```

---

## Phase 8 — Controlled Amendment Workflow

### Task 16: `createAmendment()` and `submit-amendment`

**Files:**
- Modify: `api/app/Modules/Programmes/Services/ProgrammeService.php`
- Modify: `api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/Programmes/ProgrammeAmendmentTest.php`

- [ ] **Step 1: Write the failing tests**

```php
<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeAmendmentTest extends TestCase
{
    private function approvedProgramme(Tenant $tenant, int $userId): Programme
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-2026-001', 'title' => 'Amendment Test',
            'status' => 'approved', 'approved_at' => now(), 'venue_country' => 'Namibia',
        ]);
        ProgrammeDocument::create(['programme_id' => $programme->id, 'title' => 'Agenda', 'document_type' => 'agenda', 'owner_name' => 'Jane']);
        return $programme;
    }

    public function test_amendment_can_only_be_created_from_an_approved_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $draft = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-2026-002', 'title' => 'Draft', 'status' => 'draft',
        ]);

        $http->postJson("/api/v1/programmes/{$draft->id}/amend")->assertUnprocessable();
    }

    public function test_amendment_clones_the_original_and_its_documents(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertCreated();
        $amendmentId = $response->json('data.id');

        $this->assertDatabaseHas('programmes', [
            'id' => $amendmentId, 'status' => 'amendment_draft', 'amended_from_id' => $original->id,
            'venue_country' => 'Namibia',
        ]);
        $this->assertDatabaseHas('programme_documents', [
            'programme_id' => $amendmentId, 'title' => 'Agenda',
        ]);
    }

    public function test_only_one_open_amendment_allowed_at_a_time(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertCreated();
        $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertUnprocessable();
    }

    public function test_approving_an_amendment_supersedes_the_original(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        [$adminHttp] = $this->asAdmin($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');
        $http->postJson("/api/v1/programmes/{$amendmentId}/submit-amendment")->assertOk();
        $adminHttp->postJson("/api/v1/programmes/{$amendmentId}/approve")->assertOk();

        $this->assertDatabaseHas('programmes', ['id' => $amendmentId, 'status' => 'amended']);
        $this->assertDatabaseHas('programmes', ['id' => $original->id, 'status' => 'superseded']);
    }

    public function test_diff_endpoint_shows_changed_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);
        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');

        $http->putJson("/api/v1/programmes/{$amendmentId}", ['venue_city' => 'Windhoek'])->assertOk();

        $response = $http->getJson("/api/v1/programmes/{$amendmentId}/diff")->assertOk();
        $this->assertArrayHasKey('venue_city', $response->json('data'));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/Programmes/ProgrammeAmendmentTest.php`
Expected: FAIL — none of these endpoints exist.

- [ ] **Step 3: Add service methods**

In `ProgrammeService.php`:

```php
    public function createAmendment(Programme $original, User $user): Programme
    {
        if (!$original->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved programmes can be amended.']);
        }

        $openAmendmentExists = Programme::where('amended_from_id', $original->id)
            ->whereIn('status', ['amendment_draft', 'amendment_pending_approval'])
            ->exists();
        if ($openAmendmentExists) {
            throw ValidationException::withMessages(['amendment' => 'An open amendment already exists for this PIF.']);
        }

        $revisionCount = Programme::where('amended_from_id', $original->id)->count() + 1;

        $attributes = $original->only([
            'tenant_id', 'strategic_alignment', 'strategic_pillar', 'strategic_pillars',
            'implementing_department', 'implementing_departments', 'supporting_departments',
            'background', 'overall_objective', 'specific_objectives', 'expected_outputs',
            'target_beneficiaries', 'gender_considerations', 'primary_currency', 'base_currency',
            'exchange_rate', 'contingency_pct', 'total_budget', 'funding_source', 'funding_sources',
            'responsible_officer_id', 'responsible_officer_ids', 'start_date', 'end_date',
            'travel_required', 'delegates_count', 'member_states', 'travel_services',
            'procurement_required', 'media_options',
            'venue_country', 'venue_city', 'venue_proposed_hotel', 'venue_accommodation_required',
            'venue_accommodation_count', 'venue_conferencing_required', 'venue_conferencing_participants',
            'venue_quotation_attached', 'venue_hotel_quotation_attached', 'venue_accessibility_requirements',
            'venue_security_considerations', 'venue_comments',
            'proposed_dsa_rate', 'original_budget_rate', 'proposed_participants', 'budgeted_participants',
            'proposed_funding_difference', 'estimated_activity_amount',
            'secretariat_staff_required', 'secretariat_staff_count', 'consultants_required', 'consultants_count',
            'consultants_rate', 'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
            'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate', 'media_liaison_required',
            'media_liaison_count', 'local_support_required', 'local_support_count', 'local_support_rate',
            'personnel_comments',
            'interpretation_required', 'en_fr_required', 'en_fr_interpreters_count', 'en_pt_required',
            'en_pt_interpreters_count', 'fr_pt_required', 'fr_pt_interpreters_count', 'interpreter_rate',
            'interpreter_source', 'interpreter_source_other_note', 'interpretation_equipment_required',
            'translation_required', 'languages_required', 'interpretation_comments',
            'support_services', 'support_services_other_note',
        ])->toArray();

        $amendment = Programme::create(array_merge($attributes, [
            'created_by'        => $user->id,
            'reference_number'  => "{$original->reference_number}-A{$revisionCount}",
            'title'             => $original->title,
            'status'            => 'amendment_draft',
            'amended_from_id'   => $original->id,
        ]));

        foreach ($original->documents as $doc) {
            $amendment->documents()->create($doc->only([
                'title', 'document_type', 'word_count', 'translation_required', 'source_language',
                'target_languages', 'owner_user_id', 'owner_name', 'owner_organisation', 'deadline',
                'budget_line', 'comments',
            ]));
        }
        foreach ($original->arrivalDepartures as $row) {
            $amendment->arrivalDepartures()->create($row->only([
                'category', 'arrival_date', 'departure_date', 'airport', 'flight_details',
                'transport_required', 'accommodation_required', 'comments',
            ]));
        }
        foreach ($original->procurementItems as $item) {
            $amendment->procurementItems()->create($item->only([
                'description', 'estimated_cost', 'method', 'vendor', 'delivery_date', 'currency', 'rfq_required',
                // procurement_request_id intentionally excluded — re-evaluated for the amendment
            ]));
        }

        AuditLog::record('programme.amendment_created', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $amendment->id,
            'new_values'     => ['amended_from_id' => $original->id],
            'tags'           => 'programme',
        ]);

        return $amendment->fresh(['documents', 'arrivalDepartures', 'procurementItems']);
    }

    public function submitAmendment(Programme $amendment): Programme
    {
        if ($amendment->status !== 'amendment_draft') {
            throw ValidationException::withMessages(['status' => 'Only an amendment draft can be submitted.']);
        }
        $amendment->update(['status' => 'amendment_pending_approval', 'submitted_at' => now()]);
        return $amendment->fresh();
    }

    public function diff(Programme $amendment): array
    {
        if (!$amendment->amended_from_id) {
            return [];
        }
        $original = $amendment->amendedFrom;
        $fields = array_diff($amendment->getFillable(), ['id', 'created_at', 'updated_at', 'amended_from_id', 'status', 'reference_number']);

        $diff = [];
        foreach ($fields as $field) {
            $before = $original->{$field};
            $after  = $amendment->{$field};
            if ($before != $after) {
                $diff[$field] = ['before' => $before, 'after' => $after];
            }
        }
        return $diff;
    }
```

Update `approve()` to handle the amendment path — supersede the original when an amendment is approved. Modify the existing `approve()` method's status check and add the supersede step:

```php
    public function approve(Programme $programme, User $approver): Programme
    {
        $isAmendment = $programme->status === 'amendment_pending_approval';

        if (!$isAmendment && !$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be approved.']);
        }

        if ($programme->created_by && (int) $programme->created_by === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $programme->update([
            'status'      => $isAmendment ? 'amended' : 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        if ($isAmendment && $programme->amended_from_id) {
            $programme->amendedFrom?->update(['status' => 'superseded', 'superseded_at' => now()]);
            AuditLog::record('programme.superseded', [
                'auditable_type' => Programme::class,
                'auditable_id'   => $programme->amended_from_id,
                'tags'           => 'programme',
            ]);
        }

        AuditLog::record($isAmendment ? 'programme.amendment_approved' : 'programme.approved', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        $this->notifyMeOfPifApproval($programme);

        return $programme->fresh(['creator', 'approver']);
    }
```

- [ ] **Step 4: Add controller methods and routes**

In `ProgrammeController.php`:

```php
    public function amend(Request $request, Programme $programme): JsonResponse
    {
        $amendment = $this->service->createAmendment($programme, $request->user());
        return response()->json(['message' => 'Amendment created.', 'data' => $amendment], 201);
    }

    public function submitAmendment(Programme $programme): JsonResponse
    {
        $amendment = $this->service->submitAmendment($programme);
        return response()->json(['message' => 'Amendment submitted.', 'data' => $amendment]);
    }

    public function diff(Programme $programme): JsonResponse
    {
        return response()->json(['data' => $this->service->diff($programme)]);
    }
```

In `routes/api.php`, inside the `programmes` prefix group:

```php
            Route::post('{programme}/amend', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'amend']);
            Route::post('{programme}/submit-amendment', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'submitAmendment']);
            Route::get('{programme}/diff', [\App\Http\Controllers\Api\V1\Programmes\ProgrammeController::class, 'diff']);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test tests/Feature/Programmes/ProgrammeAmendmentTest.php`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add api/app/Modules/Programmes/Services/ProgrammeService.php \
        api/app/Http/Controllers/Api/V1/Programmes/ProgrammeController.php \
        api/routes/api.php \
        api/tests/Feature/Programmes/ProgrammeAmendmentTest.php
git commit -m "feat(pif): add controlled amendment workflow (draft, submit, approve-supersedes-original, diff)"
```

---

## Phase 9 — Frontend

### Task 17: Extend `programmeApi` client with all new endpoints

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add the new client methods**

In `web/lib/api.ts`, inside the `programmeApi` object (after the existing procurement-items block, matching the exact pattern shown for `addBudgetLine`/`updateBudgetLine`/`deleteBudgetLine` at lines 2612+):

```typescript
  // Finance review
  updateFinanceReview: (programmeId: number, data: { budget_availability_status: string; finance_comments?: string }) =>
    api.put<{ data: Programme; message: string }>(`/programmes/${programmeId}/finance-review`, data),

  // Documents
  addDocument: (programmeId: number, data: Record<string, unknown>) =>
    api.post<{ data: any; message: string }>(`/programmes/${programmeId}/documents`, data),
  updateDocument: (programmeId: number, documentId: number, data: Record<string, unknown>) =>
    api.put<{ data: any; message: string }>(`/programmes/${programmeId}/documents/${documentId}`, data),
  deleteDocument: (programmeId: number, documentId: number) =>
    api.delete(`/programmes/${programmeId}/documents/${documentId}`),

  // Arrival / Departure
  addArrivalDeparture: (programmeId: number, data: Record<string, unknown>) =>
    api.post<{ data: any; message: string }>(`/programmes/${programmeId}/arrival-departures`, data),
  updateArrivalDeparture: (programmeId: number, rowId: number, data: Record<string, unknown>) =>
    api.put<{ data: any; message: string }>(`/programmes/${programmeId}/arrival-departures/${rowId}`, data),
  deleteArrivalDeparture: (programmeId: number, rowId: number) =>
    api.delete(`/programmes/${programmeId}/arrival-departures/${rowId}`),

  // Procurement transfer
  sendToProcurement: (programmeId: number, data: { procurement_item_ids: number[]; request_title: string }) =>
    api.post<{ data: any; message: string }>(`/programmes/${programmeId}/send-to-procurement`, data),

  // PDF
  pdfUrl: (programmeId: number) => `/programmes/${programmeId}/pdf`,

  // Amendment
  amend: (programmeId: number) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${programmeId}/amend`),
  submitAmendment: (programmeId: number) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${programmeId}/submit-amendment`),
  diff: (programmeId: number) =>
    api.get<{ data: Record<string, { before: unknown; after: unknown }> }>(`/programmes/${programmeId}/diff`),
```

- [ ] **Step 2: Update `submit()` to require declaration confirmation**

Change the existing `submit` method (line 2621-2622) to accept the new required body:

```typescript
  submit: (id: number, data: { declaration_confirmed: boolean }) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${id}/submit`, data),
```

- [ ] **Step 3: Verify the frontend still type-checks**

Run: `cd web && npx tsc --noEmit`
Expected: New errors will appear at every existing `programmeApi.submit(id)` call site (now missing the required argument) — this is expected and intentional; Task 20 fixes the one real call site in `pif/[id]/edit/page.tsx`. Do not silence this by making the parameter optional — the whole point of this change is to make the missing declaration a compile error, not a runtime one.

- [ ] **Step 4: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat(pif): add frontend API client methods for finance-review, documents, arrival-departure, procurement transfer, PDF, and amendments"
```

---

### Task 18: Draft-first `pif/create` page

**Files:**
- Modify: `web/app/(app)/pif/create/page.tsx`

- [ ] **Step 1: Read the current file in full before editing**

Run: `wc -l "web/app/(app)/pif/create/page.tsx"` (already known: 1253 lines) — read the file's top-level component structure (the final `return` / submit handler) to identify exactly what currently happens on submit, since this task replaces "build the whole form then POST once" with "POST immediately, then redirect to the edit page for everything else."

- [ ] **Step 2: Replace the page with a minimal draft-and-redirect shell**

Replace the page component's body with something functionally equivalent to (adjust imports/names to match what's actually exported from `@/lib/api` and the existing layout wrapper used elsewhere in the file — do not drop the existing page's layout chrome, e.g. header/breadcrumbs, if `pif/[id]/edit/page.tsx` doesn't already provide it):

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { programmeApi } from "@/lib/api";

export default function PifCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await programmeApi.create({ title: `Untitled PIF — ${new Date().toLocaleString()}` });
        if (!cancelled) {
          router.replace(`/pif/${res.data.data.id}/edit`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not start a new PIF draft.");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }
  return <div className="p-6">Creating your PIF draft…</div>;
}
```

Note: the exact shape of `programmeApi.create()`'s response (`res.data.data.id` vs `res.data.id`, depending on how the shared `api` axios wrapper unwraps responses elsewhere in this file) must match the actual usage already present in the ~1253-line file being replaced — grep the current file for `.create(` or `.data.id` before finalizing this snippet, and use the same unwrapping pattern already established there.

- [ ] **Step 3: Manually verify in the browser**

Run: `cd web && npm run dev`, then navigate to `/pif/create`. Expected: brief loading message, then an immediate redirect to `/pif/{new-id}/edit`, and the new draft is visible in "My Drafts"/"My Submitted PIFs" per existing list views.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/pif/create/page.tsx"
git commit -m "feat(pif): make PIF creation draft-first — immediately create a draft and redirect to the edit page"
```

---

### Task 19: `pif/{id}/edit` — new sections (Venue, Budget Variance, Personnel, Interpretation)

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx`

- [ ] **Step 1: Read the current edit page in full**

The file is currently only 247 lines (much smaller than `create/page.tsx`, per the earlier `wc -l` output) — it likely delegates most field rendering to shared components also used by `create/page.tsx`. Read it fully before editing, and identify whether it reuses a shared form component (likely, given its small size relative to `create`) — if so, the new sections should be added to that shared component, not duplicated into both files. Locate the shared component (grep the `create/page.tsx` and `edit/page.tsx` for a common import) before writing any new JSX.

- [ ] **Step 2: Add state and fields for Venue, Budget Variance, Personnel, and Interpretation**

Add `useState` hooks for each new field (following the exact naming/typing convention visible in `create/page.tsx`'s existing hooks, e.g. `const [venueCountry, setVenueCountry] = useState("");`, `const [venueAccommodationRequired, setVenueAccommodationRequired] = useState(false);`), and render them as a new step/section in whatever step-wizard or form-section mechanism the shared component already uses (verified: `create/page.tsx` uses a `step` numeric state variable, not an accordion — follow that same convention, adding new step numbers rather than introducing an unrelated UI pattern). Each conditional field (e.g. `venue_accommodation_count`) is only rendered when its `_required` boolean is checked, mirroring the conditional rendering already used for `alignmentOther`/`pillarOther` in the existing file (`{alignments.includes('Other') && <input ... />}`-style pattern — grep for one such existing conditional block and match its structure exactly).

- [ ] **Step 3: Wire the new fields into the existing save/update call**

Locate the existing `programmeApi.update(...)` call site in the edit page and add the new fields to its payload object, using the same `snake_case` keys defined in the backend validation (Task 7).

- [ ] **Step 4: Manually verify in the browser**

Run: `cd web && npm run dev`, navigate to an existing draft's edit page, fill in Venue/Budget/Personnel/Interpretation fields, save, reload the page, and confirm the values persist (i.e., the `GET /programmes/{id}` response is correctly mapped back into the new `useState` hooks on load — check how the existing fields do this, e.g. `useEffect` populating state from a fetched `programme` object, and follow the same pattern).

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): add Venue, Budget Variance, Personnel, and Interpretation sections to the PIF edit form"
```

---

### Task 20: `pif/{id}/edit` — Documents and Arrival/Departure repeatable rows, Support Services, Conflict of Interest, and single Declaration

**Files:**
- Modify: `web/app/(app)/pif/[id]/edit/page.tsx` (or the shared form component identified in Task 19)

- [ ] **Step 1: Add repeatable-row UI for Documents**

Following the existing repeatable-row pattern already used for `fundingSources`/`specificObjectives`/`activities` in `create/page.tsx` (each has an `id`, an add-row button, a remove-row button, and inline field inputs per row), add a `documents` list backed by the real nested endpoints from Task 3 rather than local-only state: on add, call `programmeApi.addDocument(programmeId, {...})` immediately (not batched with the rest of the form) and store the returned row's real `id`; on field blur, call `programmeApi.updateDocument(...)`; on remove, call `programmeApi.deleteDocument(...)`. This matches the draft-first architecture from Task 18 — every row is persisted immediately, not held only in frontend state until a final submit.

- [ ] **Step 2: Add repeatable-row UI for Arrival/Departure**

Same pattern as Step 1, using `programmeApi.addArrivalDeparture`/`updateArrivalDeparture`/`deleteArrivalDeparture`, with a date-picker pair for `arrival_date`/`departure_date` and client-side validation that departure is not before arrival (matching the server-side rule from Task 4) so the error surfaces before the API round-trip.

- [ ] **Step 3: Add Support Services checkboxes**

A checkbox group for the 18 keys listed in the spec, storing selections as `support_services: string[]` in component state, with an `support_services_other_note` text input that only renders when `"other"` is checked — mirroring the existing `alignmentOther`-style conditional pattern.

- [ ] **Step 4: Add Conflict of Interest section**

Fields: `conflict_declared` checkbox, `conflict_details`/`conflict_mitigation` textareas that only render (and are marked required in the UI) when `conflict_declared` is checked. Do **not** render or submit `conflict_declared_by`/`conflict_declared_at` — those are server-stamped only, confirmed in Task 7.

- [ ] **Step 5: Replace the five-checkbox declaration concept with a single confirmation**

At the bottom of the form, before the Submit button, render the declaration text from a hardcoded string matching `config('pif.declaration_versions.v1')`'s content exactly (or fetch it from a new lightweight endpoint if one is added later — for this task, hardcoding the current version's text client-side is acceptable since the server is the source of truth for what was actually agreed via `declaration_version`), with a single checkbox. Disable the Submit button until it's checked. Update the submit handler to call `programmeApi.submit(programmeId, { declaration_confirmed: true })`, matching the client method signature changed in Task 17.

- [ ] **Step 6: Manually verify in the browser**

Run: `cd web && npm run dev`. Add/edit/remove document rows and arrival-departure rows, confirm each persists independently (reload mid-way through and confirm rows already added survive). Check the conflict-of-interest conditional fields. Confirm Submit is disabled until the declaration checkbox is checked, and that submitting without checking it is impossible from the UI (backend already rejects it per Task 10 regardless).

- [ ] **Step 7: Commit**

```bash
git add "web/app/(app)/pif/[id]/edit/page.tsx"
git commit -m "feat(pif): add Documents/Arrival-Departure repeatable rows, Support Services, Conflict of Interest, and single declaration to the PIF edit form"
```

---

### Task 21: `pif/{id}/page.tsx` — read-only sections, M&E status, PDF download, Amend action

**Files:**
- Modify: `web/app/(app)/pif/[id]/page.tsx`

- [ ] **Step 1: Add read-only display blocks for all new sections**

Mirror the existing read-only rendering pattern already used in this 1302-line file for existing sections (grep for how e.g. `funding_sources` or `budget_lines` are displayed read-only, and match that structure) for: Venue, Budget/Participant Provisions (showing `budget_availability_status`/`finance_comments` to everyone as read-only info, since only the finance-review endpoint can change them — no permission check needed here, the field is just never editable from this page), Personnel, Interpretation, Documents (list with each row's owner shown as either the linked user's name or the free-text `owner_name`/`owner_organisation`), Arrival/Departure, Support Services, Conflict of Interest.

- [ ] **Step 2: Add the M&E status block**

Render `programme.me_status` (now included in the API response per Task 11) through a human-readable label map:

```typescript
const ME_STATUS_LABELS: Record<string, string> = {
  not_yet_linked: "Not Yet Linked",
  report_pending: "Report Pending",
  report_submitted: "Report Submitted",
  returned_for_correction: "Returned for Correction",
  me_reviewed: "M&E Reviewed",
  accepted: "Accepted",
  closed: "Closed",
  linked_record_archived: "Linked Record Archived",
  link_unavailable: "Link Unavailable",
};
```

Display `ME_STATUS_LABELS[programme.me_status] ?? programme.me_status` in a read-only info block, with a link to the M&E record only when a live (non-archived, non-unlinked) status is present.

- [ ] **Step 3: Add the PDF download action**

A button/link that opens `` `${API_BASE_URL}${programmeApi.pdfUrl(programme.id)}` `` in a new tab (matching however other PDF/download links in the codebase already construct their URL — check `SaamService`-related download links in `web/lib/api.ts` or elsewhere for the established pattern of building an absolute download URL with the auth token, since a plain `<a href>` won't carry the Sanctum bearer token; reuse whatever mechanism already handles this for existing downloads, e.g. the attachment `download` endpoints).

- [ ] **Step 4: Add the Amend action**

Visible only when `programme.status === 'approved'` and the current user has `pif.approve` (check however permission checks are already surfaced client-side elsewhere in this codebase, e.g. a `usePermissions()` hook or similar). On click, call `programmeApi.amend(programme.id)` and redirect to the returned amendment's edit page. When viewing an amendment (`programme.amended_from_id` present, `status` in `amendment_draft`/`amendment_pending_approval`), show a "View Changes" link that calls `programmeApi.diff(programme.id)` and renders the before/after pairs in a simple table.

- [ ] **Step 5: Manually verify in the browser**

Run: `cd web && npm run dev`. View an approved PIF: confirm the M&E status block shows "Not Yet Linked" by default, the PDF downloads correctly, and the Amend button appears and creates a working amendment draft. View an amendment: confirm the diff view shows only the fields actually changed.

- [ ] **Step 6: Commit**

```bash
git add "web/app/(app)/pif/[id]/page.tsx"
git commit -m "feat(pif): add read-only section display, M&E status block, PDF download, and amendment view/diff to the PIF view page"
```

---

## Phase 10 — Regression and E2E

### Task 22: Full backend regression run

**Files:** none (verification task)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd api && php artisan test`
Expected: All tests pass, including every pre-existing suite (`ApprovalFlowTest`, HR/Leave/Travel/Procurement/M&E tests, etc.) alongside all new `Programmes` tests from this plan. If any pre-existing test fails, diagnose whether it's a genuine regression from this plan's changes (most likely culprit: the `store()`/`update()` validation changes in Task 7, or the `approve()` signature change in Task 16) versus pre-existing flakiness, and fix the regression before proceeding — do not skip or delete a failing pre-existing test to make the suite green.

- [ ] **Step 2: Commit any regression fixes**

```bash
git add -A
git commit -m "fix(pif): resolve regressions surfaced by full backend test suite run"
```
(Only run this commit if Step 1 actually required changes — otherwise skip.)

---

### Task 23: Frontend Playwright coverage for the new PIF flow

**Files:**
- Create: `web/tests/e2e/pif-sections.spec.ts` (check `web/tests/e2e/` for the actual naming/structure convention already in use — e.g. `web/tests/e2e/global.setup.ts` was seen modified in git status, confirming this directory is the right location; match whatever existing spec file's structure most closely resembles a full-form-flow test, such as an existing travel or leave e2e spec, rather than starting from a blank template)

- [ ] **Step 1: Read an existing full-flow e2e spec for the exact conventions**

Run: `find web/tests/e2e -iname "*.spec.ts"` and read one that exercises a multi-section create-and-submit flow (travel or leave, most likely) to match its login/auth setup, selector conventions, and assertion style exactly.

- [ ] **Step 2: Write the happy-path spec**

Cover, in one flow: navigate to `/pif/create`, confirm redirect to `/pif/{id}/edit`, fill Venue/Budget/Personnel/Interpretation/Support Services/Conflict of Interest sections, add one Document row and one Arrival/Departure row, confirm the declaration checkbox is required to enable Submit, submit, and verify the resulting `/pif/{id}` view page renders the entered values and shows M&E status as "Not Yet Linked".

- [ ] **Step 3: Run the spec**

Run: `cd web && npx playwright test tests/e2e/pif-sections.spec.ts`
Expected: PASS (requires the dev API and web servers running per whatever `sadcpf-playwright-e2e` / `webapp-testing` convention this repo already uses — check `web/playwright.config.ts` for `webServer` auto-start configuration before assuming servers must be started manually).

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/pif-sections.spec.ts
git commit -m "test(pif): add Playwright coverage for the full PIF section-completion happy path"
```

---

## Self-Review Notes (for the implementer, not a task)

- **Spec coverage:** Revisions 1 (no M&E fields — Task 2), 2 (intake notification — Tasks 12–13), 3 (draft-first — Tasks 6, 18), 4 (batched procurement — Task 14), 5 (PDF — Task 15), 6 (single declaration — Task 10), 7 (flexible document owner — Task 3), 8 (honest M&E status — Tasks 2, 11), 9 (array-safe validation — Task 7), 10 (amendments — Task 16) are each covered by at least one task.
- **Known integration risks flagged inline, not silently assumed:** the exact `WorkflowService::snapshot()` input type and return shape (Task 15), the exact `Programme::approvalRequest()` relation existence (Task 15), the exact `dispatchToMany()` per-recipient `{{name}}` resolution (Task 13), the exact Finance Controller test-helper method name (Task 9), and the shared-vs-duplicated form component between `create`/`edit` pages (Task 19) — each of these is called out as "verify before assuming" rather than guessed outright, because they depend on code this plan's author did not read in full line-by-line.
- **Type consistency check:** `me_status` is used identically as the accessor name (`getMeStatusAttribute` → `$programme->me_status`) in Tasks 2, 11, and the frontend `ME_STATUS_LABELS` map in Task 21. `declaration_confirmed` is used identically as the submit-payload key across Task 10 (backend) and Tasks 17/20 (frontend). `procurement_item_ids`/`request_title` match identically between Task 14's backend validation and Task 17's frontend client method.
