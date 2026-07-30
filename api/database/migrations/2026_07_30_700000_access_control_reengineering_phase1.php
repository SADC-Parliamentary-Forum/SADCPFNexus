<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('access_role_catalogues')) {
            Schema::create('access_role_catalogues', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->string('key')->index();
                $table->string('name');
                $table->text('purpose')->nullable();
                $table->unsignedBigInteger('owner_user_id')->nullable();
                $table->string('risk_level')->default('medium');
                $table->string('status')->default('active');
                $table->json('default_scopes')->nullable();
                $table->boolean('feature_only')->default(false);
                $table->boolean('read_only')->default(false);
                $table->boolean('no_business_approve')->default(false);
                $table->timestamp('review_due_at')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'key']);
            });
        }

        if (! Schema::hasTable('access_role_versions')) {
            Schema::create('access_role_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('role_catalogue_id')->constrained('access_role_catalogues')->cascadeOnDelete();
                $table->unsignedInteger('version');
                $table->string('status')->default('draft');
                $table->json('permissions');
                $table->text('changelog')->nullable();
                $table->unsignedBigInteger('published_by')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
                $table->unique(['role_catalogue_id', 'version']);
            });
        }

        if (! Schema::hasTable('access_role_assignments')) {
            Schema::create('access_role_assignments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->foreignId('role_version_id')->constrained('access_role_versions')->cascadeOnDelete();
                $table->string('assignment_type')->default('standing');
                $table->string('scope_type')->default('organisation');
                $table->string('scope_reference')->nullable();
                $table->timestamp('valid_from')->nullable();
                $table->timestamp('valid_until')->nullable();
                $table->string('status')->default('pending');
                $table->text('reason')->nullable();
                $table->unsignedBigInteger('requested_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->unsignedBigInteger('revoked_by')->nullable();
                $table->timestamp('revoked_at')->nullable();
                $table->timestamp('review_due_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_permission_grants')) {
            Schema::create('user_permission_grants', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('permission_key')->index();
                $table->string('scope_type')->default('self');
                $table->string('scope_reference')->nullable();
                $table->timestamp('valid_from')->nullable();
                $table->timestamp('valid_until')->nullable();
                $table->string('status')->default('active');
                $table->text('reason')->nullable();
                $table->unsignedBigInteger('granted_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_permission_denials')) {
            Schema::create('user_permission_denials', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('permission_key')->index();
                $table->string('scope_type')->nullable();
                $table->string('scope_reference')->nullable();
                $table->timestamp('valid_from')->nullable();
                $table->timestamp('valid_until')->nullable();
                $table->string('status')->default('active');
                $table->text('reason')->nullable();
                $table->unsignedBigInteger('denied_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('access_permission_requests')) {
            Schema::create('access_permission_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('requester_id')->index();
                $table->string('permission_key')->nullable();
                $table->string('role_catalogue_key')->nullable();
                $table->string('scope_type')->default('self');
                $table->string('scope_reference')->nullable();
                $table->text('business_reason');
                $table->string('sensitivity')->default('Internal');
                $table->timestamp('valid_from')->nullable();
                $table->timestamp('valid_until')->nullable();
                $table->string('status')->default('pending_supervisor');
                $table->unsignedBigInteger('supervisor_id')->nullable();
                $table->string('supervisor_decision')->nullable();
                $table->timestamp('supervisor_decided_at')->nullable();
                $table->unsignedBigInteger('approver_id')->nullable();
                $table->string('approver_decision')->nullable();
                $table->timestamp('approver_decided_at')->nullable();
                $table->json('sod_result')->nullable();
                $table->timestamps();
            });
        }

        // Reuse People & Authority access_review_campaigns / access_review_items — do not recreate.

        if (! Schema::hasTable('access_governance_decisions')) {
            Schema::create('access_governance_decisions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->string('topic');
                $table->string('status')->default('pending');
                $table->text('decision_notes')->nullable();
                $table->unsignedBigInteger('owner_user_id')->nullable();
                $table->timestamp('due_at')->nullable();
                $table->timestamp('decided_at')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('access_permission_registry')) {
            Schema::create('access_permission_registry', function (Blueprint $table) {
                $table->id();
                $table->string('permission_key')->unique();
                $table->string('display_name');
                $table->text('description')->nullable();
                $table->string('module')->index();
                $table->string('feature')->nullable();
                $table->string('action')->nullable();
                $table->json('supported_scopes')->nullable();
                $table->string('risk_level')->default('medium');
                $table->string('data_classification')->default('Internal');
                $table->boolean('mfa_required')->default(false);
                $table->json('linked_routes')->nullable();
                $table->json('linked_endpoints')->nullable();
                $table->timestamps();
            });
        }

        $this->seedRegistryAndPermissions();
        $this->seedRoleTemplates();
        $this->seedGovernanceChecklist();
    }

    public function down(): void
    {
        Schema::dropIfExists('access_permission_registry');
        Schema::dropIfExists('access_governance_decisions');
        Schema::dropIfExists('access_permission_requests');
        Schema::dropIfExists('user_permission_denials');
        Schema::dropIfExists('user_permission_grants');
        Schema::dropIfExists('access_role_assignments');
        Schema::dropIfExists('access_role_versions');
        Schema::dropIfExists('access_role_catalogues');
    }

    private function seedRegistryAndPermissions(): void
    {
        $permissions = config('access_control.permissions', []);
        $now = now();

        foreach ($permissions as $key => $meta) {
            DB::table('access_permission_registry')->updateOrInsert(
                ['permission_key' => $key],
                [
                    'display_name' => $meta['display_name'] ?? $key,
                    'description' => $meta['description'] ?? null,
                    'module' => $meta['module'] ?? 'general',
                    'feature' => $meta['feature'] ?? null,
                    'action' => $meta['action'] ?? null,
                    'supported_scopes' => json_encode($meta['supported_scopes'] ?? []),
                    'risk_level' => $meta['risk_level'] ?? 'medium',
                    'data_classification' => $meta['data_classification'] ?? 'Internal',
                    'mfa_required' => (bool) ($meta['mfa_required'] ?? false),
                    'linked_routes' => json_encode($meta['linked_routes'] ?? []),
                    'linked_endpoints' => json_encode($meta['linked_endpoints'] ?? []),
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            foreach (['sanctum', 'web'] as $guard) {
                Permission::findOrCreate($key, $guard);
            }
        }

        foreach (['sanctum', 'web'] as $guard) {
            foreach (['System Admin', 'super-admin'] as $roleName) {
                $role = Role::findOrCreate($roleName, $guard);
                $role->syncPermissions(Permission::where('guard_name', $guard)->get());
            }
        }
    }

    private function seedRoleTemplates(): void
    {
        $templates = config('access_control.role_templates', []);

        foreach ($templates as $name => $meta) {
            $key = \Illuminate\Support\Str::slug($name, '_');
            $existing = DB::table('access_role_catalogues')->whereNull('tenant_id')->where('key', $key)->first();
            if ($existing) {
                $catalogueId = $existing->id;
            } else {
                $catalogueId = DB::table('access_role_catalogues')->insertGetId([
                    'tenant_id' => null,
                    'key' => $key,
                    'name' => $name,
                    'purpose' => $meta['purpose'] ?? null,
                    'risk_level' => $meta['risk_level'] ?? 'medium',
                    'status' => 'active',
                    'default_scopes' => json_encode(['organisation']),
                    'feature_only' => (bool) ($meta['feature_only'] ?? false),
                    'read_only' => (bool) ($meta['read_only'] ?? false),
                    'no_business_approve' => (bool) ($meta['no_business_approve'] ?? false),
                    'meta' => json_encode(['legacy_roles' => $meta['legacy_roles'] ?? []]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $perms = $meta['permissions'] ?? [];
            foreach ($meta['inherits'] ?? [] as $parent) {
                $parentMeta = $templates[$parent] ?? null;
                if ($parentMeta) {
                    $perms = array_values(array_unique(array_merge($parentMeta['permissions'] ?? [], $perms)));
                }
            }

            $hasVersion = DB::table('access_role_versions')
                ->where('role_catalogue_id', $catalogueId)
                ->where('version', 1)
                ->exists();
            if (! $hasVersion) {
                DB::table('access_role_versions')->insert([
                    'role_catalogue_id' => $catalogueId,
                    'version' => 1,
                    'status' => 'active',
                    'permissions' => json_encode($perms),
                    'changelog' => 'Initial published template from PRD §11',
                    'published_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            foreach (['sanctum', 'web'] as $guard) {
                $role = Role::findOrCreate($name, $guard);
                if (! empty($perms) && ! in_array($name, ['System Admin', 'super-admin'], true)) {
                    $existingPerms = $role->permissions()->pluck('name')->all();
                    $merged = array_values(array_unique(array_merge($existingPerms, $perms)));
                    $role->syncPermissions(
                        Permission::where('guard_name', $guard)->whereIn('name', $merged)->get()
                    );
                }
            }
        }
    }

    private function seedGovernanceChecklist(): void
    {
        $topics = [
            'MFA policy for privileged roles',
            'Privileged access review cadence (quarterly)',
            'Break-glass emergency access procedure',
            'Finance/HR/procurement restricted-role review cadence',
            'Standard role six-month review cadence',
            'Session revocation on role change',
            'Pen-test engagement before Phase 8 cutover',
        ];

        foreach ($topics as $topic) {
            $exists = DB::table('access_governance_decisions')->where('topic', $topic)->exists();
            if ($exists) {
                continue;
            }
            DB::table('access_governance_decisions')->insert([
                'tenant_id' => null,
                'topic' => $topic,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
