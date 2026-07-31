<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\AuditLog;
use App\Models\DelegatedAuthority;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\IdentityDelegationScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Collapse SAAM DelegatedAuthority into People & Authority IdentityDelegation.
 * One effective path: PA is canonical; SAAM rows are mirrored and resolved via PA.
 */
class DelegationCollapseService
{
    /**
     * Ensure a SAAM DelegatedAuthority has a mirrored IdentityDelegation (+ scopes).
     */
    public function mirror(DelegatedAuthority $saam): IdentityDelegation
    {
        $existing = IdentityDelegation::query()
            ->where('legacy_delegated_authority_id', $saam->id)
            ->first();

        if ($existing) {
            return $this->syncFromSaam($existing, $saam);
        }

        return DB::transaction(function () use ($saam) {
            $active = $saam->isActive();
            $del = IdentityDelegation::create([
                'tenant_id' => $saam->tenant_id,
                'reference' => 'SAAM-'.$saam->id.'-'.Str::upper(Str::random(4)),
                'principal_person_id' => $saam->principal_user_id, // bridge: user id as person surrogate when PA person absent
                'delegate_person_id' => $saam->delegate_user_id,
                'principal_user_id' => $saam->principal_user_id,
                'delegate_user_id' => $saam->delegate_user_id,
                'delegation_type' => 'general',
                'start_at' => $saam->start_date?->copy()->startOfDay() ?? now(),
                'end_at' => $saam->end_date?->copy()->endOfDay() ?? now()->addYear(),
                'reason' => $saam->reason ?? 'Mirrored from SAAM DelegatedAuthority',
                'authority_source' => 'saam_legacy',
                'allows_transitive' => false,
                'allows_contract_signing' => false,
                'creates_acting_allowance' => false,
                'status' => $active ? 'active' : 'revoked',
                'approved_by' => $saam->created_by ?? $saam->principal_user_id,
                'approved_at' => now(),
                'activated_at' => $active ? ($saam->start_date ?? now()) : null,
                'created_by' => $saam->created_by ?? $saam->principal_user_id,
                'legacy_delegated_authority_id' => $saam->id,
            ]);

            $module = $saam->module ?: '*';
            foreach ($this->actionsFromSaam($saam) as $action) {
                IdentityDelegationScope::create([
                    'tenant_id' => $saam->tenant_id,
                    'identity_delegation_id' => $del->id,
                    'module' => $module,
                    'action' => $action,
                ]);
            }

            AuditLog::record('people.delegation.mirrored_from_saam', [
                'auditable_type' => IdentityDelegation::class,
                'auditable_id' => $del->id,
                'new_values' => [
                    'legacy_delegated_authority_id' => $saam->id,
                    'principal_user_id' => $del->principal_user_id,
                    'delegate_user_id' => $del->delegate_user_id,
                ],
                'tags' => 'people-authority,delegation,saam-collapse',
            ]);

            return $del;
        });
    }

    public function syncFromSaam(IdentityDelegation $del, DelegatedAuthority $saam): IdentityDelegation
    {
        $active = $saam->isActive();
        $del->update([
            'start_at' => $saam->start_date?->copy()->startOfDay() ?? $del->start_at,
            'end_at' => $saam->end_date?->copy()->endOfDay() ?? $del->end_at,
            'status' => $active ? 'active' : 'revoked',
            'reason' => $saam->reason ?? $del->reason,
        ]);

        return $del->fresh();
    }

    /**
     * Resolve effective PA delegation — prefers native PA, mirrors SAAM on miss.
     */
    public function resolveEffective(
        int $tenantId,
        int $delegateUserId,
        int $principalUserId,
        string $module,
        string $action
    ): ?IdentityDelegation {
        $asOf = now();

        $pa = IdentityDelegation::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['approved', 'active'])
            ->where('delegate_user_id', $delegateUserId)
            ->where('principal_user_id', $principalUserId)
            ->where('start_at', '<=', $asOf)
            ->where('end_at', '>=', $asOf)
            ->get();

        foreach ($pa as $d) {
            if ($this->scopeAllows($d, $module, $action)) {
                return $d;
            }
        }

        $saam = DelegatedAuthority::resolve($delegateUserId, $principalUserId, $action, $module);
        if (! $saam) {
            return null;
        }

        return $this->mirror($saam);
    }

    /**
     * Bulk-migrate active SAAM delegations for a tenant.
     *
     * @return array{scanned: int, mirrored: int}
     */
    public function migrateTenant(int $tenantId): array
    {
        $rows = DelegatedAuthority::query()
            ->where('tenant_id', $tenantId)
            ->active()
            ->get();

        $mirrored = 0;
        foreach ($rows as $row) {
            $this->mirror($row);
            $mirrored++;
        }

        return ['scanned' => $rows->count(), 'mirrored' => $mirrored];
    }

    private function scopeAllows(IdentityDelegation $d, string $module, string $action): bool
    {
        $scopes = IdentityDelegationScope::query()
            ->where('identity_delegation_id', $d->id)
            ->get();

        if ($scopes->isEmpty()) {
            return in_array($d->delegation_type, ['preparation', 'workflow', 'general'], true)
                && ! in_array($action, ['approve', 'sign'], true);
        }

        foreach ($scopes as $s) {
            $modOk = in_array($s->module, [null, '', '*', $module], true);
            $actOk = in_array($s->action, ['*', $action], true);
            if ($modOk && $actOk) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function actionsFromSaam(DelegatedAuthority $saam): array
    {
        $actions = [];
        if ($saam->can_draft) {
            $actions[] = 'draft';
            $actions[] = 'prepare';
        }
        if ($saam->can_submit) {
            $actions[] = 'submit';
        }
        if ($saam->can_upload) {
            $actions[] = 'upload';
        }
        if ($saam->can_act_on_behalf) {
            $actions[] = 'act_on_behalf';
            $actions[] = '*';
        }

        return $actions !== [] ? array_values(array_unique($actions)) : ['draft', 'prepare', 'submit'];
    }
}
