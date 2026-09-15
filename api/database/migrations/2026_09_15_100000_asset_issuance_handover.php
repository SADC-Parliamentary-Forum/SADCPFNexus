<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_handover_declaration_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('version_key', 32);
            $table->text('statement');
            $table->timestamp('effective_from')->nullable();
            $table->boolean('is_current')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'version_key'], 'asset_handover_decl_tenant_version_unique');
        });

        Schema::create('asset_acquisition_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 64);
            $table->string('description')->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->decimal('unit_cost', 14, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->foreignId('supplier_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->string('supplier_name')->nullable();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->foreignId('goods_receipt_note_id')->nullable()->constrained('goods_receipt_notes')->nullOnDelete();
            $table->string('invoice_number', 64)->nullable();
            $table->foreignId('funding_source_id')->nullable()->constrained('funding_sources')->nullOnDelete();
            $table->string('funding_source')->nullable();
            $table->date('received_date')->nullable();
            $table->string('category', 32)->nullable();
            $table->string('subcategory_code', 32)->nullable();
            $table->foreignId('home_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->string('status', 32)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_acquisition_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('batch_id')->constrained('asset_acquisition_batches')->cascadeOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('serial_number')->nullable();
            $table->timestamps();
            $table->index(['batch_id', 'asset_id']);
        });

        Schema::create('asset_handovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 64);
            $table->string('type', 16);
            $table->string('custody_target_type', 32);
            $table->string('status', 32)->default('draft');
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('from_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('from_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('to_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->foreignId('to_asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->string('declaration_version', 32)->nullable();
            $table->foreignId('signature_event_id')->nullable()->constrained('signature_events')->nullOnDelete();
            $table->string('certificate_path')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_reminded_at')->nullable();
            $table->unsignedInteger('reminders_sent')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
            $table->index(['to_user_id', 'status']);
        });

        Schema::create('asset_handover_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('handover_id')->constrained('asset_handovers')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('snapshot_tag')->nullable();
            $table->string('snapshot_name')->nullable();
            $table->string('snapshot_serial')->nullable();
            $table->string('condition_out', 64)->nullable();
            $table->json('accessories')->nullable();
            $table->json('photo_attachment_ids')->nullable();
            $table->text('notes')->nullable();
            $table->string('line_status', 32)->default('pending');
            $table->string('recipient_response', 32)->nullable();
            $table->text('dispute_notes')->nullable();
            $table->string('condition_in', 64)->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['handover_id', 'asset_id']);
            $table->index(['asset_id', 'line_status']);
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('acquisition_batch_id')->nullable()->after('source_import_batch_id')
                ->constrained('asset_acquisition_batches')->nullOnDelete();
            $table->foreignId('reserved_handover_id')->nullable()->after('assigned_to')
                ->constrained('asset_handovers')->nullOnDelete();
        });

        Schema::table('asset_assignment_histories', function (Blueprint $table) {
            $table->string('custodian_type', 32)->nullable()->after('assigned_to');
            $table->foreignId('custodian_department_id')->nullable()->after('department')
                ->constrained('departments')->nullOnDelete();
            $table->foreignId('custodian_location_id')->nullable()->after('custodian_department_id')
                ->constrained('asset_locations')->nullOnDelete();
            $table->foreignId('handover_id')->nullable()->after('notes')
                ->constrained('asset_handovers')->nullOnDelete();
            $table->foreignId('handover_line_id')->nullable()->after('handover_id')
                ->constrained('asset_handover_lines')->nullOnDelete();
            $table->timestamp('ended_at')->nullable()->after('returned_at');
        });

        if (DB::getDriverName() === 'pgsql') {
            $tables = [
                'asset_handover_declaration_versions',
                'asset_acquisition_batches',
                'asset_acquisition_batch_items',
                'asset_handovers',
                'asset_handover_lines',
            ];
            foreach ($tables as $table) {
                try {
                    DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
                    DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
                } catch (\Throwable) {
                    // app_user may not exist in local/test databases.
                }
            }
        }
    }

    public function down(): void
    {
        Schema::table('asset_assignment_histories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('handover_line_id');
            $table->dropConstrainedForeignId('handover_id');
            $table->dropConstrainedForeignId('custodian_location_id');
            $table->dropConstrainedForeignId('custodian_department_id');
            $table->dropColumn(['custodian_type', 'ended_at']);
        });
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reserved_handover_id');
            $table->dropConstrainedForeignId('acquisition_batch_id');
        });
        Schema::dropIfExists('asset_handover_lines');
        Schema::dropIfExists('asset_handovers');
        Schema::dropIfExists('asset_acquisition_batch_items');
        Schema::dropIfExists('asset_acquisition_batches');
        Schema::dropIfExists('asset_handover_declaration_versions');
    }
};
