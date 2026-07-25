<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorize access to workflow request records (travel, leave, imprest, procurement).
 */
trait AuthorizesRequestRecords
{
    /**
     * @param  list<string>  $privilegedRoles
     */
    protected function authorizeRequestView(User $actor, Model $record, array $privilegedRoles = []): void
    {
        if ($this->canAccessRequest($actor, $record, $privilegedRoles, allowHistory: true)) {
            return;
        }

        abort(403, 'You are not authorised to view this request.');
    }

    /**
     * Mutate (update/delete) — owner or System Admin only by default.
     *
     * @param  list<string>  $privilegedRoles
     */
    protected function authorizeRequestMutate(User $actor, Model $record, array $privilegedRoles = []): void
    {
        if ($this->canAccessRequest($actor, $record, $privilegedRoles, allowHistory: false)) {
            return;
        }

        abort(403, 'You are not authorised to modify this request.');
    }

    /**
     * @param  list<string>  $privilegedRoles
     */
    protected function canAccessRequest(
        User $actor,
        Model $record,
        array $privilegedRoles = [],
        bool $allowHistory = true,
    ): bool {
        $requesterId = (int) ($record->getAttribute('requester_id') ?? 0);
        if ($requesterId > 0 && $requesterId === (int) $actor->id) {
            return true;
        }

        if ($actor->isSystemAdmin()) {
            return true;
        }

        if ($privilegedRoles !== [] && $actor->hasAnyRole($privilegedRoles)) {
            return true;
        }

        if ($allowHistory) {
            $approval = $record->relationLoaded('approvalRequest')
                ? $record->approvalRequest
                : $record->approvalRequest()->first();
            if ($approval && $approval->history()->where('user_id', $actor->id)->exists()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Legacy (no-workflow) approve/reject — permission or privileged roles only, never self.
     *
     * @param  list<string>  $privilegedRoles
     */
    protected function authorizeLegacyApproval(
        User $actor,
        Model $record,
        array $privilegedRoles = [],
        ?string $permission = null,
    ): void {
        if ((int) ($record->getAttribute('requester_id') ?? 0) === (int) $actor->id) {
            abort(403, 'You cannot approve or reject your own request.');
        }

        $allowed = $actor->isSystemAdmin()
            || ($permission && $actor->can($permission))
            || ($privilegedRoles !== [] && $actor->hasAnyRole($privilegedRoles));

        abort_unless($allowed, 403, 'You are not authorised to approve this request.');
    }
}
