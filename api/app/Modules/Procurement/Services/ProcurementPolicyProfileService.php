<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementPolicyProfile;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ProcurementPolicyProfileService
{
    public function ensureDefaults(Tenant $tenant, ?User $actor = null): ProcurementPolicyProfile
    {
        $existing = ProcurementPolicyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->where('key', 'sadc_pf_core')
            ->first();

        if ($existing) {
            return $existing;
        }

        return ProcurementPolicyProfile::create([
            'tenant_id'               => $tenant->id,
            'key'                     => 'sadc_pf_core',
            'name'                    => 'SADC PF Core',
            'description'             => 'Default SADC PF procurement policy bands (Phase 1 locks).',
            'donor_codes'             => ['SADC_PF'],
            'direct_purchase_limit'   => (float) config('procurement.direct_purchase_limit'),
            'quotation_limit'         => (float) config('procurement.quotation_limit'),
            'tender_threshold'        => (float) config('procurement.tender_threshold'),
            'minimum_quotes_required' => (int) config('procurement.minimum_quotes_required'),
            'split_lookback_days'     => (int) config('procurement.split_lookback_days'),
            'split_enforcement'       => (string) config('procurement.split_enforcement', 'hard'),
            'is_active'               => true,
            'is_default'              => true,
            'created_by'              => $actor?->id,
        ]);
    }

    public function listForTenant(Tenant $tenant, ?User $actor = null): Collection
    {
        $this->ensureDefaults($tenant, $actor);

        return ProcurementPolicyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();
    }

    public function create(Tenant $tenant, User $actor, array $data): ProcurementPolicyProfile
    {
        $this->ensureDefaults($tenant, $actor);

        $profile = ProcurementPolicyProfile::create([
            'tenant_id'               => $tenant->id,
            'key'                     => $data['key'],
            'name'                    => $data['name'],
            'description'             => $data['description'] ?? null,
            'donor_codes'             => $data['donor_codes'] ?? [],
            'direct_purchase_limit'   => $data['direct_purchase_limit'],
            'quotation_limit'         => $data['quotation_limit'],
            'tender_threshold'        => $data['tender_threshold'] ?? $data['quotation_limit'],
            'minimum_quotes_required' => $data['minimum_quotes_required'] ?? 3,
            'split_lookback_days'     => $data['split_lookback_days'] ?? 30,
            'split_enforcement'       => $data['split_enforcement'] ?? 'hard',
            'is_active'               => $data['is_active'] ?? true,
            'is_default'              => false,
            'created_by'              => $actor->id,
        ]);

        AuditLog::record('procurement.policy_profile_created', [
            'auditable_type' => ProcurementPolicyProfile::class,
            'auditable_id'   => $profile->id,
            'new_values'     => $profile->toArray(),
            'tags'           => 'procurement',
        ]);

        return $profile;
    }

    public function update(ProcurementPolicyProfile $profile, array $data): ProcurementPolicyProfile
    {
        // Protect Phase 1 core bands on the default profile key
        if ($profile->is_default && $profile->key === 'sadc_pf_core') {
            foreach (['direct_purchase_limit', 'quotation_limit', 'tender_threshold'] as $lock) {
                if (array_key_exists($lock, $data)) {
                    $expected = (float) config('procurement.' . ($lock === 'tender_threshold' ? 'tender_threshold' : $lock));
                    if ((float) $data[$lock] !== $expected) {
                        throw ValidationException::withMessages([
                            $lock => 'The default SADC PF Core profile thresholds are locked to Phase 1 policy bands.',
                        ]);
                    }
                }
            }
        }

        $profile->fill(collect($data)->only([
            'name', 'description', 'donor_codes',
            'direct_purchase_limit', 'quotation_limit', 'tender_threshold',
            'minimum_quotes_required', 'split_lookback_days', 'split_enforcement', 'is_active',
        ])->all());
        $profile->save();

        AuditLog::record('procurement.policy_profile_updated', [
            'auditable_type' => ProcurementPolicyProfile::class,
            'auditable_id'   => $profile->id,
            'new_values'     => $profile->fresh()->toArray(),
            'tags'           => 'procurement',
        ]);

        return $profile->fresh();
    }

    public function delete(ProcurementPolicyProfile $profile): void
    {
        if ($profile->is_default || $profile->key === 'sadc_pf_core') {
            throw ValidationException::withMessages([
                'profile' => 'The default SADC PF Core policy profile cannot be deleted.',
            ]);
        }

        $tenant = Tenant::findOrFail($profile->tenant_id);
        $activeKey = $tenant->settings['procurement']['policy_profile_key'] ?? 'sadc_pf_core';
        if ($activeKey === $profile->key) {
            throw ValidationException::withMessages([
                'profile' => 'Cannot delete the active policy profile. Activate another profile first.',
            ]);
        }

        $profile->delete();
    }

    public function activate(Tenant $tenant, ProcurementPolicyProfile $profile): array
    {
        if ((int) $profile->tenant_id !== (int) $tenant->id) {
            abort(404);
        }
        if (!$profile->is_active) {
            throw ValidationException::withMessages([
                'profile' => 'Cannot activate an inactive policy profile.',
            ]);
        }

        $settings = $tenant->settings ?? [];
        $procurement = $settings['procurement'] ?? [];
        $procurement['policy_profile_key'] = $profile->key;
        // Align tenant threshold overrides with the activated profile
        foreach ($profile->toThresholdArray() as $k => $v) {
            if (in_array($k, ['donor_codes', 'policy_profile_key'], true)) {
                continue;
            }
            $procurement[$k] = $v;
        }
        $settings['procurement'] = $procurement;
        $tenant->update(['settings' => $settings]);

        AuditLog::record('procurement.policy_profile_activated', [
            'auditable_type' => Tenant::class,
            'auditable_id'   => $tenant->id,
            'new_values'     => ['policy_profile_key' => $profile->key],
            'tags'           => 'procurement',
        ]);

        return app(ProcurementSettingsService::class)->effective($tenant->fresh());
    }

    public function resolveActive(Tenant $tenant): ProcurementPolicyProfile
    {
        $this->ensureDefaults($tenant);
        $key = $tenant->settings['procurement']['policy_profile_key'] ?? 'sadc_pf_core';

        return ProcurementPolicyProfile::query()
            ->where('tenant_id', $tenant->id)
            ->where('key', $key)
            ->first()
            ?? $this->ensureDefaults($tenant);
    }
}
