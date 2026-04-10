<?php

namespace App\Modules\WeeklySummary\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class WeeklySummaryScopeService
{
    private const INSTITUTION_ROLES = [
        'System Admin', 'system_admin',
        'HR Manager', 'hr_manager',
        'HR Administrator', 'hr_administrator',
        'Finance Controller', 'finance_controller',
        'Secretary General', 'secretary_general',
    ];

    private const DEPARTMENT_ROLES = [
        'Director', 'director',
        'Manager', 'manager',
        'Governance Officer', 'governance_officer',
    ];

    /**
     * Resolve the effective reporting scope for a user.
     *
     * Returns:
     *   type         => 'institution' | 'department' | 'personal'
     *   label        => human-readable scope label
     *   tenant_id    => int
     *   user_ids     => int[]|null  (null = no filter = whole institution)
     *   department_id => int|null
     */
    public function resolve(User $user): array
    {
        $roleNames = $user->getRoleNames()->toArray();

        if (array_intersect($roleNames, self::INSTITUTION_ROLES)) {
            return [
                'type'          => 'institution',
                'label'         => 'Institution-wide',
                'tenant_id'     => $user->tenant_id,
                'user_ids'      => null,
                'department_id' => null,
            ];
        }

        if (array_intersect($roleNames, self::DEPARTMENT_ROLES) && $user->department_id) {
            $deptUserIds = DB::table('users')
                ->where('tenant_id', $user->tenant_id)
                ->where('department_id', $user->department_id)
                ->where('is_active', true)
                ->pluck('id')
                ->toArray();

            $deptName = DB::table('departments')
                ->where('id', $user->department_id)
                ->value('name') ?? 'Department';

            return [
                'type'          => 'department',
                'label'         => $deptName . ' Department',
                'tenant_id'     => $user->tenant_id,
                'user_ids'      => $deptUserIds ?: [$user->id],
                'department_id' => $user->department_id,
            ];
        }

        return [
            'type'          => 'personal',
            'label'         => 'Personal Summary',
            'tenant_id'     => $user->tenant_id,
            'user_ids'      => [$user->id],
            'department_id' => $user->department_id,
        ];
    }
}
