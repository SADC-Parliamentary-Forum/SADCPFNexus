<?php

namespace App\Modules\AccessControl\Services;

use App\Models\User;
use App\Modules\AccessControl\Support\AccessDecision;
use Illuminate\Database\Eloquent\Model;

class SegregationOfDutiesService
{
    public function evaluate(User $actor, string $permission, mixed $resource = null, array $context = []): AccessDecision
    {
        if ($this->isApprovalAction($permission) && $this->isSelfOnRecord($actor, $resource, $context)) {
            return AccessDecision::deny('no_self_approve', 'You cannot approve or authorise your own request.');
        }

        if (in_array($permission, ['admin.roles.approve', 'roles.approve'], true)) {
            $targetUserId = (int) ($context['target_user_id'] ?? 0);
            if ($targetUserId > 0 && $targetUserId === (int) $actor->id) {
                return AccessDecision::deny('no_self_role_grant', 'You cannot approve a role assignment benefiting yourself.');
            }
        }

        if (in_array($permission, ['admin.roles.assign', 'roles.assign'], true)) {
            $targetUserId = (int) ($context['target_user_id'] ?? 0);
            $privileged = (bool) ($context['is_privileged'] ?? false);
            if ($privileged && $targetUserId === (int) $actor->id) {
                return AccessDecision::deny(
                    'access_admin_no_self_privileged',
                    'Access administrators cannot assign themselves privileged access.'
                );
            }
        }

        if ($this->isProcurementAwardOrSoleEval($permission) && $this->isSelfOnRecord($actor, $resource, $context)) {
            return AccessDecision::deny(
                'procurement_requester_not_sole_evaluator',
                'A procurement requester cannot be the sole evaluator or award approver.'
            );
        }

        if (
            in_array($permission, [
                'salary_advance.approve.assigned',
                'salary_advance.approve',
                'programme.sg_approval.act.assigned',
                'travel.request.approve.assigned',
            ], true)
            && ! empty($context['also_finance_certifier'])
            && (int) ($context['finance_certifier_id'] ?? 0) === (int) $actor->id
        ) {
            return AccessDecision::deny(
                'finance_certifier_not_auto_final',
                'The finance certifier cannot be the sole final institutional approver.'
            );
        }

        return AccessDecision::allow('sod_clear', 'No segregation conflict.');
    }

    private function isApprovalAction(string $permission): bool
    {
        foreach (['.approve', '.authorise', '.recommend', 'award.approve'] as $needle) {
            if (str_contains($permission, $needle)) {
                return true;
            }
        }

        return in_array($permission, [
            'leave.approve',
            'travel.approve',
            'procurement.approve',
            'salary_advance.approve',
            'pif.approve',
            'finance.approve',
        ], true);
    }

    private function isProcurementAwardOrSoleEval(string $permission): bool
    {
        return str_contains($permission, 'procurement.award')
            || str_contains($permission, 'procurement.evaluation');
    }

    private function isSelfOnRecord(User $actor, mixed $resource, array $context): bool
    {
        if (! empty($context['force_self'])) {
            return true;
        }

        $ownerKeys = ['requester_id', 'created_by', 'user_id', 'applicant_id', 'owner_id'];
        if (is_array($resource)) {
            foreach ($ownerKeys as $key) {
                if (isset($resource[$key]) && (int) $resource[$key] === (int) $actor->id) {
                    return true;
                }
            }
        }

        if ($resource instanceof Model) {
            foreach ($ownerKeys as $key) {
                if ($resource->getAttribute($key) !== null && (int) $resource->getAttribute($key) === (int) $actor->id) {
                    return true;
                }
            }
        }

        if (isset($context['owner_id']) && (int) $context['owner_id'] === (int) $actor->id) {
            return true;
        }

        return false;
    }
}
