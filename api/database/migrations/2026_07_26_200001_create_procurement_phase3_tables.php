<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_policy_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('donor_codes')->nullable();
            $table->decimal('direct_purchase_limit', 15, 2)->default(10000);
            $table->decimal('quotation_limit', 15, 2)->default(100000);
            $table->decimal('tender_threshold', 15, 2)->default(100000);
            $table->unsignedTinyInteger('minimum_quotes_required')->default(3);
            $table->unsignedSmallInteger('split_lookback_days')->default(30);
            $table->string('split_enforcement', 16)->default('hard');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'key']);
            $table->index(['tenant_id', 'is_active']);
        });

        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->decimal('financial_score', 5, 2)->nullable()->after('technical_score');
        });

        $this->grantTables(['procurement_policy_profiles']);
    }

    public function down(): void
    {
        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->dropColumn('financial_score');
        });
        Schema::dropIfExists('procurement_policy_profiles');
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
