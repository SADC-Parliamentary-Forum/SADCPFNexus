<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'audit.universe.manage',
        'audit.plan.manage',
        'audit.plan.approve',
        'audit.engagement.manage',
        'audit.engagement.fieldwork',
        'audit.findings.issue',
        'audit.findings.view',
        'audit.response.manage',
        'audit.corrective.manage',
        'audit.corrective.verify',
        'audit.workpapers.manage',
        'audit.workpapers.review',
        'audit.report.draft',
        'audit.report.issue',
        'audit.external.coordinate',
        'audit.dashboard.auditor',
        'audit.dashboard.management',
        'audit.dashboard.sg',
        'audit.settings.view',
        'audit.events.view',
        'audit.confidential.view',
        'audit.admin',
        // keep legacy aliases usable
        'audit.view',
        'audit.export',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            foreach ($this->permissions as $name) {
                Permission::firstOrCreate(['name' => $name, 'guard_name' => $guard]);
            }

            $all = Permission::whereIn('name', $this->permissions)->where('guard_name', $guard)->get();

            foreach (['System Admin', 'super-admin'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo($all);
                }
            }

            $ia = Role::firstOrCreate(['name' => 'Internal Auditor', 'guard_name' => $guard]);
            $ia->givePermissionTo(Permission::whereIn('name', [
                'audit.view', 'audit.export',
                'audit.universe.manage', 'audit.plan.manage',
                'audit.engagement.manage', 'audit.engagement.fieldwork',
                'audit.findings.issue', 'audit.findings.view',
                'audit.workpapers.manage', 'audit.workpapers.review',
                'audit.report.draft', 'audit.report.issue',
                'audit.corrective.verify',
                'audit.external.coordinate',
                'audit.dashboard.auditor',
                'audit.settings.view', 'audit.events.view',
                'audit.confidential.view',
            ])->where('guard_name', $guard)->get());

            $sg = Role::where('name', 'Secretary General')->where('guard_name', $guard)->first();
            if ($sg) {
                $sg->givePermissionTo(Permission::whereIn('name', [
                    'audit.view', 'audit.plan.approve', 'audit.findings.view',
                    'audit.dashboard.sg', 'audit.dashboard.management',
                    'audit.settings.view', 'audit.events.view',
                ])->where('guard_name', $guard)->get());
            }

            $gov = Role::where('name', 'Governance Officer')->where('guard_name', $guard)->first();
            if ($gov) {
                $gov->givePermissionTo(Permission::whereIn('name', [
                    'audit.view', 'audit.plan.approve', 'audit.findings.view',
                    'audit.dashboard.management', 'audit.settings.view',
                ])->where('guard_name', $guard)->get());
            }

            foreach (['Director', 'HOD', 'staff'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(Permission::whereIn('name', [
                        'audit.view', 'audit.findings.view',
                        'audit.response.manage', 'audit.corrective.manage',
                        'audit.dashboard.management',
                    ])->where('guard_name', $guard)->get());
                }
            }
        }

        // Seed default audit types, ratings, root-cause categories (global tenant_id null).
        if (\Illuminate\Support\Facades\Schema::hasTable('audit_lookups')) {
            $lookups = [
                ['category' => 'audit_type', 'code' => 'assurance', 'label' => 'Assurance', 'sort_order' => 1],
                ['category' => 'audit_type', 'code' => 'compliance', 'label' => 'Compliance', 'sort_order' => 2],
                ['category' => 'audit_type', 'code' => 'performance', 'label' => 'Performance', 'sort_order' => 3],
                ['category' => 'audit_type', 'code' => 'it', 'label' => 'IT / Systems', 'sort_order' => 4],
                ['category' => 'audit_type', 'code' => 'follow_up', 'label' => 'Follow-up', 'sort_order' => 5],
                ['category' => 'audit_type', 'code' => 'special', 'label' => 'Special / Ad-hoc', 'sort_order' => 6],
                ['category' => 'rating', 'code' => 'critical', 'label' => 'Critical', 'sort_order' => 1],
                ['category' => 'rating', 'code' => 'high', 'label' => 'High', 'sort_order' => 2],
                ['category' => 'rating', 'code' => 'medium', 'label' => 'Medium', 'sort_order' => 3],
                ['category' => 'rating', 'code' => 'low', 'label' => 'Low', 'sort_order' => 4],
                ['category' => 'rating', 'code' => 'advisory', 'label' => 'Advisory', 'sort_order' => 5],
                ['category' => 'root_cause', 'code' => 'policy_gap', 'label' => 'Policy / procedure gap', 'sort_order' => 1],
                ['category' => 'root_cause', 'code' => 'control_design', 'label' => 'Control design weakness', 'sort_order' => 2],
                ['category' => 'root_cause', 'code' => 'control_operating', 'label' => 'Control operating failure', 'sort_order' => 3],
                ['category' => 'root_cause', 'code' => 'capacity', 'label' => 'Capacity / resourcing', 'sort_order' => 4],
                ['category' => 'root_cause', 'code' => 'training', 'label' => 'Training / awareness', 'sort_order' => 5],
                ['category' => 'root_cause', 'code' => 'system', 'label' => 'System / tooling', 'sort_order' => 6],
                ['category' => 'root_cause', 'code' => 'oversight', 'label' => 'Oversight / monitoring', 'sort_order' => 7],
            ];
            foreach ($lookups as $row) {
                \Illuminate\Support\Facades\DB::table('audit_lookups')->updateOrInsert(
                    ['tenant_id' => null, 'category' => $row['category'], 'code' => $row['code']],
                    array_merge($row, [
                        'tenant_id' => null,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ])
                );
            }
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        $managed = array_filter($this->permissions, fn ($p) => ! in_array($p, ['audit.view', 'audit.export'], true));
        Permission::whereIn('name', $managed)->delete();
    }
};
