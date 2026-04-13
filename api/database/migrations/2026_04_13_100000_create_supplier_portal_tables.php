<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('vendor_id')->nullable()->after('department_id')->constrained('vendors')->nullOnDelete();
        });

        Schema::table('vendors', function (Blueprint $table) {
            $table->string('status', 40)->default('draft')->after('is_active');
            $table->string('risk_level', 40)->nullable()->after('status');
            $table->timestamp('submitted_at')->nullable()->after('risk_level');
            $table->timestamp('rejected_at')->nullable()->after('approved_at');
            $table->foreignId('rejected_by')->nullable()->after('approved_by')->constrained('users')->nullOnDelete();
            $table->timestamp('suspended_at')->nullable()->after('rejected_at');
            $table->text('suspension_reason')->nullable()->after('suspended_at');
            $table->text('last_info_request_reason')->nullable()->after('suspension_reason');
        });

        Schema::create('supplier_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 100);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('vendor_supplier_category', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_category_id')->constrained('supplier_categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['vendor_id', 'supplier_category_id']);
        });

        Schema::create('supplier_approval_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('action', 60);
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('performed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('procurement_request_supplier_category', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_category_id')->constrained('supplier_categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['procurement_request_id', 'supplier_category_id'], 'procurement_request_supplier_category_unique');
        });

        Schema::create('rfq_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->string('invitation_type', 20)->default('system');
            $table->string('status', 40)->default('pending');
            $table->string('invited_name')->nullable();
            $table->string('invited_email')->nullable();
            $table->string('response_token', 120)->nullable()->unique();
            $table->timestamp('response_expires_at')->nullable();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('last_notified_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->foreignId('rfq_issued_by')->nullable()->after('rfq_issued_at')->constrained('users')->nullOnDelete();
        });

        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->foreignId('rfq_invitation_id')->nullable()->after('procurement_request_id')->constrained('rfq_invitations')->nullOnDelete();
            $table->foreignId('submitted_by_user_id')->nullable()->after('vendor_id')->constrained('users')->nullOnDelete();
            $table->string('submission_channel', 40)->nullable()->after('currency');
            $table->boolean('compliance_passed')->nullable()->after('is_recommended');
            $table->text('compliance_notes')->nullable()->after('compliance_passed');
            $table->foreignId('assessed_by')->nullable()->after('compliance_notes')->constrained('users')->nullOnDelete();
            $table->timestamp('assessed_at')->nullable()->after('assessed_by');
        });

        Schema::table('vendor_performance_evaluations', function (Blueprint $table) {
            $table->unsignedTinyInteger('price_score')->default(3)->after('quality_score');
        });

        DB::table('vendors')->orderBy('id')->get()->each(function (object $vendor): void {
            $status = 'draft';

            if (($vendor->is_blacklisted ?? false) === true) {
                $status = 'blacklisted';
            } elseif (($vendor->is_approved ?? false) === true && ($vendor->is_active ?? false) === true) {
                $status = 'approved';
            } elseif (($vendor->is_active ?? false) === false && !empty($vendor->rejection_reason ?? null)) {
                $status = 'rejected';
            } elseif (($vendor->is_active ?? false) === false) {
                $status = 'suspended';
            } elseif (($vendor->is_active ?? false) === true) {
                $status = 'pending_approval';
            }

            DB::table('vendors')
                ->where('id', $vendor->id)
                ->update([
                    'status'       => $status,
                    'submitted_at' => ($vendor->is_approved ?? false) || !empty($vendor->rejection_reason ?? null) ? ($vendor->created_at ?? now()) : null,
                ]);
        });

        $defaultCategories = [
            ['code' => 'ict_equipment', 'name' => 'ICT Equipment'],
            ['code' => 'consultancy_services', 'name' => 'Consultancy Services'],
            ['code' => 'printing_media', 'name' => 'Printing & Media'],
            ['code' => 'logistics_transport', 'name' => 'Logistics & Transport'],
            ['code' => 'events_management', 'name' => 'Events Management'],
        ];

        $tenants = DB::table('tenants')->select('id')->get();
        foreach ($tenants as $tenant) {
            foreach ($defaultCategories as $category) {
                DB::table('supplier_categories')->updateOrInsert(
                    ['tenant_id' => $tenant->id, 'code' => $category['code']],
                    [
                        'name'        => $category['name'],
                        'description' => null,
                        'is_active'   => true,
                        'updated_at'  => now(),
                        'created_at'  => now(),
                    ]
                );
            }
        }

        if (DB::getDriverName() === 'pgsql') {
            $user = 'app_user';
            foreach ([
                'supplier_categories',
                'vendor_supplier_category',
                'supplier_approval_logs',
                'procurement_request_supplier_category',
                'rfq_invitations',
            ] as $table) {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO \"{$user}\"");
            }

            foreach ([
                'supplier_categories_id_seq',
                'vendor_supplier_category_id_seq',
                'supplier_approval_logs_id_seq',
                'procurement_request_supplier_category_id_seq',
                'rfq_invitations_id_seq',
            ] as $sequence) {
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$sequence} TO \"{$user}\"");
            }
        }
    }

    public function down(): void
    {
        Schema::table('vendor_performance_evaluations', function (Blueprint $table) {
            $table->dropColumn('price_score');
        });

        Schema::table('procurement_quotes', function (Blueprint $table) {
            $table->dropForeign(['rfq_invitation_id']);
            $table->dropForeign(['submitted_by_user_id']);
            $table->dropForeign(['assessed_by']);
            $table->dropColumn([
                'rfq_invitation_id',
                'submitted_by_user_id',
                'submission_channel',
                'compliance_passed',
                'compliance_notes',
                'assessed_by',
                'assessed_at',
            ]);
        });

        Schema::table('procurement_requests', function (Blueprint $table) {
            $table->dropForeign(['rfq_issued_by']);
            $table->dropColumn('rfq_issued_by');
        });

        Schema::dropIfExists('rfq_invitations');
        Schema::dropIfExists('procurement_request_supplier_category');
        Schema::dropIfExists('supplier_approval_logs');
        Schema::dropIfExists('vendor_supplier_category');
        Schema::dropIfExists('supplier_categories');

        Schema::table('vendors', function (Blueprint $table) {
            $table->dropForeign(['rejected_by']);
            $table->dropColumn([
                'status',
                'risk_level',
                'submitted_at',
                'rejected_at',
                'rejected_by',
                'suspended_at',
                'suspension_reason',
                'last_info_request_reason',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['vendor_id']);
            $table->dropColumn('vendor_id');
        });
    }
};
