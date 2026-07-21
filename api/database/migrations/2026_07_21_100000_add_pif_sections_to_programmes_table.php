<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            // Section C — Venue
            $table->string('venue_country')->nullable();
            $table->string('venue_city')->nullable();
            $table->string('venue_proposed_hotel')->nullable();
            $table->boolean('venue_accommodation_required')->default(false);
            $table->integer('venue_accommodation_count')->nullable();
            $table->boolean('venue_conferencing_required')->default(false);
            $table->integer('venue_conferencing_participants')->nullable();
            $table->boolean('venue_quotation_attached')->default(false);
            $table->boolean('venue_hotel_quotation_attached')->default(false);
            $table->text('venue_accessibility_requirements')->nullable();
            $table->text('venue_security_considerations')->nullable();
            $table->text('venue_comments')->nullable();

            // Section D — Budget and Participant Provisions
            $table->decimal('proposed_dsa_rate', 10, 2)->nullable();
            $table->decimal('original_budget_rate', 10, 2)->nullable();
            $table->text('dsa_variance_reason')->nullable();
            $table->integer('proposed_participants')->nullable();
            $table->integer('budgeted_participants')->nullable();
            $table->text('participants_variance_reason')->nullable();
            $table->decimal('proposed_funding_difference', 15, 2)->nullable();
            $table->decimal('estimated_activity_amount', 15, 2)->nullable();
            $table->string('budget_availability_status')->default('not_checked');
            // not_checked|available|partially_available|unavailable|confirmed_with_conditions
            $table->text('finance_comments')->nullable();

            // Section E — Consultants and Support Personnel
            $table->boolean('secretariat_staff_required')->default(false);
            $table->integer('secretariat_staff_count')->nullable();
            $table->boolean('consultants_required')->default(false);
            $table->integer('consultants_count')->nullable();
            $table->decimal('consultants_rate', 10, 2)->nullable();
            $table->boolean('resource_persons_required')->default(false);
            $table->integer('resource_persons_count')->nullable();
            $table->decimal('resource_persons_rate', 10, 2)->nullable();
            $table->boolean('rapporteurs_required')->default(false);
            $table->integer('rapporteurs_count')->nullable();
            $table->decimal('rapporteurs_rate', 10, 2)->nullable();
            $table->boolean('media_liaison_required')->default(false);
            $table->integer('media_liaison_count')->nullable();
            $table->boolean('local_support_required')->default(false);
            $table->integer('local_support_count')->nullable();
            $table->decimal('local_support_rate', 10, 2)->nullable();
            $table->text('personnel_comments')->nullable();

            // Section F — Interpretation and Languages
            $table->boolean('interpretation_required')->default(false);
            $table->boolean('en_fr_required')->default(false);
            $table->integer('en_fr_interpreters_count')->nullable();
            $table->boolean('en_pt_required')->default(false);
            $table->integer('en_pt_interpreters_count')->nullable();
            $table->boolean('fr_pt_required')->default(false);
            $table->integer('fr_pt_interpreters_count')->nullable();
            $table->decimal('interpreter_rate', 10, 2)->nullable();
            $table->string('interpreter_source')->nullable(); // internal|supplier|partner|other
            $table->string('interpreter_source_other_note')->nullable();
            $table->boolean('interpretation_equipment_required')->default(false);
            $table->boolean('translation_required')->default(false);
            $table->text('languages_required')->nullable(); // JSON array
            $table->text('interpretation_comments')->nullable();

            // Section H — Support Services
            $table->text('support_services')->nullable(); // JSON array of keys
            $table->text('support_services_other_note')->nullable();

            // Section M — Conflict of Interest
            $table->boolean('conflict_declared')->default(false);
            $table->text('conflict_details')->nullable();
            $table->text('conflict_mitigation')->nullable();
            $table->foreignId('conflict_declared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('conflict_declared_at')->nullable();

            // Section N — Declaration (simplified, single confirmation)
            $table->boolean('declaration_confirmed')->default(false);
            $table->foreignId('declaration_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('declaration_confirmed_at')->nullable();
            $table->string('declaration_version')->nullable();

            // Amendment / supersede tracking
            $table->foreignId('amended_from_id')->nullable()->constrained('programmes')->nullOnDelete();
            $table->timestamp('superseded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('programmes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('conflict_declared_by');
            $table->dropConstrainedForeignId('declaration_confirmed_by');
            $table->dropConstrainedForeignId('amended_from_id');
            $table->dropColumn([
                'venue_country', 'venue_city', 'venue_proposed_hotel',
                'venue_accommodation_required', 'venue_accommodation_count',
                'venue_conferencing_required', 'venue_conferencing_participants',
                'venue_quotation_attached', 'venue_hotel_quotation_attached',
                'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
                'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
                'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
                'proposed_funding_difference', 'estimated_activity_amount',
                'budget_availability_status', 'finance_comments',
                'secretariat_staff_required', 'secretariat_staff_count',
                'consultants_required', 'consultants_count', 'consultants_rate',
                'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
                'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
                'media_liaison_required', 'media_liaison_count',
                'local_support_required', 'local_support_count', 'local_support_rate',
                'personnel_comments',
                'interpretation_required',
                'en_fr_required', 'en_fr_interpreters_count',
                'en_pt_required', 'en_pt_interpreters_count',
                'fr_pt_required', 'fr_pt_interpreters_count',
                'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
                'interpretation_equipment_required', 'translation_required',
                'languages_required', 'interpretation_comments',
                'support_services', 'support_services_other_note',
                'conflict_declared', 'conflict_details', 'conflict_mitigation', 'conflict_declared_at',
                'declaration_confirmed', 'declaration_confirmed_at', 'declaration_version',
                'superseded_at',
            ]);
        });
    }
};
