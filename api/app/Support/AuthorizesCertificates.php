<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Shared authorization for approval certificates.
 *
 * Certificates expose sensitive request data (leave reasons, amounts, travel
 * details). Access is limited to the requester, System Admins, designated
 * privileged roles for the module, and users who already acted on the
 * approval history for that record.
 */
trait AuthorizesCertificates
{
    /**
     * @param  list<string>  $privilegedRoles
     */
    protected function authorizeCertificateView(
        User $actor,
        Model $record,
        array $privilegedRoles = [],
    ): void {
        abort_unless(
            method_exists($record, 'isApproved') && $record->isApproved(),
            403,
            'Certificate only available for approved requests.'
        );

        $requesterId = (int) ($record->getAttribute('requester_id') ?? 0);
        if ($requesterId > 0 && $requesterId === (int) $actor->id) {
            return;
        }

        if ($actor->isSystemAdmin()) {
            return;
        }

        if ($privilegedRoles !== [] && $actor->hasAnyRole($privilegedRoles)) {
            return;
        }

        $approval = $record->approvalRequest;
        if ($approval && $approval->history()->where('user_id', $actor->id)->exists()) {
            return;
        }

        abort(403, 'You are not authorised to view this certificate.');
    }
}
