<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_advance_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('salary_advance_requests', 'personnel_file_id')) {
                $table->foreignId('personnel_file_id')->nullable()->after('closed_at')
                    ->constrained('hr_personal_files')->nullOnDelete();
            }
            if (! Schema::hasColumn('salary_advance_requests', 'personnel_file_document_id')) {
                $table->foreignId('personnel_file_document_id')->nullable()->after('personnel_file_id')
                    ->constrained('hr_file_documents')->nullOnDelete();
            }
            if (! Schema::hasColumn('salary_advance_requests', 'personnel_file_filed_at')) {
                $table->timestamp('personnel_file_filed_at')->nullable()->after('personnel_file_document_id');
            }
        });

        Schema::create('salary_advance_policy_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('exception_type', 64); // outstanding_balance | max_percentage | concurrent | other
            $table->string('status', 32)->default('pending'); // pending | approved | rejected | revoked
            $table->string('reason', 500);
            $table->text('justification');
            $table->text('decision_notes')->nullable();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->foreignId('policy_version_id')->nullable()
                ->constrained('salary_advance_policy_versions')->nullOnDelete();
            $table->foreignId('linked_advance_id')->nullable()
                ->constrained('salary_advance_requests')->nullOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->boolean('applies_automatically')->default(false); // never silent; always false in Phase 3
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['employee_id', 'status']);
        });

        if (DB::getDriverName() === 'pgsql') {
            try {
                DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON salary_advance_policy_exceptions TO app_user');
                DB::statement('GRANT USAGE, SELECT ON SEQUENCE salary_advance_policy_exceptions_id_seq TO app_user');
            } catch (\Throwable) {
                // app_user may not exist in local/test DBs
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_policy_exceptions');

        Schema::table('salary_advance_requests', function (Blueprint $table) {
            if (Schema::hasColumn('salary_advance_requests', 'personnel_file_filed_at')) {
                $table->dropColumn('personnel_file_filed_at');
            }
            if (Schema::hasColumn('salary_advance_requests', 'personnel_file_document_id')) {
                $table->dropConstrainedForeignId('personnel_file_document_id');
            }
            if (Schema::hasColumn('salary_advance_requests', 'personnel_file_id')) {
                $table->dropConstrainedForeignId('personnel_file_id');
            }
        });
    }
};
