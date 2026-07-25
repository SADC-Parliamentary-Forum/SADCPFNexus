<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\Tenant;
use Illuminate\Validation\ValidationException;

class ProcurementSettingsService
{
    private const KEYS = [
        'direct_purchase_limit',
        'quotation_limit',
        'tender_threshold',
        'minimum_quotes_required',
        'split_lookback_days',
        'split_enforcement',
        'policy_profile_key',
        'ai_comparison_enabled',
    ];

    public function effective(Tenant $tenant): array
    {
        $overrides = $tenant->settings['procurement'] ?? [];
        $profileService = app(ProcurementPolicyProfileService::class);
        $profileService->ensureDefaults($tenant);
        $profile = $profileService->resolveActive($tenant);
        $fromProfile = $profile->toThresholdArray();
        $profileKey = (string) ($overrides['policy_profile_key'] ?? $profile->key ?? 'sadc_pf_core');

        return [
            'direct_purchase_limit'   => (float) ($overrides['direct_purchase_limit'] ?? $fromProfile['direct_purchase_limit']),
            'quotation_limit'         => (float) ($overrides['quotation_limit'] ?? $fromProfile['quotation_limit']),
            'tender_threshold'        => (float) ($overrides['tender_threshold'] ?? $fromProfile['tender_threshold']),
            'minimum_quotes_required' => (int) ($overrides['minimum_quotes_required'] ?? $fromProfile['minimum_quotes_required']),
            'split_lookback_days'     => (int) ($overrides['split_lookback_days'] ?? $fromProfile['split_lookback_days']),
            'split_enforcement'       => (string) ($overrides['split_enforcement'] ?? $fromProfile['split_enforcement']),
            'policy_profile_key'      => $profileKey,
            'donor_codes'             => $fromProfile['donor_codes'] ?? [],
            'multi_donor_policy_ui'   => 'enabled',
            'ai_comparison_enabled'   => (bool) ($overrides['ai_comparison_enabled'] ?? config('procurement.ai_comparison_enabled', false)),
            'ai_comparison_provider'  => (string) config('procurement.ai_comparison_provider', 'stub'),
            'has_tenant_override'     => !empty($overrides),
        ];
    }

    public function update(Tenant $tenant, array $data): array
    {
        $settings = $tenant->settings ?? [];
        $current = $settings['procurement'] ?? [];

        foreach (self::KEYS as $key) {
            if (array_key_exists($key, $data)) {
                $current[$key] = $data[$key];
            }
        }

        $settings['procurement'] = $current;
        $tenant->update(['settings' => $settings]);

        AuditLog::record('procurement.settings_updated', [
            'auditable_type' => Tenant::class,
            'auditable_id'   => $tenant->id,
            'new_values'     => $current,
            'tags'           => 'procurement',
        ]);

        return $this->effective($tenant->fresh());
    }

    public function validatePayload(array $data): array
    {
        $validated = validator($data, [
            'direct_purchase_limit'   => ['sometimes', 'numeric', 'min:0'],
            'quotation_limit'         => ['sometimes', 'numeric', 'min:0'],
            'tender_threshold'        => ['sometimes', 'numeric', 'min:0'],
            'minimum_quotes_required' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'split_lookback_days'     => ['sometimes', 'integer', 'min:1', 'max:365'],
            'split_enforcement'       => ['sometimes', 'string', 'in:soft,hard'],
            'policy_profile_key'      => ['sometimes', 'string', 'max:64'],
            'ai_comparison_enabled'   => ['sometimes', 'boolean'],
        ])->validate();

        if (isset($validated['direct_purchase_limit'], $validated['quotation_limit'])
            && $validated['direct_purchase_limit'] > $validated['quotation_limit']) {
            throw ValidationException::withMessages([
                'direct_purchase_limit' => 'Direct purchase limit cannot exceed the quotation limit.',
            ]);
        }

        return $validated;
    }
}
