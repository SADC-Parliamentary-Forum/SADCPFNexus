<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_locations', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_locations', 'parent_id')) {
                $table->foreignId('parent_id')->nullable()->after('tenant_id')->constrained('asset_locations')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_locations', 'legacy_name')) {
                $table->string('legacy_name', 255)->nullable()->after('name');
            }
            if (! Schema::hasColumn('asset_locations', 'hierarchy_level')) {
                $table->string('hierarchy_level', 32)->nullable()->after('location_type');
            }
        });

        Schema::table('assets', function (Blueprint $table) {
            if (! Schema::hasColumn('assets', 'uuid')) {
                $table->uuid('uuid')->nullable()->after('id');
            }
            if (! Schema::hasColumn('assets', 'qr_token')) {
                $table->string('qr_token', 64)->nullable()->after('qr_path');
            }
            if (! Schema::hasColumn('assets', 'qr_generated_at')) {
                $table->timestamp('qr_generated_at')->nullable()->after('qr_token');
            }
            if (! Schema::hasColumn('assets', 'source_import_batch_id')) {
                $table->unsignedBigInteger('source_import_batch_id')->nullable()->after('qr_generated_at');
            }
            if (! Schema::hasColumn('assets', 'legacy_description')) {
                $table->text('legacy_description')->nullable();
            }
            if (! Schema::hasColumn('assets', 'legacy_location')) {
                $table->string('legacy_location', 255)->nullable();
            }
            if (! Schema::hasColumn('assets', 'legacy_category')) {
                $table->string('legacy_category', 128)->nullable();
            }
            if (! Schema::hasColumn('assets', 'verification_status')) {
                $table->string('verification_status', 32)->default('unverified');
            }
            if (! Schema::hasColumn('assets', 'data_quality_status')) {
                $table->string('data_quality_status', 32)->nullable();
            }
            if (! Schema::hasColumn('assets', 'data_quality_flags')) {
                $table->json('data_quality_flags')->nullable();
            }
            if (! Schema::hasColumn('assets', 'label_status')) {
                $table->string('label_status', 32)->default('never_printed');
            }
            if (! Schema::hasColumn('assets', 'label_reprint_reason')) {
                $table->string('label_reprint_reason', 64)->nullable();
            }
            if (! Schema::hasColumn('assets', 'custodian_type')) {
                $table->string('custodian_type', 32)->nullable();
            }
            if (! Schema::hasColumn('assets', 'custodian_department_id')) {
                $table->foreignId('custodian_department_id')->nullable()->constrained('departments')->nullOnDelete();
            }
            if (! Schema::hasColumn('assets', 'opening_depreciation')) {
                $table->decimal('opening_depreciation', 14, 2)->nullable();
            }
            if (! Schema::hasColumn('assets', 'source_depreciation')) {
                $table->decimal('source_depreciation', 14, 2)->nullable();
            }
            if (! Schema::hasColumn('assets', 'source_book_value')) {
                $table->decimal('source_book_value', 14, 2)->nullable();
            }
            if (! Schema::hasColumn('assets', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        if (! Schema::hasIndex('assets', 'assets_uuid_unique')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->unique('uuid');
            });
        }
        if (! Schema::hasIndex('assets', 'assets_qr_token_unique')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->unique('qr_token');
            });
        }
        if (! Schema::hasIndex('assets', 'assets_tenant_id_tag_number_unique')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->unique(['tenant_id', 'tag_number']);
            });
        }
        Schema::table('assets', function (Blueprint $table) {
            $table->index(['tenant_id', 'verification_status']);
            $table->index(['tenant_id', 'source_import_batch_id']);
            $table->index(['tenant_id', 'label_status']);
        });

        Schema::table('asset_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_movements', 'from_location_id')) {
                $table->foreignId('from_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'to_location_id')) {
                $table->foreignId('to_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'from_department_id')) {
                $table->foreignId('from_department_id')->nullable()->constrained('departments')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'to_department_id')) {
                $table->foreignId('to_department_id')->nullable()->constrained('departments')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'requested_by')) {
                $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_movements', 'reference_document')) {
                $table->string('reference_document', 128)->nullable();
            }
            if (! Schema::hasColumn('asset_movements', 'effective_date')) {
                $table->date('effective_date')->nullable();
            }
        });

        Schema::table('asset_verification_results', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_verification_results', 'verification_method')) {
                $table->string('verification_method', 32)->nullable();
            }
            if (! Schema::hasColumn('asset_verification_results', 'gps_lat')) {
                $table->decimal('gps_lat', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('asset_verification_results', 'gps_lng')) {
                $table->decimal('gps_lng', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('asset_verification_results', 'device_id')) {
                $table->string('device_id', 128)->nullable();
            }
            if (! Schema::hasColumn('asset_verification_results', 'photos')) {
                $table->json('photos')->nullable();
            }
            if (! Schema::hasColumn('asset_verification_results', 'mismatch_types')) {
                $table->json('mismatch_types')->nullable();
            }
        });

        Schema::create('asset_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number', 64);
            $table->string('mode', 32)->default('legacy'); // legacy | template
            $table->json('filenames')->nullable();
            $table->json('file_hashes')->nullable();
            $table->string('fingerprint', 64)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('uploaded_at')->nullable();
            $table->unsignedInteger('source_row_count')->default(0);
            $table->unsignedInteger('parsed_row_count')->default(0);
            $table->unsignedInteger('rejected_row_count')->default(0);
            $table->unsignedInteger('duplicate_count')->default(0);
            $table->unsignedInteger('warning_count')->default(0);
            $table->unsignedInteger('imported_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('unchanged_count')->default(0);
            $table->unsignedInteger('excluded_count')->default(0);
            $table->unsignedInteger('unresolved_count')->default(0);
            $table->unsignedInteger('unique_tag_count')->default(0);
            $table->string('status', 32)->default('uploaded');
            $table->timestamp('committed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('summary')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'batch_number']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'fingerprint']);
        });

        Schema::create('asset_import_raw', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained('asset_import_batches')->cascadeOnDelete();
            $table->string('source_filename');
            $table->string('source_sheet', 128)->nullable();
            $table->unsignedInteger('source_row_number');
            $table->string('source_kind', 32); // category_listing | location_listing | staging | template
            $table->json('raw_json');
            $table->string('row_fingerprint', 64)->nullable();
            $table->timestamps();
            $table->index(['import_batch_id', 'source_kind']);
            $table->index(['import_batch_id', 'row_fingerprint']);
        });

        Schema::create('asset_import_staging', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained('asset_import_batches')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('asset_tag', 64)->nullable();
            $table->string('asset_name')->nullable();
            $table->text('description')->nullable();
            $table->text('legacy_description')->nullable();
            $table->string('legacy_category', 128)->nullable();
            $table->string('category_code', 32)->nullable();
            $table->string('make', 128)->nullable();
            $table->string('model', 255)->nullable();
            $table->string('serial_number', 128)->nullable();
            $table->date('acquisition_date')->nullable();
            $table->decimal('original_cost', 14, 2)->nullable();
            $table->decimal('opening_depreciation', 14, 2)->nullable();
            $table->decimal('source_depreciation', 14, 2)->nullable();
            $table->decimal('accumulated_depreciation', 14, 2)->nullable();
            $table->decimal('current_book_value', 14, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->string('funding_source', 128)->nullable();
            $table->string('legacy_location', 255)->nullable();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->string('custodian_candidate', 255)->nullable();
            $table->string('custodian_type', 32)->nullable();
            $table->foreignId('custodian_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('custodian_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->decimal('custodian_confidence', 5, 2)->nullable();
            $table->string('status', 32)->default('active');
            $table->string('proposed_action', 32)->default('CREATE');
            $table->string('review_status', 32)->default('pending'); // pending | approved | excluded | blocked
            $table->boolean('blocking')->default(false);
            $table->json('blocking_errors')->nullable();
            $table->json('warnings')->nullable();
            $table->json('data_quality_flags')->nullable();
            $table->string('data_quality_status', 32)->nullable();
            $table->foreignId('matched_asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->json('field_diff')->nullable();
            $table->json('source_refs')->nullable();
            $table->text('admin_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['import_batch_id', 'review_status']);
            $table->index(['import_batch_id', 'asset_tag']);
            $table->index(['tenant_id', 'asset_tag']);
        });

        Schema::create('asset_import_lineage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained('asset_import_batches')->cascadeOnDelete();
            $table->foreignId('staging_id')->nullable()->constrained('asset_import_staging')->nullOnDelete();
            $table->string('asset_tag', 64)->nullable();
            $table->foreignId('raw_id')->constrained('asset_import_raw')->cascadeOnDelete();
            $table->string('source_kind', 32);
            $table->timestamps();
            $table->index(['import_batch_id', 'asset_tag']);
        });

        Schema::create('asset_import_discrepancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained('asset_import_batches')->cascadeOnDelete();
            $table->foreignId('staging_id')->nullable()->constrained('asset_import_staging')->cascadeOnDelete();
            $table->string('asset_tag', 64)->nullable();
            $table->string('field', 64);
            $table->text('source_a_value')->nullable();
            $table->text('source_b_value')->nullable();
            $table->text('chosen_value')->nullable();
            $table->string('rule', 64)->nullable();
            $table->boolean('requires_review')->default(true);
            $table->timestamps();
            $table->index(['import_batch_id', 'asset_tag']);
        });

        Schema::create('asset_location_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('import_batch_id')->nullable()->constrained('asset_import_batches')->nullOnDelete();
            $table->string('legacy_location', 255);
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->string('confidence', 16)->default('suggested');
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'legacy_location']);
        });

        Schema::create('asset_custodian_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('import_batch_id')->nullable()->constrained('asset_import_batches')->nullOnDelete();
            $table->string('legacy_key', 255);
            $table->string('custodian_type', 32)->default('shared');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->boolean('confirmed')->default(false);
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'legacy_key']);
        });

        Schema::create('asset_qr_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64);
            $table->timestamp('generated_at');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoke_reason', 64)->nullable();
            $table->timestamps();
            $table->unique('token');
            $table->index(['asset_id', 'revoked_at']);
        });

        Schema::create('asset_label_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->string('kind', 32); // permanent | custody
            $table->string('page_size', 16)->default('A4');
            $table->decimal('page_width_mm', 8, 2)->default(210);
            $table->decimal('page_height_mm', 8, 2)->default(297);
            $table->decimal('margin_top_mm', 8, 2)->default(8.7);
            $table->decimal('margin_left_mm', 8, 2)->default(4.7);
            $table->decimal('label_width_mm', 8, 2)->default(63.5);
            $table->decimal('label_height_mm', 8, 2)->default(46.6);
            $table->decimal('h_gap_mm', 8, 2)->default(2.5);
            $table->decimal('v_gap_mm', 8, 2)->default(0);
            $table->unsignedTinyInteger('rows')->default(6);
            $table->unsignedTinyInteger('columns')->default(3);
            $table->unsignedTinyInteger('font_pt')->default(8);
            $table->unsignedTinyInteger('qr_mm')->default(22);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('asset_label_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number', 64);
            $table->foreignId('template_id')->nullable()->constrained('asset_label_templates')->nullOnDelete();
            $table->unsignedInteger('number_of_labels')->default(0);
            $table->foreignId('printed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('printed_at')->nullable();
            $table->boolean('is_reprint')->default(false);
            $table->string('reprint_reason', 64)->nullable();
            $table->foreignId('source_import_batch_id')->nullable()->constrained('asset_import_batches')->nullOnDelete();
            $table->timestamps();
            $table->unique(['tenant_id', 'batch_number']);
        });

        Schema::create('asset_label_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('label_batch_id')->constrained('asset_label_batches')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->index(['asset_id']);
        });

        Schema::create('asset_unregistered_finds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained('asset_verification_campaigns')->nullOnDelete();
            $table->string('status', 32)->default('open'); // open | investigating | approved | rejected | promoted
            $table->string('description');
            $table->string('make', 128)->nullable();
            $table->string('model', 255)->nullable();
            $table->string('serial_number', 128)->nullable();
            $table->string('found_location', 255)->nullable();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->foreignId('found_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('found_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('photos')->nullable();
            $table->foreignId('promoted_asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('asset_verification_results', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_verification_results', 'unregistered_find_id')) {
                $table->foreignId('unregistered_find_id')->nullable()->constrained('asset_unregistered_finds')->nullOnDelete();
            }
        });

        if (Schema::hasColumn('assets', 'source_import_batch_id')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->foreign('source_import_batch_id')->references('id')->on('asset_import_batches')->nullOnDelete();
            });
        }

        $this->grantAppUser([
            'asset_import_batches',
            'asset_import_raw',
            'asset_import_staging',
            'asset_import_lineage',
            'asset_import_discrepancies',
            'asset_location_mappings',
            'asset_custodian_mappings',
            'asset_qr_tokens',
            'asset_label_templates',
            'asset_label_batches',
            'asset_label_batch_items',
            'asset_unregistered_finds',
        ]);
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            if (Schema::hasColumn('assets', 'source_import_batch_id')) {
                $table->dropForeign(['source_import_batch_id']);
            }
        });
        Schema::table('asset_verification_results', function (Blueprint $table) {
            if (Schema::hasColumn('asset_verification_results', 'unregistered_find_id')) {
                $table->dropConstrainedForeignId('unregistered_find_id');
            }
        });
        Schema::dropIfExists('asset_unregistered_finds');
        Schema::dropIfExists('asset_label_batch_items');
        Schema::dropIfExists('asset_label_batches');
        Schema::dropIfExists('asset_label_templates');
        Schema::dropIfExists('asset_qr_tokens');
        Schema::dropIfExists('asset_custodian_mappings');
        Schema::dropIfExists('asset_location_mappings');
        Schema::dropIfExists('asset_import_discrepancies');
        Schema::dropIfExists('asset_import_lineage');
        Schema::dropIfExists('asset_import_staging');
        Schema::dropIfExists('asset_import_raw');
        Schema::dropIfExists('asset_import_batches');
    }

    /**
     * @param  list<string>  $tables
     */
    private function grantAppUser(array $tables): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }
};
