<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('numbering_schemes')) {
            Schema::table('numbering_schemes', function (Blueprint $table) {
                if (! Schema::hasColumn('numbering_schemes', 'document_type')) {
                    $table->string('document_type', 40)->nullable()->after('scheme_key');
                }
                if (! Schema::hasColumn('numbering_schemes', 'pattern')) {
                    $table->string('pattern', 120)->nullable()->after('example');
                }
                if (! Schema::hasColumn('numbering_schemes', 'scope_type')) {
                    $table->string('scope_type', 40)->default('organisation')->after('pattern');
                }
                if (! Schema::hasColumn('numbering_schemes', 'scope_id')) {
                    $table->unsignedBigInteger('scope_id')->nullable()->after('scope_type');
                }
            });

            DB::table('numbering_schemes')->where('scheme_key', 'lpo')->whereNull('document_type')->update([
                'document_type' => 'purchase_order',
                'pattern' => 'S {SEQ:5}',
                'scope_type' => 'organisation',
            ]);
        }

        Schema::create('numbering_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('numbering_scheme_id')->nullable();
            $table->string('document_type', 40)->default('purchase_order');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->unsignedBigInteger('sequence_number')->nullable();
            $table->string('display_reference', 80);
            $table->string('normalised_reference', 80);
            $table->string('allocation_type', 20)->default('auto');
            $table->text('reason')->nullable();
            $table->boolean('continue_sequence')->default(false);
            $table->unsignedBigInteger('allocated_by')->nullable();
            $table->timestamp('allocated_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('numbering_scheme_id')->references('id')->on('numbering_schemes')->nullOnDelete();
            $table->foreign('allocated_by')->references('id')->on('users')->nullOnDelete();
            $table->unique(['tenant_id', 'document_type', 'normalised_reference'], 'num_alloc_norm_unique');
            $table->index(['tenant_id', 'subject_type', 'subject_id']);
        });

        Schema::create('document_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('document_type', 40)->default('purchase_order');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('page_size', 16)->default('a4');
            $table->string('orientation', 16)->default('portrait');
            $table->string('status', 20)->default('draft');
            $table->boolean('is_default')->default(false);
            $table->json('matching_rules')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['tenant_id', 'document_type', 'status']);
        });

        Schema::create('document_template_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('document_template_id');
            $table->unsignedInteger('version')->default(1);
            $table->json('layout_json');
            $table->string('field_catalog_hash', 64)->nullable();
            $table->string('status', 20)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('published_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('document_template_id')->references('id')->on('document_templates')->cascadeOnDelete();
            $table->foreign('published_by')->references('id')->on('users')->nullOnDelete();
            $table->unique(['document_template_id', 'version'], 'doc_tpl_ver_unique');
        });

        Schema::create('document_outputs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id');
            $table->unsignedBigInteger('template_version_id')->nullable();
            $table->unsignedBigInteger('file_attachment_id')->nullable();
            $table->json('data_snapshot')->nullable();
            $table->json('workflow_snapshot')->nullable();
            $table->string('document_hash', 64);
            $table->string('verify_token', 64);
            $table->string('status', 20)->default('preview');
            $table->timestamp('generated_at')->nullable();
            $table->unsignedBigInteger('generated_by')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('template_version_id')->references('id')->on('document_template_versions')->nullOnDelete();
            $table->foreign('generated_by')->references('id')->on('users')->nullOnDelete();
            $table->unique('verify_token');
            $table->index(['tenant_id', 'subject_type', 'subject_id']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('normalised_reference', 80)->nullable()->after('reference_number');
            $table->unsignedBigInteger('numbering_scheme_id')->nullable()->after('lpo_sequence_number');
            $table->unsignedBigInteger('allocation_id')->nullable()->after('numbering_scheme_id');
            $table->string('reference_allocation_type', 20)->default('pending')->after('allocation_id');
            $table->unsignedBigInteger('document_template_id')->nullable()->after('final_document_hash');
            $table->unsignedBigInteger('issued_template_version_id')->nullable()->after('document_template_id');
            $table->unsignedBigInteger('issued_document_output_id')->nullable()->after('issued_template_version_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX po_tenant_norm_ref_unique ON purchase_orders (tenant_id, normalised_reference) WHERE normalised_reference IS NOT NULL AND deleted_at IS NULL');
        } else {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->unique(['tenant_id', 'normalised_reference'], 'po_tenant_norm_ref_unique');
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            foreach ([
                'numbering_allocations',
                'document_templates',
                'document_template_versions',
                'document_outputs',
            ] as $table) {
                try {
                    DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
                    DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
                } catch (\Throwable) {
                    // Role may be absent in local/test databases.
                }
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS po_tenant_norm_ref_unique');
        }

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'normalised_reference',
                'numbering_scheme_id',
                'allocation_id',
                'reference_allocation_type',
                'document_template_id',
                'issued_template_version_id',
                'issued_document_output_id',
            ]);
        });

        Schema::dropIfExists('document_outputs');
        Schema::dropIfExists('document_template_versions');
        Schema::dropIfExists('document_templates');
        Schema::dropIfExists('numbering_allocations');

        Schema::table('numbering_schemes', function (Blueprint $table) {
            if (Schema::hasColumn('numbering_schemes', 'scope_id')) {
                $table->dropColumn(['document_type', 'pattern', 'scope_type', 'scope_id']);
            }
        });
    }
};
