<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_recovery_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_category_id')->nullable()->constrained('asset_categories')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('department')->nullable();
            $table->string('primary_phone', 64);
            $table->string('secondary_phone', 64)->nullable();
            $table->string('whatsapp', 64)->nullable();
            $table->string('email')->nullable();
            $table->text('return_address')->nullable();
            $table->string('office_hours')->nullable();
            $table->text('instructions')->nullable();
            $table->boolean('show_primary_phone')->default(true);
            $table->boolean('show_secondary_phone')->default(false);
            $table->boolean('show_whatsapp')->default(false);
            $table->boolean('show_email')->default(true);
            $table->boolean('show_address')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('effective_from')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['tenant_id', 'asset_category_id'], 'asset_recovery_contacts_tenant_category_unique');
        });

        Schema::create('asset_recovery_contact_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recovery_contact_id')->constrained('asset_recovery_contacts')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->timestamp('effective_from')->nullable();
            $table->json('snapshot');
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['recovery_contact_id', 'version'], 'asset_recovery_contact_versions_unique');
        });

        Schema::create('asset_subcategories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_category_id')->constrained('asset_categories')->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['asset_category_id', 'code']);
        });

        Schema::create('asset_numbering_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('prefix', 16)->default('PF');
            $table->string('separator', 4)->default('/');
            $table->unsignedTinyInteger('sequence_length')->default(3);
            $table->boolean('include_category')->default(true);
            $table->boolean('include_subcategory')->default(true);
            $table->boolean('auto_assign')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique('tenant_id');
        });

        Schema::create('asset_number_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('category_code', 32);
            $table->string('subcategory_code', 32)->nullable();
            $table->unsignedInteger('next_number')->default(1);
            $table->timestamps();
            $table->unique(['tenant_id', 'category_code', 'subcategory_code'], 'asset_number_sequences_unique');
        });

        Schema::create('asset_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('asset_label_templates')->nullOnDelete();
            $table->unsignedInteger('label_version')->default(1);
            $table->foreignId('qr_token_id')->nullable()->constrained('asset_qr_tokens')->nullOnDelete();
            $table->unsignedInteger('recovery_contact_version')->nullable();
            $table->foreignId('printed_custodian_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('printed_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->string('printed_description')->nullable();
            $table->string('printed_phone', 64)->nullable();
            $table->string('printed_email')->nullable();
            $table->timestamp('printed_at')->nullable();
            $table->foreignId('printed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('current');
            $table->string('reprint_reason', 64)->nullable();
            $table->foreignId('replaced_by_label_id')->nullable()->constrained('asset_labels')->nullOnDelete();
            $table->foreignId('label_batch_id')->nullable()->constrained('asset_label_batches')->nullOnDelete();
            $table->timestamps();
            $table->index(['asset_id', 'status']);
        });

        Schema::create('asset_checkouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
            $table->string('purpose')->nullable();
            $table->timestamp('checked_out_at');
            $table->timestamp('expected_return_at')->nullable();
            $table->timestamp('returned_at')->nullable();
            $table->json('accessories')->nullable();
            $table->string('condition_out', 64)->nullable();
            $table->string('condition_in', 64)->nullable();
            $table->boolean('damage_reported')->default(false);
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->boolean('overdue_notified')->default(false);
            $table->timestamps();
            $table->index(['asset_id', 'returned_at']);
        });

        Schema::create('asset_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 32)->default('pending_outgoing');
            $table->string('reason')->nullable();
            $table->string('condition', 64)->nullable();
            $table->string('override_reason', 64)->nullable();
            $table->text('override_notes')->nullable();
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('outgoing_confirmed_at')->nullable();
            $table->foreignId('outgoing_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['asset_id', 'status']);
        });

        Schema::create('asset_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // lost, stolen, found, recovered
            $table->string('status', 32)->default('open');
            $table->date('date_noticed')->nullable();
            $table->date('last_seen_date')->nullable();
            $table->string('last_known_location')->nullable();
            $table->foreignId('custodian_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('circumstances')->nullable();
            $table->string('reporter_name')->nullable();
            $table->string('reporter_phone')->nullable();
            $table->string('reporter_email')->nullable();
            $table->text('message')->nullable();
            $table->string('found_location')->nullable();
            $table->boolean('public_report')->default(false);
            $table->string('police_station')->nullable();
            $table->string('police_case_number')->nullable();
            $table->date('police_reported_on')->nullable();
            $table->string('insurer')->nullable();
            $table->string('claim_reference')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['asset_id', 'type']);
        });

        Schema::create('asset_timeline_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('event_type', 64);
            $table->string('title');
            $table->json('payload')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['asset_id', 'occurred_at']);
            $table->index(['asset_id', 'event_type']);
        });

        Schema::create('asset_condition_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('previous_condition', 64)->nullable();
            $table->string('new_condition', 64);
            $table->foreignId('assessor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason')->nullable();
            $table->timestamp('assessed_at');
            $table->timestamps();
        });

        Schema::table('asset_label_batch_items', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_label_batch_items', 'recovery_contact_version')) {
                $table->unsignedInteger('recovery_contact_version')->nullable();
            }
            if (! Schema::hasColumn('asset_label_batch_items', 'printed_custodian_id')) {
                $table->foreignId('printed_custodian_id')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_label_batch_items', 'printed_location_id')) {
                $table->foreignId('printed_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            }
            if (! Schema::hasColumn('asset_label_batch_items', 'printed_description')) {
                $table->string('printed_description')->nullable();
            }
            if (! Schema::hasColumn('asset_label_batch_items', 'asset_label_id')) {
                $table->foreignId('asset_label_id')->nullable()->constrained('asset_labels')->nullOnDelete();
            }
        });

        Schema::table('assets', function (Blueprint $table) {
            if (! Schema::hasColumn('assets', 'subcategory_id')) {
                $table->foreignId('subcategory_id')->nullable()->constrained('asset_subcategories')->nullOnDelete();
            }
            if (! Schema::hasColumn('assets', 'ownership_type')) {
                $table->string('ownership_type', 64)->default('sadc_pf_owned');
            }
            if (! Schema::hasColumn('assets', 'funding_source_id')) {
                $table->foreignId('funding_source_id')->nullable()->constrained('funding_sources')->nullOnDelete();
            }
            if (! Schema::hasColumn('assets', 'home_location_id')) {
                $table->foreignId('home_location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            }
            if (! Schema::hasColumn('assets', 'received_date')) {
                $table->date('received_date')->nullable();
            }
            if (! Schema::hasColumn('assets', 'supplier_name')) {
                $table->string('supplier_name')->nullable();
            }
            if (! Schema::hasColumn('assets', 'vat_amount')) {
                $table->decimal('vat_amount', 14, 2)->nullable();
            }
            if (! Schema::hasColumn('assets', 'budget_line')) {
                $table->string('budget_line')->nullable();
            }
            if (! Schema::hasColumn('assets', 'capitalisation_date')) {
                $table->date('capitalisation_date')->nullable();
            }
            if (! Schema::hasColumn('assets', 'imei')) {
                $table->string('imei', 32)->nullable();
            }
            if (! Schema::hasColumn('assets', 'vehicle_registration')) {
                $table->string('vehicle_registration', 32)->nullable();
            }
            if (! Schema::hasColumn('assets', 'chassis_vin')) {
                $table->string('chassis_vin', 64)->nullable();
            }
            if (! Schema::hasColumn('assets', 'barcode')) {
                $table->string('barcode', 64)->nullable();
            }
            if (! Schema::hasColumn('assets', 'owner_name')) {
                $table->string('owner_name')->default('SADC Parliamentary Forum');
            }
            if (! Schema::hasColumn('assets', 'replacement_due_on')) {
                $table->date('replacement_due_on')->nullable();
            }
        });

        Schema::table('asset_verification_campaigns', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_verification_campaigns', 'scope')) {
                $table->json('scope')->nullable();
            }
        });

        Schema::table('asset_maintenance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('asset_maintenance_records', 'severity')) {
                $table->string('severity', 32)->nullable();
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'quotation_amount')) {
                $table->decimal('quotation_amount', 14, 2)->nullable();
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'parts')) {
                $table->text('parts')->nullable();
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'warranty_claim')) {
                $table->boolean('warranty_claim')->default(false);
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'outcome')) {
                $table->string('outcome')->nullable();
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'sent_on')) {
                $table->date('sent_on')->nullable();
            }
            if (! Schema::hasColumn('asset_maintenance_records', 'returned_on')) {
                $table->date('returned_on')->nullable();
            }
        });

        $this->grantAppUser([
            'asset_recovery_contacts',
            'asset_recovery_contact_versions',
            'asset_subcategories',
            'asset_numbering_policies',
            'asset_number_sequences',
            'asset_labels',
            'asset_checkouts',
            'asset_transfers',
            'asset_incidents',
            'asset_timeline_events',
            'asset_condition_assessments',
        ]);
    }

    public function down(): void
    {
        Schema::table('asset_maintenance_records', function (Blueprint $table) {
            foreach (['severity', 'quotation_amount', 'parts', 'warranty_claim', 'outcome', 'sent_on', 'returned_on'] as $col) {
                if (Schema::hasColumn('asset_maintenance_records', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::table('asset_verification_campaigns', function (Blueprint $table) {
            if (Schema::hasColumn('asset_verification_campaigns', 'scope')) {
                $table->dropColumn('scope');
            }
        });
        Schema::table('assets', function (Blueprint $table) {
            foreach ([
                'subcategory_id', 'ownership_type', 'funding_source_id', 'home_location_id',
                'received_date', 'supplier_name', 'vat_amount', 'budget_line', 'capitalisation_date',
                'imei', 'vehicle_registration', 'chassis_vin', 'barcode', 'owner_name', 'replacement_due_on',
            ] as $col) {
                if (Schema::hasColumn('assets', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('asset_condition_assessments');
        Schema::dropIfExists('asset_timeline_events');
        Schema::dropIfExists('asset_incidents');
        Schema::dropIfExists('asset_transfers');
        Schema::dropIfExists('asset_checkouts');
        Schema::table('asset_label_batch_items', function (Blueprint $table) {
            foreach (['recovery_contact_version', 'printed_custodian_id', 'printed_location_id', 'printed_description', 'asset_label_id'] as $col) {
                if (Schema::hasColumn('asset_label_batch_items', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('asset_labels');
        Schema::dropIfExists('asset_number_sequences');
        Schema::dropIfExists('asset_numbering_policies');
        Schema::dropIfExists('asset_subcategories');
        Schema::dropIfExists('asset_recovery_contact_versions');
        Schema::dropIfExists('asset_recovery_contacts');
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
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }
};
