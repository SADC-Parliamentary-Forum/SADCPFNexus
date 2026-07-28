<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock / Stores PRD Phase 1 — requests, reservations, issues, returns,
 * transfers, write-offs, replenishment, batches, available qty, stocktake gates.
 * Does NOT modify fixed_assets tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_units', function (Blueprint $table) {
            $table->foreignId('base_unit_id')->nullable()->after('name')->constrained('stock_units')->nullOnDelete();
            $table->decimal('conversion_factor', 12, 4)->nullable()->after('base_unit_id');
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->unsignedInteger('quantity_reserved')->default(0)->after('current_balance');
            $table->unsignedInteger('quantity_quarantined')->default(0)->after('quantity_reserved');
            $table->unsignedInteger('max_level')->nullable()->after('reorder_level');
            $table->boolean('tracks_batches')->default(false)->after('max_level');
        });

        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->string('batch_number', 64);
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->string('status', 32)->default('active'); // active|quarantined|exhausted
            $table->foreignId('stock_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['stock_item_id', 'batch_number']);
            $table->index(['tenant_id', 'expiry_date']);
        });

        Schema::create('stock_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->string('status', 32)->default('draft');
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('programme_id')->nullable()->constrained('programmes')->nullOnDelete();
            $table->string('purpose')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('stock_request_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_request_id')->constrained('stock_requests')->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity_requested');
            $table->unsignedInteger('quantity_approved')->nullable();
            $table->unsignedInteger('quantity_issued')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_request_id')->constrained('stock_requests')->cascadeOnDelete();
            $table->foreignId('stock_request_line_id')->constrained('stock_request_lines')->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('quantity_released')->default(0);
            $table->string('status', 32)->default('active'); // active|fulfilled|released|cancelled
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'stock_item_id', 'status']);
        });

        Schema::create('stock_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('voucher_number', 64);
            $table->foreignId('stock_request_id')->nullable()->constrained('stock_requests')->nullOnDelete();
            $table->foreignId('issued_by')->constrained('users');
            $table->foreignId('issued_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('issued_to_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('issued_to_other')->nullable();
            $table->date('issue_date');
            $table->string('status', 32)->default('issued'); // issued|acknowledged|cancelled
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'voucher_number']);
        });

        Schema::create('stock_issue_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_issue_id')->constrained('stock_issues')->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->foreignId('stock_request_line_id')->nullable()->constrained('stock_request_lines')->nullOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->foreignId('stock_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->unsignedInteger('quantity');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->foreignId('stock_issue_id')->nullable()->constrained('stock_issues')->nullOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->foreignId('stock_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('condition', 32)->default('good'); // good|damaged|expired
            $table->foreignId('returned_by')->constrained('users');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('return_date');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
        });

        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->foreignId('from_location_id')->constrained('stock_locations');
            $table->foreignId('to_location_id')->constrained('stock_locations');
            $table->string('status', 32)->default('draft'); // draft|dispatched|received|cancelled
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('dispatched_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('stock_transfer_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->unsignedInteger('quantity');
            $table->foreignId('dispatch_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->foreignId('receive_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_write_offs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('reason_code', 32); // damaged|expired|shortage|other
            $table->boolean('from_quarantine')->default(false);
            $table->string('status', 32)->default('pending'); // pending|approved|rejected
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('stock_transaction_id')->nullable()->constrained('stock_transactions')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
        });

        Schema::create('stock_replenishment_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity_suggested');
            $table->unsignedInteger('quantity_requested');
            $table->string('status', 32)->default('open'); // open|linked|closed|cancelled
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('procurement_request_id')->nullable()->constrained('procurement_requests')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('stocktakes', function (Blueprint $table) {
            $table->boolean('is_blind')->default(false)->after('status');
            $table->foreignId('variance_approved_by')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
            $table->timestamp('variance_approved_at')->nullable()->after('variance_approved_by');
        });

        Schema::table('stock_transactions', function (Blueprint $table) {
            $table->foreignId('stock_request_id')->nullable()->after('goods_receipt_note_id')->constrained('stock_requests')->nullOnDelete();
            $table->foreignId('stock_issue_id')->nullable()->after('stock_request_id')->constrained('stock_issues')->nullOnDelete();
            $table->foreignId('stock_transfer_id')->nullable()->after('stock_issue_id')->constrained('stock_transfers')->nullOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->after('stock_transfer_id')->constrained('stock_batches')->nullOnDelete();
            $table->foreignId('reverses_transaction_id')->nullable()->after('stock_batch_id')->constrained('stock_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reverses_transaction_id');
            $table->dropConstrainedForeignId('stock_batch_id');
            $table->dropConstrainedForeignId('stock_transfer_id');
            $table->dropConstrainedForeignId('stock_issue_id');
            $table->dropConstrainedForeignId('stock_request_id');
        });

        Schema::table('stocktakes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('variance_approved_by');
            $table->dropColumn(['is_blind', 'variance_approved_at']);
        });

        Schema::dropIfExists('stock_replenishment_requests');
        Schema::dropIfExists('stock_write_offs');
        Schema::dropIfExists('stock_transfer_lines');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('stock_returns');
        Schema::dropIfExists('stock_issue_lines');
        Schema::dropIfExists('stock_issues');
        Schema::dropIfExists('stock_reservations');
        Schema::dropIfExists('stock_request_lines');
        Schema::dropIfExists('stock_requests');
        Schema::dropIfExists('stock_batches');

        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropColumn(['quantity_reserved', 'quantity_quarantined', 'max_level', 'tracks_batches']);
        });

        Schema::table('stock_units', function (Blueprint $table) {
            $table->dropConstrainedForeignId('base_unit_id');
            $table->dropColumn('conversion_factor');
        });
    }
};
