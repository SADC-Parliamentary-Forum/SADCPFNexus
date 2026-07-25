<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->string('suggested_method', 64)->nullable()->after('procurement_method');
            $table->string('policy_profile_key', 64)->nullable()->after('suggested_method');
            $table->json('policy_snapshot')->nullable()->after('policy_profile_key');
            $table->text('method_override_reason')->nullable()->after('policy_snapshot');
            $table->foreignId('method_override_by')->nullable()->after('method_override_reason')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('method_override_at')->nullable()->after('method_override_by');
            $table->text('split_justification')->nullable()->after('method_override_at');
            if (!Schema::hasColumn('procurement_requests', 'programme_id')) {
                $table->foreignId('programme_id')->nullable()->after('budget_line_id')
                    ->constrained('programmes')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            if (Schema::hasColumn('procurement_requests', 'programme_id')) {
                $table->dropConstrainedForeignId('programme_id');
            }
            $table->dropConstrainedForeignId('method_override_by');
            $table->dropColumn([
                'suggested_method',
                'policy_profile_key',
                'policy_snapshot',
                'method_override_reason',
                'method_override_at',
                'split_justification',
            ]);
        });
    }
};
