<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DelegatedAuthority;
use App\Models\User;
use App\Modules\PeopleAuthority\Services\DelegationCollapseService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * WS1 — centralises "prepared on behalf of" stamping and delegation
 * authorisation so every create/submit/upload path behaves consistently and
 * always writes a "delegation used" audit entry.
 *
 * Effective path: People & Authority IdentityDelegation (canonical).
 * Legacy SAAM DelegatedAuthority rows are mirrored on demand and remain
 * readable for historical stamped `delegated_authority_id` FKs.
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
        if (! $onBehalfOfId || (int) $onBehalfOfId === (int) $actor->id) {
            return null;
        }

        $principal = User::where('tenant_id', $actor->tenant_id)->find($onBehalfOfId);
        if (! $principal) {
            throw ValidationException::withMessages([
                'prepared_on_behalf_of' => ['The selected principal is invalid.'],
            ]);
        }

        $collapse = app(DelegationCollapseService::class);
        $pa = $collapse->resolveEffective(
            (int) $actor->tenant_id,
            (int) $actor->id,
            (int) $onBehalfOfId,
            $module,
            $action
        );

        if ($pa) {
            // Prefer linked legacy SAAM row for FK compatibility on stamped entities.
            if ($pa->legacy_delegated_authority_id) {
                $linked = DelegatedAuthority::query()->find($pa->legacy_delegated_authority_id);
                if ($linked) {
                    return $linked;
                }
            }

            $saam = DelegatedAuthority::resolve($actor->id, $onBehalfOfId, $action, $module);
            if ($saam) {
                return $saam;
            }

            // Synthetic: PA authorised but no SAAM row — create a thin mirror stamp source.
            return DelegatedAuthority::query()->create([
                'tenant_id' => $actor->tenant_id,
                'principal_user_id' => $onBehalfOfId,
                'delegate_user_id' => $actor->id,
                'start_date' => $pa->start_at?->toDateString() ?? now()->toDateString(),
                'end_date' => $pa->end_at?->toDateString() ?? now()->addYear()->toDateString(),
                'module' => $module === '*' ? null : $module,
                'can_draft' => true,
                'can_submit' => true,
                'can_upload' => true,
                'can_act_on_behalf' => true,
                'reason' => 'Backfilled from PA IdentityDelegation #'.$pa->id,
                'created_by' => $pa->created_by ?? $actor->id,
            ]);
        }

        throw ValidationException::withMessages([
            'prepared_on_behalf_of' => [
                "You do not hold an active delegated authority to {$action} {$module} requests on behalf of {$principal->name}.",
            ],
        ]);
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
                'auditable_id' => $entity->id,
                'new_values' => [
                    'module' => $module,
                    'action' => $action,
                    'prepared_by' => $actor->id,
                    'prepared_on_behalf_of' => $onBehalfOfId,
                    'delegated_authority_id' => $delegation?->id,
                    'effective_path' => 'people_authority',
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
