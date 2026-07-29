<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_control_testing_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('campaign_code', 40);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 24)->default('draft'); // draft|scheduled|in_progress|completed|cancelled
            $table->date('scheduled_start')->nullable();
            $table->date('scheduled_end')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'campaign_code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('risk_control_testing_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->constrained('risk_control_testing_campaigns')->cascadeOnDelete();
            $table->foreignId('control_id')->constrained('risk_controls')->cascadeOnDelete();
            $table->foreignId('risk_id')->nullable()->constrained('risks')->nullOnDelete();
            $table->string('status', 24)->default('pending'); // pending|in_progress|passed|failed|waived|overdue
            $table->date('due_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('result', 16)->nullable(); // pass|fail|waive
            $table->text('checklist_notes')->nullable();
            $table->text('evidence_notes')->nullable();
            $table->string('evidence_path')->nullable();
            $table->foreignId('tested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['campaign_id', 'control_id']);
            $table->index(['tenant_id', 'status', 'due_at']);
        });

        Schema::create('risk_bcp_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_id')->constrained('risks')->cascadeOnDelete();
            $table->string('link_type', 32); // bcp_note|insurance_policy
            $table->string('title');
            $table->text('notes')->nullable();
            $table->foreignId('asset_insurance_policy_id')->nullable()->constrained('asset_insurance_policies')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'risk_id']);
            $table->index(['tenant_id', 'link_type']);
        });

        Schema::create('risk_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_id')->constrained('risks')->cascadeOnDelete();
            $table->foreignId('related_risk_id')->constrained('risks')->cascadeOnDelete();
            $table->string('relation_type', 32)->default('depends_on'); // depends_on|related_to
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['risk_id', 'related_risk_id', 'relation_type'], 'risk_dep_unique');
            $table->index(['tenant_id', 'risk_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_dependencies');
        Schema::dropIfExists('risk_bcp_links');
        Schema::dropIfExists('risk_control_testing_items');
        Schema::dropIfExists('risk_control_testing_campaigns');
    }
};
