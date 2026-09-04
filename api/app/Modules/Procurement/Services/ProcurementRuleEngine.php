<?php

namespace App\Modules\Procurement\Services;

use App\Models\ProcurementPolicyProfile;
use App\Models\ProcurementProject;
use App\Models\Tenant;

/**
 * Configurable route engine. Thresholds come from policy profiles, never hard-coded callers.
 */
final class ProcurementRuleEngine
{
    public function __construct(private readonly ProcurementPolicyProfileService $profiles) {}

    /**
     * @return array<string, mixed>
     */
    public function evaluate(Tenant $tenant, float $amount, string $category = 'services', ?ProcurementProject $project = null, bool $soleSource = false, bool $emergency = false, bool $framework = false): array
    {
        $profile = $project?->policyProfile ?: $this->profiles->resolveActive($tenant);
        $bands = $profile->toThresholdArray();
        $direct = (float) $bands['direct_purchase_limit'];
        $quotation = (float) $bands['quotation_limit'];
        $minQuotes = (int) $bands['minimum_quotes_required'];

        $method = 'tender';
        $quotes = $minQuotes;
        $tender = true;
        if ($amount <= $direct) {
            $method = 'direct';
            $quotes = 1;
            $tender = false;
        } elseif ($amount <= $quotation) {
            $method = 'quotation';
            $quotes = $minQuotes;
            $tender = false;
        }

        $exceptionRequired = $soleSource || $emergency || ($method !== 'direct' && $framework === false && $quotes > 1);
        if ($method === 'direct') {
            $exceptionRequired = $soleSource || $emergency;
        }

        return [
            'policy_profile_key' => $profile->key,
            'project_code' => $project?->code,
            'funding_source' => $project?->funding_source,
            'amount' => $amount,
            'category' => $category,
            'procurement_method' => $method,
            'minimum_quotations' => $quotes,
            'tender_required' => $tender,
            'finance_review_required' => $amount >= $direct,
            'committee_required' => $tender,
            'exception_required' => $exceptionRequired && $method !== 'direct',
            'supporting_documents_required' => $method === 'direct'
                ? ['procurement_request', 'supplier', 'budget_confirmation', 'lpo_approval']
                : ['procurement_request', 'quotations', 'budget_confirmation', 'lpo_approval'],
            'thresholds' => $bands,
        ];
    }
}
