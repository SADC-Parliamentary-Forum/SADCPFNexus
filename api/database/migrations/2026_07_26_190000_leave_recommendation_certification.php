<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('leave_requests', 'recommendation_status')) {
                $table->string('recommendation_status', 40)->nullable()->after('current_holder');
            }
            if (! Schema::hasColumn('leave_requests', 'recommended_by')) {
                $table->foreignId('recommended_by')->nullable()->after('recommendation_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('leave_requests', 'recommended_at')) {
                $table->timestamp('recommended_at')->nullable()->after('recommended_by');
            }
            if (! Schema::hasColumn('leave_requests', 'recommendation_comments')) {
                $table->text('recommendation_comments')->nullable()->after('recommended_at');
            }
            if (! Schema::hasColumn('leave_requests', 'certification_status')) {
                $table->string('certification_status', 40)->nullable()->after('recommendation_comments');
            }
            if (! Schema::hasColumn('leave_requests', 'certified_by')) {
                $table->foreignId('certified_by')->nullable()->after('certification_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('leave_requests', 'certified_at')) {
                $table->timestamp('certified_at')->nullable()->after('certified_by');
            }
            if (! Schema::hasColumn('leave_requests', 'certification_comments')) {
                $table->text('certification_comments')->nullable()->after('certified_at');
            }
        });

        Schema::table('leave_segments', function (Blueprint $table) {
            if (! Schema::hasColumn('leave_segments', 'certification_status')) {
                $table->string('certification_status', 40)->nullable()->after('status');
            }
            if (! Schema::hasColumn('leave_segments', 'eligible_days')) {
                $table->decimal('eligible_days', 10, 2)->nullable()->after('certification_status');
            }
            if (! Schema::hasColumn('leave_segments', 'document_status')) {
                $table->string('document_status', 40)->nullable()->after('eligible_days');
            }
            if (! Schema::hasColumn('leave_segments', 'certified_by')) {
                $table->foreignId('certified_by')->nullable()->after('document_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('leave_segments', 'certified_at')) {
                $table->timestamp('certified_at')->nullable()->after('certified_by');
            }
            if (! Schema::hasColumn('leave_segments', 'certification_comments')) {
                $table->text('certification_comments')->nullable()->after('certified_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('leave_segments', function (Blueprint $table) {
            foreach (['certified_by'] as $column) {
                if (Schema::hasColumn('leave_segments', $column)) {
                    $table->dropConstrainedForeignId($column);
                }
            }

            foreach (['certification_status', 'eligible_days', 'document_status', 'certified_at', 'certification_comments'] as $column) {
                if (Schema::hasColumn('leave_segments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('leave_requests', function (Blueprint $table) {
            foreach (['recommended_by', 'certified_by'] as $column) {
                if (Schema::hasColumn('leave_requests', $column)) {
                    $table->dropConstrainedForeignId($column);
                }
            }

            foreach ([
                'recommendation_status',
                'recommended_at',
                'recommendation_comments',
                'certification_status',
                'certified_at',
                'certification_comments',
            ] as $column) {
                if (Schema::hasColumn('leave_requests', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
