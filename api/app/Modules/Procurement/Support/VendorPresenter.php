<?php

namespace App\Modules\Procurement\Support;

use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierCompletenessService;
use App\Modules\Procurement\Services\SupplierEligibilityService;

final class VendorPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function forStaff(Vendor $vendor, User $viewer): array
    {
        $vendor->loadMissing(['categories', 'owners', 'currentDocuments.verifiedBy:id,name', 'portalUsers:id,vendor_id,name,email,is_active,email_verified_at']);
        $payload = $vendor->toArray();
        $payload['status'] = $vendor->normalizedStatus();
        $payload['email'] = $vendor->contact_email;
        $payload['eligibility'] = app(SupplierEligibilityService::class)->evaluate($vendor);
        $payload['completeness'] = app(SupplierCompletenessService::class)->summarize($vendor, $vendor->portalUsers->first());

        if (! BankAccountMasker::canViewFull($viewer)) {
            $payload['bank_account'] = BankAccountMasker::mask($vendor->bank_account);
            $payload['bank_account_masked'] = true;
        } else {
            $payload['bank_account_masked'] = false;
        }

        unset($payload['evaluations']);

        return $payload;
    }

    /**
     * Supplier-facing vendor payload: never leak scores, budgets, or internal notes.
     *
     * @return array<string, mixed>
     */
    public static function forSupplier(Vendor $vendor, User $actor): array
    {
        $vendor->loadMissing(['categories:id,name,code,parent_id', 'owners', 'currentDocuments']);

        return [
            'id' => $vendor->id,
            'supplier_type' => $vendor->supplier_type,
            'name' => $vendor->name,
            'trading_name' => $vendor->trading_name,
            'incorporation_date' => optional($vendor->incorporation_date)->toDateString(),
            'business_type' => $vendor->business_type,
            'registration_number' => $vendor->registration_number,
            'tax_number' => $vendor->tax_number,
            'contact_name' => $vendor->contact_name,
            'contact_email' => $vendor->contact_email,
            'contact_phone' => $vendor->contact_phone,
            'contacts' => $vendor->contacts,
            'website' => $vendor->website,
            'address' => $vendor->address,
            'postal_address' => $vendor->postal_address,
            'country' => $vendor->country,
            'geographic_coverage' => $vendor->geographic_coverage,
            'years_experience' => $vendor->years_experience,
            'experience_summary' => $vendor->experience_summary,
            'payment_terms' => $vendor->payment_terms,
            'bank_name' => $vendor->bank_name,
            'bank_account' => $vendor->bank_account,
            'bank_branch' => $vendor->bank_branch,
            'finance_verified_at' => optional($vendor->finance_verified_at)?->toIso8601String(),
            'status' => $vendor->normalizedStatus(),
            'is_approved' => (bool) $vendor->is_approved,
            'is_active' => (bool) $vendor->is_active,
            'is_sme' => (bool) $vendor->is_sme,
            'last_info_request_reason' => $vendor->last_info_request_reason,
            'rejection_reason' => $vendor->rejection_reason,
            'submitted_at' => optional($vendor->submitted_at)?->toIso8601String(),
            'categories' => $vendor->categories,
            'owners' => $vendor->owners,
            'critical_fields_locked' => $vendor->criticalFieldsLocked(),
            'email_verified' => $actor->email_verified_at !== null,
            'eligibility' => app(SupplierEligibilityService::class)->evaluate($vendor),
            'completeness' => app(SupplierCompletenessService::class)->summarize($vendor, $actor),
        ];
    }
}
