<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('nfc_uid', 64)->nullable()->after('qr_token');
            $table->foreignId('parent_asset_id')->nullable()->after('nfc_uid')
                ->constrained('assets')->nullOnDelete();
            $table->index(['tenant_id', 'nfc_uid']);
        });

        Schema::table('asset_locations', function (Blueprint $table) {
            $table->string('qr_token', 64)->nullable()->after('is_active');
            $table->unique(['tenant_id', 'qr_token']);
        });

        Schema::table('asset_handovers', function (Blueprint $table) {
            $table->foreignId('delegate_user_id')->nullable()->after('to_user_id')
                ->constrained('users')->nullOnDelete();
            $table->string('paper_receipt_number', 64)->nullable()->after('certificate_path');
            $table->foreignId('paper_signed_by')->nullable()->after('paper_receipt_number')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('paper_signed_at')->nullable()->after('paper_signed_by');
        });

        Schema::create('asset_scan_baskets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('status', 32)->default('open');
            $table->foreignId('handover_id')->nullable()->constrained('asset_handovers')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_scan_basket_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('basket_id')->constrained('asset_scan_baskets')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('scan_method', 16)->nullable();
            $table->string('token', 128)->nullable();
            $table->string('nfc_uid', 64)->nullable();
            $table->timestamps();
            $table->unique(['basket_id', 'asset_id']);
        });

        Schema::create('asset_kits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'name']);
        });

        Schema::create('asset_kit_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('kit_id')->constrained('asset_kits')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['kit_id', 'asset_id']);
        });

        Schema::create('asset_equipment_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('role_name', 64);
            $table->json('required_categories');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'role_name']);
        });

        Schema::create('asset_attestation_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('due_on')->nullable();
            $table->string('status', 32)->default('open');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_attestation_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->constrained('asset_attestation_campaigns')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->boolean('confirmed')->default(true);
            $table->timestamp('attested_at')->nullable();
            $table->timestamps();
            $table->unique(['campaign_id', 'user_id', 'asset_id'], 'asset_attest_campaign_user_asset_unique');
        });

        Schema::create('asset_planner_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('handover_id')->nullable()->constrained('asset_handovers')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'created_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            $tables = [
                'asset_scan_baskets',
                'asset_scan_basket_items',
                'asset_kits',
                'asset_kit_items',
                'asset_equipment_templates',
                'asset_attestation_campaigns',
                'asset_attestation_responses',
                'asset_planner_slots',
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
        Schema::dropIfExists('asset_planner_slots');
        Schema::dropIfExists('asset_attestation_responses');
        Schema::dropIfExists('asset_attestation_campaigns');
        Schema::dropIfExists('asset_equipment_templates');
        Schema::dropIfExists('asset_kit_items');
        Schema::dropIfExists('asset_kits');
        Schema::dropIfExists('asset_scan_basket_items');
        Schema::dropIfExists('asset_scan_baskets');

        Schema::table('asset_handovers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('delegate_user_id');
            $table->dropConstrainedForeignId('paper_signed_by');
            $table->dropColumn(['paper_receipt_number', 'paper_signed_at']);
        });
        Schema::table('asset_locations', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'qr_token']);
            $table->dropColumn('qr_token');
        });
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_asset_id');
            $table->dropColumn('nfc_uid');
        });
    }
};
