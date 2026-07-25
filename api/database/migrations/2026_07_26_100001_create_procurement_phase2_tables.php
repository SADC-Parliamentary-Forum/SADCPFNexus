<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tender_committees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 40)->nullable();
            $table->unsignedTinyInteger('quorum_minimum')->default(3);
            $table->boolean('is_standing')->default(true);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'is_active']);
        });

        Schema::create('tender_committee_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tender_committee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32)->default('member'); // chair|secretary|member
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();
            $table->unique(['tender_committee_id', 'user_id']);
        });

        Schema::create('tender_committee_meetings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tender_committee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tender_id')->nullable();
            $table->timestamp('held_at');
            $table->string('title');
            $table->unsignedSmallInteger('members_present')->default(0);
            $table->boolean('quorum_met')->default(false);
            $table->string('minutes_url')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('tenders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tender_committee_id')->nullable()->constrained('tender_committees')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->text('notice')->nullable();
            $table->string('status', 32)->default('draft');
            // draft|published|closed|opened|evaluating|awarded|cancelled
            $table->boolean('sealed_mode')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->date('submission_deadline')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('bids_opened_at')->nullable();
            $table->foreignId('bids_opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('evaluation_started_at')->nullable();
            $table->decimal('technical_weight', 5, 2)->default(80);
            $table->decimal('financial_weight', 5, 2)->default(20);
            $table->decimal('min_technical_score', 5, 2)->default(70);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique('procurement_request_id');
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('tender_committee_meetings', function (Blueprint $table) {
            $table->foreign('tender_id')->references('id')->on('tenders')->nullOnDelete();
        });

        Schema::create('contract_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('currency', 10)->default('NAD');
            $table->string('status', 32)->default('pending');
            // pending|in_progress|completed|overdue
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['contract_id', 'status']);
        });

        Schema::create('annual_procurement_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('plan_year');
            $table->string('title');
            $table->string('status', 32)->default('draft'); // draft|active|archived
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'plan_year']);
        });

        Schema::create('annual_procurement_plan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('annual_procurement_plan_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->string('category', 64)->nullable();
            $table->decimal('estimated_value', 15, 2)->default(0);
            $table->string('currency', 10)->default('NAD');
            $table->string('suggested_method', 40)->nullable();
            $table->unsignedTinyInteger('quarter')->nullable(); // 1-4
            $table->string('status', 32)->default('planned');
            $table->foreignId('procurement_request_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('vendor_catalogue_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 80)->nullable();
            $table->string('item_name');
            $table->string('unit', 40)->default('unit');
            $table->decimal('unit_price', 15, 4);
            $table->string('currency', 10)->default('NAD');
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'vendor_id', 'is_active']);
        });

        Schema::create('vendor_catalogue_item_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_catalogue_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->decimal('unit_price', 15, 4);
            $table->string('currency', 10)->default('NAD');
            $table->string('unit', 40)->default('unit');
            $table->text('change_reason')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('changed_at');
            $table->timestamps();
            $table->unique(['vendor_catalogue_item_id', 'version'], 'catalogue_item_version_unique');
        });

        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->foreignId('split_authorised_by')->nullable()->after('split_justification')->constrained('users')->nullOnDelete();
            $table->timestamp('split_authorised_at')->nullable()->after('split_authorised_by');
            $table->text('split_authorisation_notes')->nullable()->after('split_authorised_at');
        });

        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->unsignedInteger('version')->default(1)->after('quoted_amount');
            $table->foreignId('supersedes_quote_id')->nullable()->after('version')->constrained('procurement_quotes')->nullOnDelete();
            $table->decimal('technical_score', 5, 2)->nullable()->after('compliance_notes');
            $table->string('envelope', 32)->default('combined')->after('technical_score');
            $table->boolean('is_current')->default(true)->after('envelope');
        });

        Schema::table('attachments', function (Blueprint $table) {
            $table->date('expires_at')->nullable()->after('document_type');
        });

        $this->grantTables([
            'tender_committees',
            'tender_committee_members',
            'tender_committee_meetings',
            'tenders',
            'contract_milestones',
            'annual_procurement_plans',
            'annual_procurement_plan_items',
            'vendor_catalogue_items',
            'vendor_catalogue_item_versions',
        ]);
    }

    public function down(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });

        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supersedes_quote_id');
            $table->dropColumn(['version', 'technical_score', 'envelope', 'is_current']);
        });

        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('split_authorised_by');
            $table->dropColumn(['split_authorised_at', 'split_authorisation_notes']);
        });

        Schema::dropIfExists('vendor_catalogue_item_versions');
        Schema::dropIfExists('vendor_catalogue_items');
        Schema::dropIfExists('annual_procurement_plan_items');
        Schema::dropIfExists('annual_procurement_plans');
        Schema::dropIfExists('contract_milestones');

        Schema::table('tender_committee_meetings', function (Blueprint $table) {
            $table->dropForeign(['tender_id']);
        });

        Schema::dropIfExists('tenders');
        Schema::dropIfExists('tender_committee_meetings');
        Schema::dropIfExists('tender_committee_members');
        Schema::dropIfExists('tender_committees');
    }

    private function grantTables(array $tables): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($tables as $table) {
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            } catch (\Throwable) {
                // app_user may not exist in local/test DBs
            }
        }
    }
};
