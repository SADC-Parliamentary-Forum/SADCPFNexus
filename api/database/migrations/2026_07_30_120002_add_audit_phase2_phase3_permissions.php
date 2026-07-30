<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'audit.analytics.view',
        'audit.samples.extract',
        'audit.campaigns.manage',
        'audit.effort.manage',
        'audit.qa.manage',
        'audit.templates.manage',
        'audit.governance.pack',
        'audit.appointments.manage',
        'audit.ai.suggest',
        'audit.ai.apply',
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

            $ia = Role::where('name', 'Internal Auditor')->where('guard_name', $guard)->first();
            if ($ia) {
                $ia->givePermissionTo($all);
            }

            $sg = Role::where('name', 'Secretary General')->where('guard_name', $guard)->first();
            if ($sg) {
                $sg->givePermissionTo(Permission::whereIn('name', [
                    'audit.analytics.view', 'audit.governance.pack', 'audit.appointments.manage',
                ])->where('guard_name', $guard)->get());
            }
        }

        if (\Illuminate\Support\Facades\Schema::hasTable('audit_donor_templates')) {
            $defaults = [
                [
                    'code' => 'generic_assurance',
                    'name' => 'Generic assurance engagement',
                    'donor_name' => null,
                    'applies_to' => 'both',
                    'sections' => json_encode(['objectives', 'scope', 'findings', 'recommendations', 'management_response']),
                    'guidance' => 'Baseline internal audit engagement/report structure.',
                ],
                [
                    'code' => 'donor_grant_compliance',
                    'name' => 'Donor grant compliance',
                    'donor_name' => 'Multi-donor',
                    'applies_to' => 'both',
                    'sections' => json_encode(['eligibility', 'procurement', 'financial_reporting', 'safeguards', 'findings']),
                    'guidance' => 'Donor-facing compliance template; apply only with auditor confirmation.',
                ],
            ];
            foreach ($defaults as $row) {
                \Illuminate\Support\Facades\DB::table('audit_donor_templates')->updateOrInsert(
                    ['tenant_id' => null, 'code' => $row['code']],
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
        Permission::whereIn('name', $this->permissions)->delete();
    }
};
