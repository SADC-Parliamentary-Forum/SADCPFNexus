<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Evidence that a printed label was stuck on the device: who applied it, when,
 * a photo of it in place and an optional note on where it is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_labels', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_labels', 'applied_at')) {
                $table->timestamp('applied_at')->nullable();
            }
            if (! Schema::hasColumn('asset_labels', 'applied_by')) {
                $table->foreignId('applied_by')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_labels', 'applied_attachment_id')) {
                $table->foreignId('applied_attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_labels', 'placement_note')) {
                $table->string('placement_note', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('asset_labels', function (Blueprint $table) {
            if (Schema::hasColumn('asset_labels', 'applied_attachment_id')) {
                $table->dropConstrainedForeignId('applied_attachment_id');
            }
            if (Schema::hasColumn('asset_labels', 'applied_by')) {
                $table->dropConstrainedForeignId('applied_by');
            }
            $table->dropColumn(array_values(array_filter(
                ['applied_at', 'placement_note'],
                fn (string $column) => Schema::hasColumn('asset_labels', $column)
            )));
        });
    }
};
