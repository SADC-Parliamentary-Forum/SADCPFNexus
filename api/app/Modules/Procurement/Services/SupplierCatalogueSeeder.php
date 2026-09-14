<?php

namespace App\Modules\Procurement\Services;

use App\Models\SupplierDeclarationTemplate;
use App\Models\SupplierDocumentRequirementType;
use App\Models\Tenant;

class SupplierCatalogueSeeder
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function defaultRequirementTypes(): array
    {
        return [
            [
                'code' => 'registration_certificate',
                'label' => 'Company registration certificate',
                'mandatory' => true,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 10,
            ],
            [
                'code' => 'tax_clearance',
                'label' => 'Tax clearance certificate',
                'mandatory' => true,
                'has_expiry' => true,
                'required_at_registration' => true,
                'required_for_rfq' => true,
                'sort_order' => 20,
            ],
            [
                'code' => 'company_profile',
                'label' => 'Company profile',
                'mandatory' => false,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 30,
            ],
            [
                'code' => 'bank_details',
                'label' => 'Bank confirmation / proof of account',
                'mandatory' => true,
                'has_expiry' => false,
                'required_at_registration' => true,
                'required_for_rfq' => false,
                'sort_order' => 40,
            ],
            [
                'code' => 'other',
                'label' => 'Other supporting document',
                'mandatory' => false,
                'has_expiry' => false,
                'required_at_registration' => false,
                'required_for_rfq' => false,
                'sort_order' => 90,
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function defaultDeclarations(): array
    {
        return [
            [
                'code' => 'code_of_conduct',
                'title' => 'Supplier Code of Conduct',
                'body' => 'I confirm that this supplier will comply with the SADC Parliamentary Forum Supplier Code of Conduct, including anti-bribery, fair dealing, and confidentiality obligations.',
            ],
            [
                'code' => 'conflict_of_interest',
                'title' => 'Conflict of Interest Declaration',
                'body' => 'I declare that any actual or potential conflicts of interest involving this supplier, its owners, or its personnel will be disclosed to Procurement before participating in a procurement process.',
            ],
            [
                'code' => 'eligibility',
                'title' => 'Eligibility Declaration',
                'body' => 'I declare that this supplier is eligible to contract with SADC PF, is not debarred or insolvent, and that the information and documents submitted are true and complete.',
            ],
        ];
    }

    public function ensureForTenant(int $tenantId): void
    {
        if (! Tenant::query()->whereKey($tenantId)->exists()) {
            return;
        }

        foreach (self::defaultRequirementTypes() as $type) {
            SupplierDocumentRequirementType::query()->firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $type['code']],
                [
                    'label' => $type['label'],
                    'mandatory' => $type['mandatory'],
                    'has_expiry' => $type['has_expiry'],
                    'warning_days' => 90,
                    'required_at_registration' => $type['required_at_registration'],
                    'required_for_rfq' => $type['required_for_rfq'],
                    'requires_verification' => true,
                    'is_active' => true,
                    'sort_order' => $type['sort_order'],
                ]
            );
        }

        foreach (self::defaultDeclarations() as $declaration) {
            SupplierDeclarationTemplate::query()->firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $declaration['code'], 'version' => 1],
                [
                    'title' => $declaration['title'],
                    'body' => $declaration['body'],
                    'required_at_registration' => true,
                    'is_active' => true,
                ]
            );
        }
    }
}
