<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('risks', function (Blueprint $table) {
            $table->unsignedBigInteger('strategic_objective_id')->nullable()->after('department_id');
            $table->string('register_scope', 20)->default('department')->after('category'); // enterprise|department|project
            $table->unsignedBigInteger('project_id')->nullable()->after('register_scope');
            $table->text('cause')->nullable()->after('description');
            $table->text('event_description')->nullable()->after('cause');
            $table->text('consequence')->nullable()->after('event_description');
            $table->unsignedBigInteger('control_owner_id')->nullable()->after('action_owner_id');
            $table->boolean('is_confidential')->default(false)->after('control_owner_id');
            $table->string('treatment_strategy', 20)->nullable()->after('control_effectiveness');
            $table->boolean('residual_reassessment_required')->default(false)->after('residual_score');
            $table->timestamp('materialised_at')->nullable()->after('closed_at');
            $table->text('materialisation_notes')->nullable()->after('materialised_at');
            $table->unsignedBigInteger('linked_incident_id')->nullable()->after('materialisation_notes');
            $table->string('source_type', 40)->nullable()->after('linked_incident_id');
            $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            $table->string('source_purpose', 60)->nullable()->after('source_id');

            $table->foreign('strategic_objective_id')->references('id')->on('strategic_objectives')->nullOnDelete();
            $table->foreign('control_owner_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['tenant_id', 'register_scope']);
            $table->index(['tenant_id', 'is_confidential']);
            $table->index(['tenant_id', 'strategic_objective_id']);
        });

        Schema::create('risk_assessments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('risk_id');
            $table->foreign('risk_id')->references('id')->on('risks')->cascadeOnDelete();
            $table->string('assessment_type', 20); // inherent|residual
            $table->smallInteger('likelihood');
            $table->smallInteger('impact');
            $table->smallInteger('score');
            $table->string('level', 20);
            $table->text('rationale')->nullable();
            $table->unsignedBigInteger('assessed_by');
            $table->foreign('assessed_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamp('assessed_at');
            $table->timestamp('superseded_at')->nullable();
            $table->timestamps();

            $table->index(['risk_id', 'assessment_type', 'superseded_at']);
        });

        Schema::create('risk_controls', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->string('control_code', 40);
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->string('control_type', 30)->default('preventive'); // preventive|detective|corrective|directive
            $table->unsignedBigInteger('control_owner_id')->nullable();
            $table->foreign('control_owner_id')->references('id')->on('users')->nullOnDelete();
            $table->string('effectiveness', 20)->default('partial'); // none|partial|adequate|strong|ineffective
            $table->string('status', 20)->default('active'); // active|inactive|retired
            $table->string('frequency', 30)->nullable();
            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'control_code']);
        });

        Schema::create('risk_control_risk', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('risk_id');
            $table->foreign('risk_id')->references('id')->on('risks')->cascadeOnDelete();
            $table->unsignedBigInteger('control_id');
            $table->foreign('control_id')->references('id')->on('risk_controls')->cascadeOnDelete();
            $table->string('effectiveness_rating', 20)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('linked_by')->nullable();
            $table->foreign('linked_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['risk_id', 'control_id']);
        });

        Schema::create('risk_appetite_policies', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('title', 200);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->jsonb('matrix_thresholds'); // {low_max, medium_max, high_max}
            $table->jsonb('acceptance_authority'); // {low:[], medium:[], high:[], critical:[]}
            $table->text('tolerance_statement')->nullable();
            $table->boolean('is_active')->default(false);
            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'version']);
        });

        Schema::create('risk_acceptances', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedBigInteger('risk_id');
            $table->foreign('risk_id')->references('id')->on('risks')->cascadeOnDelete();
            $table->text('justification');
            $table->date('expires_at');
            $table->string('status', 20)->default('pending'); // pending|approved|rejected|expired|revoked
            $table->smallInteger('residual_likelihood');
            $table->smallInteger('residual_impact');
            $table->smallInteger('residual_score');
            $table->string('residual_level', 20);
            $table->unsignedBigInteger('requested_by');
            $table->foreign('requested_by')->references('id')->on('users')->cascadeOnDelete();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('decision_notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('risk_incidents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->string('incident_code', 40);
            $table->string('title', 300);
            $table->text('description');
            $table->unsignedBigInteger('risk_id')->nullable();
            $table->foreign('risk_id')->references('id')->on('risks')->nullOnDelete();
            $table->string('severity', 20)->default('medium'); // low|medium|high|critical
            $table->string('status', 20)->default('open'); // open|investigating|contained|closed
            $table->timestamp('occurred_at')->nullable();
            $table->unsignedBigInteger('reported_by');
            $table->foreign('reported_by')->references('id')->on('users')->cascadeOnDelete();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->boolean('is_confidential')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'incident_code']);
        });

        Schema::table('risk_actions', function (Blueprint $table) {
            $table->unsignedBigInteger('assignment_id')->nullable()->after('owner_id');
            $table->foreign('assignment_id')->references('id')->on('assignments')->nullOnDelete();
        });

        // Seed default appetite policy per existing tenants is left to seeder/runtime activate.
        if (Schema::hasTable('tenants') && Schema::hasTable('users')) {
            // no-op seed here — RiskAppetiteService creates default on first read
        }
    }

    public function down(): void
    {
        Schema::table('risk_actions', function (Blueprint $table) {
            $table->dropForeign(['assignment_id']);
            $table->dropColumn('assignment_id');
        });

        Schema::dropIfExists('risk_incidents');
        Schema::dropIfExists('risk_acceptances');
        Schema::dropIfExists('risk_appetite_policies');
        Schema::dropIfExists('risk_control_risk');
        Schema::dropIfExists('risk_controls');
        Schema::dropIfExists('risk_assessments');

        Schema::table('risks', function (Blueprint $table) {
            $table->dropForeign(['strategic_objective_id']);
            $table->dropForeign(['control_owner_id']);
            $table->dropColumn([
                'strategic_objective_id', 'register_scope', 'project_id',
                'cause', 'event_description', 'consequence',
                'control_owner_id', 'is_confidential', 'treatment_strategy',
                'residual_reassessment_required', 'materialised_at', 'materialisation_notes',
                'linked_incident_id', 'source_type', 'source_id', 'source_purpose',
            ]);
        });
    }
};
