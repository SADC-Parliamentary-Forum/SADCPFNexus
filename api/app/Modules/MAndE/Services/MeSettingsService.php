<?php

namespace App\Modules\MAndE\Services;

use App\Models\MeSetting;

class MeSettingsService
{
    public function forTenant(int $tenantId): MeSetting
    {
        return MeSetting::firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'auto_intake'             => true,
                'report_due_days'          => 14,
                'programme_manager_review' => false,
            ]
        );
    }

    public function update(int $tenantId, array $data): MeSetting
    {
        $settings = $this->forTenant($tenantId);
        $settings->fill(array_intersect_key($data, array_flip([
            'auto_intake',
            'report_due_days',
            'programme_manager_review',
        ])));
        $settings->save();

        return $settings->fresh();
    }
}
