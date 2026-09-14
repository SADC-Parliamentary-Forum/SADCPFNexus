<?php

namespace App\Modules\Procurement\Services;

use App\Models\ProcurementRequest;
use App\Models\RfqInvitation;
use App\Models\SupplierCategory;
use App\Models\SupplierDocument;
use App\Models\SupplierDocumentRequirementType;
use App\Models\Vendor;

class SupplierEligibilityService
{
    /**
     * @return array{
     *   registration_status: string,
     *   compliance_status: string,
     *   document_validity: array<int, array<string, mixed>>,
     *   category_match: bool|null,
     *   funding_source_extras: array<int, array<string, mixed>>,
     *   can_submit_quotes: bool,
     *   can_receive_pos: bool,
     *   reasons: list<string>,
     *   override_applied: bool
     * }
     */
    public function evaluate(Vendor $vendor, ?ProcurementRequest $rfq = null, ?RfqInvitation $invitation = null): array
    {
        $status = $vendor->normalizedStatus();
        $documents = $this->documentValidity($vendor, $rfq);
        $compliance = $this->complianceStatus($documents['mandatory']);
        $categoryMatch = $rfq ? $this->categoryMatch($vendor, $rfq) : null;
        $fundingExtras = $rfq ? $this->fundingSourceExtras($vendor, $rfq) : [];
        $override = (bool) ($invitation?->eligibility_override);

        $reasons = [];
        $statusOk = in_array($status, Vendor::REGISTRATION_ELIGIBLE_STATUSES, true);
        if (! $statusOk) {
            $reasons[] = 'registration_status';
        }

        $docsOk = $documents['mandatory_valid'];
        if ($status === Vendor::STATUS_COMPLIANCE_WARNING) {
            $docsOk = false;
            $reasons[] = 'compliance_warning';
        } elseif (! $docsOk) {
            $reasons[] = 'mandatory_documents';
        }

        if ($rfq && $categoryMatch === false) {
            $reasons[] = 'category_mismatch';
        }

        $fundingOk = collect($fundingExtras)->every(fn (array $row) => $row['satisfied']);
        if ($rfq && ! $fundingOk) {
            $reasons[] = 'funding_source_documents';
        }

        $eligible = $statusOk
            && ($docsOk || $override)
            && ($categoryMatch !== false)
            && ($fundingOk || $override);

        if ($override && ! $eligible && $statusOk && $categoryMatch !== false) {
            $eligible = true;
        }

        return [
            'registration_status' => $status,
            'compliance_status' => $compliance,
            'document_validity' => $documents['items'],
            'category_match' => $categoryMatch,
            'funding_source_extras' => $fundingExtras,
            'can_submit_quotes' => $eligible,
            'can_receive_pos' => $eligible,
            'reasons' => array_values(array_unique($reasons)),
            'override_applied' => $override,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $mandatory
     */
    public function complianceStatus(array $mandatory): string
    {
        $hasExpiredOrMissing = false;
        $hasExpiring = false;

        foreach ($mandatory as $row) {
            if (! ($row['present'] ?? false) || ($row['expired'] ?? false) || ($row['status'] ?? null) === SupplierDocument::STATUS_REJECTED) {
                $hasExpiredOrMissing = true;
                continue;
            }
            if ($row['expiring'] ?? false) {
                $hasExpiring = true;
            }
        }

        if ($hasExpiredOrMissing) {
            return 'non_compliant';
        }
        if ($hasExpiring) {
            return 'expiring';
        }

        return 'valid';
    }

    /**
     * @return array{items: list<array<string, mixed>>, mandatory: list<array<string, mixed>>, mandatory_valid: bool}
     */
    public function documentValidity(Vendor $vendor, ?ProcurementRequest $rfq = null): array
    {
        $types = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (SupplierDocumentRequirementType $type) => $type->appliesToVendor($vendor))
            ->values();

        $currentDocs = $vendor->relationLoaded('currentDocuments')
            ? $vendor->currentDocuments
            : $vendor->currentDocuments()->get();
        $docsByType = $currentDocs->groupBy('type_code');

        $items = [];
        foreach ($types as $type) {
            $doc = $docsByType->get($type->code)?->first();
            $days = $doc?->daysUntilExpiry();
            $expired = $doc?->isExpired() ?? false;
            if ($expired && $doc && $doc->status !== SupplierDocument::STATUS_EXPIRED) {
                $doc->status = SupplierDocument::STATUS_EXPIRED;
                $doc->save();
            }
            $warningDays = (int) ($type->warning_days ?: 90);
            $expiring = $doc && $days !== null && ! $expired && $days <= $warningDays;
            $requiredForRfq = $rfq && $type->required_for_rfq;
            $mandatory = $type->mandatory || $requiredForRfq;
            $present = $doc !== null && $doc->status !== SupplierDocument::STATUS_REJECTED;
            $verifiedOk = ! $type->requires_verification
                || ($doc && $doc->status === SupplierDocument::STATUS_VERIFIED);
            $valid = $present && ! $expired && $verifiedOk;

            $items[] = [
                'code' => $type->code,
                'label' => $type->label,
                'mandatory' => $mandatory,
                'required_at_registration' => (bool) $type->required_at_registration,
                'required_for_rfq' => (bool) $type->required_for_rfq,
                'has_expiry' => (bool) $type->has_expiry,
                'present' => $present,
                'status' => $doc?->status,
                'expired' => $expired,
                'expiring' => $expiring,
                'days_until_expiry' => $days,
                'valid' => $valid,
                'document_id' => $doc?->id,
            ];
        }

        $mandatory = array_values(array_filter($items, fn (array $row) => $row['mandatory']));
        $mandatoryValid = collect($mandatory)->every(fn (array $row) => $row['valid']);

        return [
            'items' => $items,
            'mandatory' => $mandatory,
            'mandatory_valid' => $mandatoryValid,
        ];
    }

    public function categoryMatch(Vendor $vendor, ProcurementRequest $rfq): bool
    {
        $rfqIds = $rfq->supplierCategories()->pluck('supplier_categories.id')->all();
        if ($rfqIds === []) {
            return true;
        }

        $vendorIds = $vendor->categories()->pluck('supplier_categories.id')->all();
        $rfqExpanded = SupplierCategory::expandWithDescendants((int) $rfq->tenant_id, $rfqIds);
        $vendorExpanded = SupplierCategory::expandWithAncestors((int) $vendor->tenant_id, $vendorIds);

        return count(array_intersect($rfqExpanded, $vendorExpanded)) > 0;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function fundingSourceExtras(Vendor $vendor, ProcurementRequest $rfq): array
    {
        $funding = $rfq->funding_source ?? $rfq->donor_code ?? null;
        if (! $funding) {
            return [];
        }

        $types = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->where('funding_source', $funding)
            ->orderBy('sort_order')
            ->get();

        $currentDocs = $vendor->currentDocuments()->get()->keyBy('type_code');
        $rows = [];
        foreach ($types as $type) {
            $doc = $currentDocs->get($type->code);
            $rows[] = [
                'code' => $type->code,
                'label' => $type->label,
                'funding_source' => $funding,
                'satisfied' => $doc !== null && ! $doc->isExpired() && $doc->status !== SupplierDocument::STATUS_REJECTED,
                'document_id' => $doc?->id,
            ];
        }

        return $rows;
    }
}
