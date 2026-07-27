<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_capitalisation_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('version', 32);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->decimal('threshold_amount', 14, 2);
            $table->string('threshold_currency', 8)->default('USD');
            $table->unsignedSmallInteger('min_useful_life_years')->default(1);
            $table->json('categories_affected')->nullable();
            $table->text('donor_specific_treatment')->nullable();
            $table->string('approved_by')->nullable();
            $table->string('source_document')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'version']);
            $table->index(['tenant_id', 'is_active', 'effective_from']);
        });

        Schema::create('asset_depreciation_rate_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('version', 32);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('method', 32)->default('straight_line');
            $table->json('category_rates'); // { "it": {"years": 3, "rate_pct": 33.33}, ... }
            $table->string('approved_by')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'version']);
        });

        Schema::create('asset_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->string('building')->nullable();
            $table->string('floor')->nullable();
            $table->string('room')->nullable();
            $table->string('location_type', 32)->default('office'); // office, warehouse, residence, meeting_room, shared
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->string('asset_class', 32)->nullable()->after('category'); // capital | controlled
            $table->string('serial_number', 128)->nullable()->after('asset_code');
            $table->string('tag_number', 64)->nullable()->after('serial_number');
            $table->string('manufacturer', 128)->nullable()->after('name');
            $table->string('model', 128)->nullable()->after('manufacturer');
            $table->string('condition', 32)->nullable()->after('status'); // new, good, fair, poor, damaged
            $table->string('funding_source', 128)->nullable();
            $table->string('donor_name', 128)->nullable();
            $table->text('donor_restrictions')->nullable();
            $table->string('department', 128)->nullable();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->date('warranty_expiry')->nullable();
            $table->string('warranty_provider', 128)->nullable();
            $table->foreignId('capitalisation_policy_id')->nullable()->constrained('asset_capitalisation_policies')->nullOnDelete();
            $table->decimal('accumulated_depreciation', 14, 2)->nullable();
            $table->decimal('book_value', 14, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamp('acknowledgement_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('serial_duplicate_override')->default(false);
            $table->index(['tenant_id', 'asset_class']);
            $table->index(['tenant_id', 'serial_number']);
            $table->index(['tenant_id', 'tag_number']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_assignment_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('department')->nullable();
            $table->string('assignment_type', 32)->default('custody'); // custody, loan, shared
            $table->timestamp('assigned_at');
            $table->timestamp('returned_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['asset_id', 'returned_at']);
        });

        Schema::create('asset_location_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->string('location_label')->nullable();
            $table->timestamp('moved_at');
            $table->foreignId('moved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['asset_id', 'moved_at']);
        });

        Schema::create('asset_disposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 64);
            $table->string('status', 32)->default('draft'); // draft, recommended, finance_reviewed, approved, completed, rejected
            $table->string('reason', 64); // obsolete, damaged, lost, stolen, surplus, other
            $table->string('method', 64)->nullable(); // sale, donation, scrap, write_off, transfer
            $table->text('justification');
            $table->decimal('estimated_value', 14, 2)->nullable();
            $table->decimal('proceeds', 14, 2)->nullable();
            $table->string('accounting_reference')->nullable();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('hod_recommended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('hod_recommended_at')->nullable();
            $table->text('hod_comments')->nullable();
            $table->foreignId('finance_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finance_reviewed_at')->nullable();
            $table->text('finance_comments')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_verification_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('status', 32)->default('open'); // open, closed
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('asset_verification_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('asset_verification_campaigns')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('result', 32); // verified, missing, damaged, unregistered, relocated
            $table->string('condition', 32)->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['campaign_id', 'asset_id']);
        });

        Schema::create('asset_maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('maintenance_type', 32)->default('corrective'); // preventive, corrective, warranty
            $table->string('status', 32)->default('open'); // open, in_progress, completed, cancelled
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('scheduled_on')->nullable();
            $table->date('completed_on')->nullable();
            $table->decimal('cost', 14, 2)->nullable();
            $table->string('vendor')->nullable();
            $table->boolean('under_warranty')->default(false);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['asset_id', 'status']);
        });

        Schema::create('asset_depreciation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('policy_id')->nullable()->constrained('asset_depreciation_rate_policies')->nullOnDelete();
            $table->date('run_date');
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 32)->default('completed');
            $table->foreignId('run_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('asset_count')->default(0);
            $table->decimal('total_depreciation', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('asset_depreciation_run_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('run_id')->constrained('asset_depreciation_runs')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->decimal('opening_book_value', 14, 2);
            $table->decimal('depreciation_amount', 14, 2);
            $table->decimal('closing_book_value', 14, 2);
            $table->decimal('accumulated_depreciation', 14, 2);
            $table->timestamps();
            $table->unique(['run_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_depreciation_run_lines');
        Schema::dropIfExists('asset_depreciation_runs');
        Schema::dropIfExists('asset_maintenance_records');
        Schema::dropIfExists('asset_verification_results');
        Schema::dropIfExists('asset_verification_campaigns');
        Schema::dropIfExists('asset_disposals');
        Schema::dropIfExists('asset_location_histories');
        Schema::dropIfExists('asset_assignment_histories');

        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
            $table->dropConstrainedForeignId('capitalisation_policy_id');
            $table->dropConstrainedForeignId('acknowledged_by');
            $table->dropColumn([
                'asset_class', 'serial_number', 'tag_number', 'manufacturer', 'model', 'condition',
                'funding_source', 'donor_name', 'donor_restrictions', 'department',
                'warranty_expiry', 'warranty_provider', 'accumulated_depreciation', 'book_value',
                'currency', 'last_verified_at', 'acknowledgement_at', 'serial_duplicate_override',
            ]);
        });

        Schema::dropIfExists('asset_locations');
        Schema::dropIfExists('asset_depreciation_rate_policies');
        Schema::dropIfExists('asset_capitalisation_policies');
    }
};
