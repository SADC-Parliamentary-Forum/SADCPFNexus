<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheet_import_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 40);
            $table->string('filename');
            $table->string('file_hash', 64);
            $table->string('file_storage_key')->nullable();
            $table->unsignedInteger('file_size_bytes')->default(0);
            $table->string('detected_mime', 120)->nullable();
            $table->string('format', 40)->nullable();
            $table->string('source_type', 40)->nullable();
            $table->string('mode', 20);
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('uploaded');
            $table->string('progress_step', 40)->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('warning_rows')->default(0);
            $table->unsignedInteger('error_rows')->default(0);
            $table->unsignedInteger('duplicate_rows')->default(0);
            $table->unsignedInteger('excluded_rows')->default(0);
            $table->unsignedInteger('imported_rows')->default(0);
            $table->json('column_map')->nullable();
            $table->json('detected_headers')->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->boolean('import_valid_only')->default(true);
            $table->boolean('import_as_verified')->default(false);
            $table->text('verify_justification')->nullable();
            $table->text('failure_reason')->nullable();
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('uploaded_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('rollback_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rollback_at')->nullable();
            $table->text('rollback_reason')->nullable();
            $table->foreignId('reversed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reversed_at')->nullable();
            $table->text('reverse_reason')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'uploaded_by']);
        });

        Schema::create('timesheet_import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('import_batch_id')->constrained('timesheet_import_batches')->cascadeOnDelete();
            $table->unsignedInteger('source_row_number');
            $table->unsignedInteger('split_index')->default(0);
            $table->string('split_group', 40)->nullable();
            $table->json('raw')->nullable();
            $table->json('normalised')->nullable();
            $table->string('row_status', 20)->default('valid');
            $table->json('messages')->nullable();
            $table->string('row_fingerprint', 64)->nullable();
            $table->foreignId('mapped_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source_employee_email')->nullable();
            $table->string('source_employee_name')->nullable();
            $table->foreignId('timesheet_id')->nullable()->constrained('timesheets')->nullOnDelete();
            $table->foreignId('timesheet_entry_id')->nullable()->constrained('timesheet_entries')->nullOnDelete();
            $table->timestamps();

            $table->index(['import_batch_id', 'row_status'], 'ts_import_rows_batch_status_idx');
            $table->index(['import_batch_id', 'source_row_number'], 'ts_import_rows_batch_src_idx');
            $table->index(['tenant_id', 'row_fingerprint'], 'ts_import_rows_fingerprint_idx');
        });

        Schema::create('timesheet_import_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            $table->string('historical_value');
            $table->string('nexus_value')->nullable();
            $table->foreignId('mapped_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'kind', 'historical_value'], 'ts_import_map_lookup_idx');
        });

        Schema::create('timesheet_import_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('filename');
            $table->string('storage_path');
            $table->string('file_hash', 64);
            $table->boolean('is_current')->default(true);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'version']);
        });

        Schema::create('timesheet_historical_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('import_batch_id')->constrained('timesheet_import_batches')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->string('scope', 32)->default('batch');
            $table->text('justification');
            $table->foreignId('verified_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('verified_at');
            $table->timestamps();

            $table->index(['import_batch_id', 'scope']);
        });

        Schema::table('timesheets', function (Blueprint $table) {
            if (! Schema::hasColumn('timesheets', 'origin')) {
                $table->string('origin', 32)->default('nexus')->after('status');
                $table->index(['tenant_id', 'origin']);
            }
        });

        Schema::table('timesheet_entries', function (Blueprint $table) {
            if (! Schema::hasColumn('timesheet_entries', 'import_batch_id')) {
                $table->foreignId('import_batch_id')->nullable()->after('source_record_id')
                    ->constrained('timesheet_import_batches')->nullOnDelete();
                $table->unsignedBigInteger('source_row_id')->nullable()->after('import_batch_id');
                $table->string('row_fingerprint', 64)->nullable()->after('source_row_id');
                $table->string('original_project', 255)->nullable();
                $table->string('original_activity', 255)->nullable();
                $table->text('original_description')->nullable();
                $table->string('original_start', 64)->nullable();
                $table->string('original_end', 64)->nullable();
                $table->string('original_duration', 64)->nullable();
                $table->string('original_created_date', 64)->nullable();
                $table->string('source_employee_name')->nullable();
                $table->string('source_employee_email')->nullable();
                $table->string('source_filename')->nullable();
                $table->unsignedInteger('source_row_number')->nullable();
                $table->string('external_reference', 120)->nullable();
                $table->json('clockify_metadata')->nullable();
                $table->timestamp('reversed_at')->nullable();
            }
        });

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS timesheet_entries_row_fingerprint_unique ON timesheet_entries (row_fingerprint) WHERE row_fingerprint IS NOT NULL AND reversed_at IS NULL');
        DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS timesheet_import_batches_file_unique ON timesheet_import_batches (tenant_id, file_hash, mode, COALESCE(target_user_id, 0)) WHERE status NOT IN ('rolled_back', 'reversed')");

        if (DB::getDriverName() === 'pgsql') {
            foreach ([
                'timesheet_import_batches',
                'timesheet_import_rows',
                'timesheet_import_mappings',
                'timesheet_import_templates',
                'timesheet_historical_verifications',
            ] as $table) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            }
        }
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS timesheet_entries_row_fingerprint_unique');
        DB::statement('DROP INDEX IF EXISTS timesheet_import_batches_file_unique');

        Schema::table('timesheet_entries', function (Blueprint $table) {
            if (Schema::hasColumn('timesheet_entries', 'import_batch_id')) {
                $table->dropConstrainedForeignId('import_batch_id');
                $table->dropColumn([
                    'source_row_id', 'row_fingerprint', 'original_project', 'original_activity',
                    'original_description', 'original_start', 'original_end', 'original_duration',
                    'original_created_date', 'source_employee_name', 'source_employee_email',
                    'source_filename', 'source_row_number', 'external_reference', 'clockify_metadata',
                    'reversed_at',
                ]);
            }
        });

        Schema::table('timesheets', function (Blueprint $table) {
            if (Schema::hasColumn('timesheets', 'origin')) {
                $table->dropIndex(['tenant_id', 'origin']);
                $table->dropColumn('origin');
            }
        });

        Schema::dropIfExists('timesheet_historical_verifications');
        Schema::dropIfExists('timesheet_import_templates');
        Schema::dropIfExists('timesheet_import_mappings');
        Schema::dropIfExists('timesheet_import_rows');
        Schema::dropIfExists('timesheet_import_batches');
    }
};
