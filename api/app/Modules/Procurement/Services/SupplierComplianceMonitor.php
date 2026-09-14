<?php

namespace App\Modules\Procurement\Services;

use App\Models\SupplierComplianceNotice;
use App\Models\SupplierDocument;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class SupplierComplianceMonitor
{
    public const WINDOWS = [90, 60, 30, 14, 0];

    public function __construct(
        private readonly SupplierEligibilityService $eligibility,
        private readonly NotificationService $notifications,
    ) {}

    public function run(?Carbon $asOf = null): int
    {
        $asOf = $asOf?->copy()->startOfDay() ?? now()->startOfDay();
        $notices = 0;

        $documents = SupplierDocument::query()
            ->where('is_current', true)
            ->whereNotNull('expiry_date')
            ->with(['vendor.portalUsers', 'requirementType'])
            ->get();

        foreach ($documents as $document) {
            $vendor = $document->vendor;
            if (! $vendor instanceof Vendor) {
                continue;
            }

            $days = $document->daysUntilExpiry($asOf);
            if ($days === null) {
                continue;
            }

            $window = $this->windowForDays($days);
            if ($window === null) {
                continue;
            }

            if ($days < 0 && $document->status !== SupplierDocument::STATUS_EXPIRED) {
                $document->update(['status' => SupplierDocument::STATUS_EXPIRED]);
            }

            if ($this->alreadyNoticed($document, $window, $asOf)) {
                continue;
            }

            $this->recordNotice($document, $window, $asOf);
            $this->notify($vendor, $document, $window, $asOf);
            $notices++;
        }

        $this->flipComplianceWarnings();

        return $notices;
    }

    public function flipComplianceWarnings(): void
    {
        $vendors = Vendor::query()
            ->whereIn('status', [
                Vendor::STATUS_APPROVED,
                Vendor::STATUS_CONDITIONALLY_APPROVED,
                Vendor::STATUS_COMPLIANCE_WARNING,
                'pending_approval',
            ])
            ->with('currentDocuments')
            ->get();

        foreach ($vendors as $vendor) {
            $evaluation = $this->eligibility->evaluate($vendor);
            $status = $vendor->normalizedStatus();

            if (in_array($status, [Vendor::STATUS_APPROVED, Vendor::STATUS_CONDITIONALLY_APPROVED], true)
                && $evaluation['compliance_status'] === 'non_compliant'
            ) {
                $vendor->fill(['status' => Vendor::STATUS_COMPLIANCE_WARNING]);
                $vendor->syncLegacyFlagsFromStatus();
                $vendor->save();
                $this->notifyStatusChange($vendor, 'supplier.compliance_warning');
                continue;
            }

            if ($status === Vendor::STATUS_COMPLIANCE_WARNING && $evaluation['compliance_status'] !== 'non_compliant') {
                $restored = $vendor->approved_at ? Vendor::STATUS_APPROVED : Vendor::STATUS_CONDITIONALLY_APPROVED;
                $vendor->fill(['status' => $restored]);
                $vendor->syncLegacyFlagsFromStatus();
                $vendor->save();
            }
        }
    }

    private function windowForDays(int $days): ?string
    {
        if ($days < 0) {
            return 'expired';
        }
        foreach ([14, 30, 60, 90] as $window) {
            if ($days <= $window) {
                return (string) $window;
            }
        }

        return null;
    }

    private function alreadyNoticed(SupplierDocument $document, string $window, Carbon $asOf): bool
    {
        if (! class_exists(SupplierComplianceNotice::class) || ! Schema::hasTable('supplier_compliance_notices')) {
            return false;
        }

        return SupplierComplianceNotice::query()
            ->where('supplier_document_id', $document->id)
            ->where('window', $window)
            ->exists();
    }

    private function recordNotice(SupplierDocument $document, string $window, Carbon $asOf): void
    {
        if (! Schema::hasTable('supplier_compliance_notices')) {
            return;
        }

        SupplierComplianceNotice::query()->firstOrCreate([
            'supplier_document_id' => $document->id,
            'window' => $window,
            'notice_date' => $asOf->toDateString(),
        ], [
            'tenant_id' => $document->tenant_id,
            'vendor_id' => $document->vendor_id,
        ]);
    }

    private function notify(Vendor $vendor, SupplierDocument $document, string $window, Carbon $asOf): void
    {
        $event = $window === 'expired' ? 'supplier.document_expired' : 'supplier.document_expiring';
        $payload = [
            'supplier' => $vendor->name,
            'document_type' => $document->type_code,
            'document_name' => $document->name,
            'expires_at' => optional($document->expiry_date)->toDateString(),
            'window' => $window,
        ];

        foreach ($vendor->portalUsers as $portalUser) {
            $this->notifications->dispatch(
                $portalUser,
                $event,
                ['name' => $portalUser->name] + $payload,
                [
                    'module' => 'procurement',
                    'record_id' => $vendor->id,
                    'url' => '/supplier/profile',
                    'allow_inactive' => true,
                    'idempotency_key' => $event.':'.$document->id.':'.$window.':'.$asOf->toDateString().':user:'.$portalUser->id,
                ]
            );
        }

        foreach ($this->procurementRecipients((int) $vendor->tenant_id) as $officer) {
            $this->notifications->dispatch(
                $officer,
                'procurement.vendor_document.expiring',
                [
                    'name' => $officer->name,
                    'vendor' => $vendor->name,
                    'document_type' => $document->type_code,
                    'expires_at' => optional($document->expiry_date)->toDateString(),
                ],
                [
                    'module' => 'procurement',
                    'record_id' => $vendor->id,
                    'url' => '/procurement/vendors/'.$vendor->id,
                    'idempotency_key' => 'procurement.vendor_document.expiring:'.$document->id.':'.$window.':'.$asOf->toDateString().':user:'.$officer->id,
                ]
            );
        }
    }

    private function notifyStatusChange(Vendor $vendor, string $event): void
    {
        foreach ($vendor->portalUsers as $portalUser) {
            $this->notifications->dispatch(
                $portalUser,
                $event,
                ['name' => $portalUser->name, 'supplier' => $vendor->name],
                [
                    'module' => 'procurement',
                    'record_id' => $vendor->id,
                    'url' => '/supplier',
                    'allow_inactive' => true,
                ]
            );
        }

        foreach ($this->procurementRecipients((int) $vendor->tenant_id) as $officer) {
            $this->notifications->dispatch(
                $officer,
                $event,
                ['name' => $officer->name, 'supplier' => $vendor->name],
                [
                    'module' => 'procurement',
                    'record_id' => $vendor->id,
                    'url' => '/procurement/vendors/'.$vendor->id,
                ]
            );
        }
    }

    private function procurementRecipients(int $tenantId): Collection
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.manage_vendors', 'procurement.admin']))
            ->values();
    }
}
