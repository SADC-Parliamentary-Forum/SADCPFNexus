<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondence', function (Blueprint $table) {
            $table->string('registry_reference', 64)->nullable()->after('reference_number');
            $table->date('correspondence_date')->nullable()->after('direction');
            $table->timestamp('received_at')->nullable();
            $table->string('channel', 32)->nullable(); // email|post|hand|courier|fax|other
            $table->string('sender_name')->nullable();
            $table->string('sender_organisation')->nullable();
            $table->string('sender_country', 64)->nullable();
            $table->string('sender_reference', 128)->nullable();
            $table->foreignId('sender_contact_id')->nullable()->constrained('correspondence_contacts')->nullOnDelete();
            $table->string('attention_to')->nullable();
            $table->text('summary')->nullable();
            $table->string('confidentiality', 32)->default('general_official');
            $table->boolean('content_restricted')->default(false);
            $table->foreignId('primary_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('response_required')->default(false);
            $table->date('sender_deadline')->nullable();
            $table->date('internal_deadline')->nullable();
            $table->date('final_deadline')->nullable();
            $table->timestamp('original_immutable_at')->nullable();
            $table->timestamp('signed_immutable_at')->nullable();
            $table->foreignId('signed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('signature_event_id')->nullable();
            $table->timestamp('letterhead_applied_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->foreignId('thread_root_id')->nullable()->constrained('correspondence')->nullOnDelete();
            $table->string('physical_location')->nullable();
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('registered_at')->nullable();
            $table->text('sg_instruction')->nullable();
            $table->string('sg_action', 64)->nullable();

            $table->index(['tenant_id', 'registry_reference']);
            $table->index(['tenant_id', 'confidentiality']);
            $table->index(['tenant_id', 'primary_owner_id']);
            $table->index(['tenant_id', 'received_at']);
        });

        Schema::create('correspondence_reference_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('direction', 8); // incoming|outgoing
            $table->unsignedSmallInteger('year');
            $table->string('series', 32)->default('default');
            $table->unsignedInteger('sequence');
            $table->string('reference', 64);
            $table->foreignId('correspondence_id')->nullable()->constrained('correspondence')->nullOnDelete();
            $table->string('status', 16)->default('active'); // active|voided|reserved
            $table->text('void_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'direction', 'year', 'series', 'sequence'], 'corr_ref_seq_unique');
            $table->index(['tenant_id', 'direction', 'year']);
        });

        Schema::create('correspondence_numbering_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('incoming_pattern', 128)->default('IN/{year}/{seq}');
            $table->string('outgoing_pattern', 128)->default('{file}/{signatory}/{preparer}/{seq}/{year}');
            $table->unsignedTinyInteger('incoming_seq_padding')->default(5);
            $table->unsignedTinyInteger('outgoing_seq_padding')->default(4);
            $table->boolean('assign_outgoing_on_approve')->default(true);
            $table->timestamps();

            $table->unique('tenant_id');
        });

        Schema::create('correspondence_subject_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('file_code', 64);
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('correspondence_subject_files')->nullOnDelete();
            $table->string('status', 16)->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'file_code']);
        });

        Schema::create('correspondence_file_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('subject_file_id')->constrained('correspondence_subject_files')->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->unique(['correspondence_id', 'subject_file_id'], 'corr_file_link_unique');
        });

        Schema::create('correspondence_owners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('role', 16); // primary|supporting
            $table->string('action_required', 64)->nullable();
            $table->text('instruction')->nullable();
            $table->date('due_date')->nullable();
            $table->string('ack_status', 32)->nullable(); // viewed|accepted|misrouted
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();

            $table->unique(['correspondence_id', 'user_id', 'role'], 'corr_owner_unique');
            $table->index(['user_id', 'role']);
        });

        Schema::create('correspondence_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('routed_by')->constrained('users')->cascadeOnDelete();
            $table->string('action', 64); // for_information|route_for_action|...
            $table->foreignId('primary_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->text('instruction')->nullable();
            $table->string('priority', 16)->nullable();
            $table->date('due_date')->nullable();
            $table->boolean('response_required')->default(false);
            $table->date('response_due_date')->nullable();
            $table->json('copy_to_user_ids')->nullable();
            $table->json('supporting_owner_ids')->nullable();
            $table->timestamps();

            $table->index(['correspondence_id', 'created_at']);
        });

        Schema::create('correspondence_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->string('visibility', 16)->default('internal'); // internal only in Phase 1
            $table->timestamps();
        });

        Schema::create('correspondence_relationships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('to_correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->string('type', 32); // reply_to|related|duplicate|thread|response_to
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['from_correspondence_id', 'to_correspondence_id', 'type'], 'corr_rel_unique');
        });

        Schema::create('correspondence_dispatches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('dispatched_by')->constrained('users')->cascadeOnDelete();
            $table->string('channel', 32); // email|post|hand|courier|fax|other
            $table->timestamp('dispatched_at');
            $table->string('tracking_reference', 128)->nullable();
            $table->string('delivery_status', 32)->default('dispatched'); // dispatched|in_transit|delivered|failed|returned
            $table->timestamp('delivered_at')->nullable();
            $table->string('recipient_name')->nullable();
            $table->text('evidence_notes')->nullable();
            $table->string('evidence_path')->nullable();
            $table->timestamps();

            $table->index(['correspondence_id', 'dispatched_at']);
        });

        Schema::create('correspondence_assignment_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondence_id')->constrained('correspondence')->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['correspondence_id', 'assignment_id'], 'corr_asn_unique');
        });

        $permissions = [
            'correspondence.registry',
            'correspondence.route',
            'correspondence.dispatch',
            'correspondence.confidential.view',
        ];

        $now = now();
        foreach ($permissions as $name) {
            if (! \DB::table('permissions')->where('name', $name)->where('guard_name', 'sanctum')->exists()) {
                \DB::table('permissions')->insert([
                    'name' => $name,
                    'guard_name' => 'sanctum',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        // Grant new perms to System Admin + Secretary General roles when present
        $roleNames = ['System Admin', 'Secretary General'];
        foreach ($roleNames as $roleName) {
            $role = \DB::table('roles')->where('name', $roleName)->where('guard_name', 'sanctum')->first();
            if (! $role) {
                continue;
            }
            foreach ($permissions as $permName) {
                $perm = \DB::table('permissions')->where('name', $permName)->where('guard_name', 'sanctum')->first();
                if (! $perm) {
                    continue;
                }
                $exists = \DB::table('role_has_permissions')
                    ->where('role_id', $role->id)
                    ->where('permission_id', $perm->id)
                    ->exists();
                if (! $exists) {
                    \DB::table('role_has_permissions')->insert([
                        'permission_id' => $perm->id,
                        'role_id' => $role->id,
                    ]);
                }
            }
        }

        // Registry officers: grant registry+dispatch to roles that already have correspondence.create
        $registryExtras = ['correspondence.registry', 'correspondence.dispatch'];
        $createPerm = \DB::table('permissions')->where('name', 'correspondence.create')->where('guard_name', 'sanctum')->first();
        if ($createPerm) {
            $roleIds = \DB::table('role_has_permissions')->where('permission_id', $createPerm->id)->pluck('role_id');
            foreach ($roleIds as $roleId) {
                foreach ($registryExtras as $permName) {
                    $perm = \DB::table('permissions')->where('name', $permName)->where('guard_name', 'sanctum')->first();
                    if (! $perm) {
                        continue;
                    }
                    $exists = \DB::table('role_has_permissions')
                        ->where('role_id', $roleId)
                        ->where('permission_id', $perm->id)
                        ->exists();
                    if (! $exists) {
                        \DB::table('role_has_permissions')->insert([
                            'permission_id' => $perm->id,
                            'role_id' => $roleId,
                        ]);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondence_assignment_links');
        Schema::dropIfExists('correspondence_dispatches');
        Schema::dropIfExists('correspondence_relationships');
        Schema::dropIfExists('correspondence_notes');
        Schema::dropIfExists('correspondence_routes');
        Schema::dropIfExists('correspondence_owners');
        Schema::dropIfExists('correspondence_file_links');
        Schema::dropIfExists('correspondence_subject_files');
        Schema::dropIfExists('correspondence_numbering_policies');
        Schema::dropIfExists('correspondence_reference_ledger');

        Schema::table('correspondence', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sender_contact_id');
            $table->dropConstrainedForeignId('primary_owner_id');
            $table->dropConstrainedForeignId('signed_by');
            $table->dropConstrainedForeignId('thread_root_id');
            $table->dropConstrainedForeignId('registered_by');
            $cols = [
                'registry_reference', 'correspondence_date', 'received_at', 'channel',
                'sender_name', 'sender_organisation', 'sender_country', 'sender_reference',
                'attention_to', 'summary', 'confidentiality', 'content_restricted',
                'response_required', 'sender_deadline', 'internal_deadline', 'final_deadline',
                'original_immutable_at', 'signed_immutable_at', 'signature_event_id',
                'letterhead_applied_at', 'voided_at', 'void_reason', 'physical_location',
                'registered_at', 'sg_instruction', 'sg_action',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('correspondence', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
