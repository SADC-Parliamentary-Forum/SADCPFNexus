<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DelegatedAuthority;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * WS1 — centralises "prepared on behalf of" stamping and delegation
 * authorisation so every create/submit/upload path behaves consistently and
 * always writes a "delegation used" audit entry.
 *
 * IMPORTANT: this never logs anyone in as another user. It records that an
 * actor (the delegate) prepared/submitted a request for a principal, after
 * verifying an admin-configured DelegatedAuthority permits it.
 */
class DelegationService
{
    /**
     * Resolve and validate the delegation that authorises $actor to perform
     * $action for $onBehalfOfId on $module. Returns null when the actor is
     * acting purely for themselves (no on-behalf id, or it equals the actor).
     *
     * @throws ValidationException when on-behalf is requested but not permitted.
     */
    public function authorise(User $actor, ?int $onBehalfOfId, string $module, string $action): ?DelegatedAuthority
    {
        if (!$onBehalfOfId || (int) $onBehalfOfId === (int) $actor->id) {
            return null;
        }

        $principal = User::where('tenant_id', $actor->tenant_id)->find($onBehalfOfId);
        if (!$principal) {
            throw ValidationException::withMessages([
                'prepared_on_behalf_of' => ['The selected principal is invalid.'],
            ]);
        }

        $delegation = DelegatedAuthority::resolve($actor->id, $onBehalfOfId, $action, $module);
        if (!$delegation) {
            throw ValidationException::withMessages([
                'prepared_on_behalf_of' => [
                    "You do not hold an active delegated authority to {$action} {$module} requests on behalf of {$principal->name}.",
                ],
            ]);
        }

        return $delegation;
    }

    /**
     * Stamp preparer / on-behalf-of references on the entity (in-memory; caller
     * persists) and write a "delegation used" audit entry.
     */
    public function stampPreparation(
        Model $entity,
        User $actor,
        ?int $onBehalfOfId,
        string $module,
        string $action,
        ?DelegatedAuthority $delegation = null
    ): void {
        $entity->prepared_by = $actor->id;

        if ($onBehalfOfId && (int) $onBehalfOfId !== (int) $actor->id) {
            $entity->prepared_on_behalf_of = $onBehalfOfId;
            $entity->delegated_authority_id = $delegation?->id;

            AuditLog::record('delegation.used', [
                'auditable_type' => get_class($entity),
                'auditable_id'   => $entity->id,
                'new_values'     => [
                    'module'                 => $module,
                    'action'                 => $action,
                    'prepared_by'            => $actor->id,
                    'prepared_on_behalf_of'  => $onBehalfOfId,
                    'delegated_authority_id' => $delegation?->id,
                ],
                'tags' => ['delegation', $module],
            ]);
        }
    }

    /**
     * Convenience: resolve who the "owner"/requester of a request should be.
     * When prepared on behalf of a principal, the principal is the requester.
     */
    public function ownerId(User $actor, ?int $onBehalfOfId): int
    {
        return ($onBehalfOfId && (int) $onBehalfOfId !== (int) $actor->id)
            ? (int) $onBehalfOfId
            : (int) $actor->id;
    }
}
