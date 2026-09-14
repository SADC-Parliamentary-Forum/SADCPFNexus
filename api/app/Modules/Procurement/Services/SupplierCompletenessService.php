<?php

namespace App\Modules\Procurement\Services;

use App\Models\SupplierDeclarationAcceptance;
use App\Models\SupplierDeclarationTemplate;
use App\Models\SupplierDocumentRequirementType;
use App\Models\User;
use App\Models\Vendor;

class SupplierCompletenessService
{
    /**
     * @return array{
     *   percent: int,
     *   sections: array<string, array{complete: bool, missing: list<string>}>,
     *   can_submit: bool,
     *   blockers: list<string>,
     *   email_verified: bool
     * }
     */
    public function summarize(Vendor $vendor, ?User $actor = null): array
    {
        $vendor->loadMissing(['owners', 'currentDocuments', 'categories', 'declarationAcceptances', 'portalUsers']);
        $actor ??= $vendor->portalUsers->first();

        $sections = [
            'company' => $this->companySection($vendor),
            'contacts' => $this->contactsSection($vendor),
            'categories' => $this->categoriesSection($vendor),
            'ownership' => $this->ownershipSection($vendor),
            'banking' => $this->bankingSection($vendor),
            'documents' => $this->documentsSection($vendor),
            'declarations' => $this->declarationsSection($vendor),
        ];

        $completeCount = collect($sections)->filter(fn (array $row) => $row['complete'])->count();
        $percent = (int) round(($completeCount / max(count($sections), 1)) * 100);

        $emailVerified = $actor?->email_verified_at !== null;
        $blockers = [];
        if (! $emailVerified) {
            $blockers[] = 'email_unverified';
        }
        if (! $sections['documents']['complete']) {
            $blockers[] = 'mandatory_documents';
        }
        if (! $sections['declarations']['complete']) {
            $blockers[] = 'declarations';
        }
        if (! $sections['company']['complete']) {
            $blockers[] = 'company_profile';
        }
        if (! $sections['categories']['complete']) {
            $blockers[] = 'categories';
        }

        $canSubmit = in_array($vendor->normalizedStatus(), [Vendor::STATUS_DRAFT, Vendor::STATUS_CORRECTION_REQUIRED], true)
            && $blockers === [];

        return [
            'percent' => $percent,
            'sections' => $sections,
            'can_submit' => $canSubmit,
            'blockers' => $blockers,
            'email_verified' => $emailVerified,
        ];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function companySection(Vendor $vendor): array
    {
        $missing = [];
        if (! $vendor->name) {
            $missing[] = 'name';
        }
        if (! $vendor->registration_number && $vendor->supplier_type !== 'individual') {
            $missing[] = 'registration_number';
        }
        if (! $vendor->tax_number && $vendor->supplier_type !== 'individual') {
            $missing[] = 'tax_number';
        }
        if (! $vendor->address) {
            $missing[] = 'address';
        }
        if (! $vendor->country) {
            $missing[] = 'country';
        }

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function contactsSection(Vendor $vendor): array
    {
        $missing = [];
        if (! $vendor->contact_name) {
            $missing[] = 'contact_name';
        }
        if (! $vendor->contact_email) {
            $missing[] = 'contact_email';
        }
        if (! $vendor->contact_phone) {
            $missing[] = 'contact_phone';
        }

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function categoriesSection(Vendor $vendor): array
    {
        $missing = $vendor->categories->isEmpty() ? ['category_ids'] : [];

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function ownershipSection(Vendor $vendor): array
    {
        if ($vendor->supplier_type === 'individual') {
            return ['complete' => true, 'missing' => []];
        }
        $missing = $vendor->owners->isEmpty() ? ['owners'] : [];

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function bankingSection(Vendor $vendor): array
    {
        $missing = [];
        if (! $vendor->bank_name) {
            $missing[] = 'bank_name';
        }
        if (! $vendor->bank_account) {
            $missing[] = 'bank_account';
        }
        if (! $vendor->bank_branch) {
            $missing[] = 'bank_branch';
        }

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function documentsSection(Vendor $vendor): array
    {
        $required = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->where('required_at_registration', true)
            ->get()
            ->filter(fn (SupplierDocumentRequirementType $type) => $type->appliesToVendor($vendor) && $type->mandatory);

        $present = $vendor->currentDocuments->keyBy('type_code');
        $missing = [];
        foreach ($required as $type) {
            $doc = $present->get($type->code);
            if (! $doc || $doc->status === 'rejected' || $doc->isExpired()) {
                $missing[] = $type->code;
            }
        }

        return ['complete' => $missing === [], 'missing' => $missing];
    }

    /**
     * @return array{complete: bool, missing: list<string>}
     */
    private function declarationsSection(Vendor $vendor): array
    {
        $templates = SupplierDeclarationTemplate::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->where('required_at_registration', true)
            ->get();

        $accepted = SupplierDeclarationAcceptance::query()
            ->where('vendor_id', $vendor->id)
            ->pluck('template_id')
            ->all();

        $missing = [];
        foreach ($templates as $template) {
            if (! in_array($template->id, $accepted, true)) {
                $missing[] = $template->code;
            }
        }

        return ['complete' => $missing === [], 'missing' => $missing];
    }
}
