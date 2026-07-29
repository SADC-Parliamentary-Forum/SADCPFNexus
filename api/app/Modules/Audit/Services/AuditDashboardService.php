<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditCorrectiveAction;
use App\Models\AuditEngagement;
use App\Models\AuditExternalEngagement;
use App\Models\AuditFinding;
use App\Models\AuditIndependenceDeclaration;
use App\Models\AuditPlan;
use App\Models\User;

class AuditDashboardService
{
    public function auditor(User $user): array
    {
        return [
            'role' => 'auditor',
            'open_engagements' => AuditEngagement::where('tenant_id', $user->tenant_id)->whereIn('status', ['planned', 'notified', 'independence_pending', 'fieldwork', 'reporting'])->count(),
            'open_findings' => AuditFinding::where('tenant_id', $user->tenant_id)->whereNotIn('status', ['closed', 'draft'])->count(),
            'due_for_verification' => AuditCorrectiveAction::where('tenant_id', $user->tenant_id)->where('status', 'due_for_verification')->count(),
            'pending_independence' => AuditIndependenceDeclaration::where('tenant_id', $user->tenant_id)->where('status', 'pending')->count(),
        ];
    }

    public function management(User $user): array
    {
        return [
            'role' => 'management',
            'findings_awaiting_response' => AuditFinding::where('tenant_id', $user->tenant_id)->where('status', 'issued')->count(),
            'open_corrective_actions' => AuditCorrectiveAction::where('tenant_id', $user->tenant_id)->whereNotIn('status', ['verified_closed', 'cancelled'])->count(),
            'overdue_corrective' => AuditCorrectiveAction::where('tenant_id', $user->tenant_id)
                ->whereNotIn('status', ['verified_closed', 'cancelled'])
                ->whereDate('due_date', '<', now())
                ->count(),
        ];
    }

    public function sg(User $user): array
    {
        return [
            'role' => 'sg',
            'plans_pending_approval' => AuditPlan::where('tenant_id', $user->tenant_id)->where('status', 'pending_approval')->count(),
            'open_findings' => AuditFinding::where('tenant_id', $user->tenant_id)->whereNotIn('status', ['closed', 'draft'])->count(),
            'external_active' => AuditExternalEngagement::where('tenant_id', $user->tenant_id)->where('access_active', true)->count(),
        ];
    }
}
