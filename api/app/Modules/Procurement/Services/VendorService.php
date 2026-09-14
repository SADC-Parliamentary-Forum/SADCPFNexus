<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\SupplierApprovalLog;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use App\Support\FrontendUrl;

class VendorService
{
    public function __construct(protected NotificationService $notificationService) {}

    public function approveVendor(Vendor $vendor, User $approver, bool $conditional = false): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $approver->tenant_id) {
            abort(404);
        }

        $status = $conditional ? Vendor::STATUS_CONDITIONALLY_APPROVED : Vendor::STATUS_APPROVED;

        $vendor->fill([
            'status'                   => $status,
            'risk_level'               => $vendor->risk_level,
            'rejection_reason'         => null,
            'approved_by'              => $approver->id,
            'approved_at'              => now(),
            'rejected_at'              => null,
            'rejected_by'              => null,
            'suspended_at'             => null,
            'suspension_reason'        => null,
            'last_info_request_reason' => null,
            'critical_fields_locked_at' => $vendor->critical_fields_locked_at ?? now(),
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => true]);
        $this->logAction($vendor, $conditional ? 'conditionally_approved' : 'approved', null, $approver);

        AuditLog::record($conditional ? 'vendor.conditionally_approved' : 'vendor.approved', [
            'auditable_type' => Vendor::class,
            'auditable_id'   => $vendor->id,
            'new_values'     => ['status' => $status],
            'tags'           => 'procurement',
        ]);

        $event = $conditional ? 'supplier.conditionally_approved' : 'supplier.approved';
        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                $event,
                [
                    'name'      => $portalUser->name,
                    'supplier'  => $vendor->name,
                    'login_url' => FrontendUrl::to('supplier/login'),
                ],
                [
                    'module'         => 'procurement',
                    'record_id'      => $vendor->id,
                    'url'            => '/supplier',
                    'allow_inactive' => true,
                ]
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function rejectVendor(Vendor $vendor, string $reason, User $approver): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $approver->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'            => Vendor::STATUS_REJECTED,
            'rejection_reason'  => $reason,
            'rejected_at'       => now(),
            'rejected_by'       => $approver->id,
            'last_info_request_reason' => null,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => false]);
        $this->logAction($vendor, 'rejected', $reason, $approver);

        AuditLog::record('vendor.rejected', [
            'auditable_type' => Vendor::class,
            'auditable_id'   => $vendor->id,
            'new_values'     => ['reason' => $reason, 'status' => Vendor::STATUS_REJECTED],
            'tags'           => 'procurement',
        ]);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.rejected',
                ['name' => $portalUser->name, 'supplier' => $vendor->name, 'comment' => $reason],
                [
                    'module'         => 'procurement',
                    'record_id'      => $vendor->id,
                    'url'            => '/supplier/profile',
                    'allow_inactive' => true,
                ]
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function requestInfo(Vendor $vendor, string $reason, User $actor): Vendor
    {
        return $this->returnForCorrection($vendor, $reason, $actor);
    }

    public function returnForCorrection(Vendor $vendor, string $reason, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'                   => Vendor::STATUS_CORRECTION_REQUIRED,
            'last_info_request_reason' => $reason,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $this->logAction($vendor, 'correction_required', $reason, $actor);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.info_requested',
                ['name' => $portalUser->name, 'supplier' => $vendor->name, 'comment' => $reason],
                [
                    'module'         => 'procurement',
                    'record_id'      => $vendor->id,
                    'url'            => '/supplier/profile',
                    'allow_inactive' => true,
                ]
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function markUnderReview(Vendor $vendor, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if ($vendor->normalizedStatus() === Vendor::STATUS_SUBMITTED) {
            $vendor->fill(['status' => Vendor::STATUS_UNDER_REVIEW]);
            $vendor->syncLegacyFlagsFromStatus();
            $vendor->save();
            $this->logAction($vendor, 'under_review', null, $actor);
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function verifyBanking(Vendor $vendor, User $officer): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $officer->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'finance_verified_at' => now(),
            'finance_verified_by' => $officer->id,
        ]);
        $vendor->save();

        $this->logAction($vendor, 'banking_verified', null, $officer, [
            'bank_name' => $vendor->bank_name,
            'bank_account_last4' => substr((string) $vendor->bank_account, -4),
        ]);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.banking_verified',
                ['name' => $portalUser->name, 'supplier' => $vendor->name],
                [
                    'module' => 'procurement',
                    'record_id' => $vendor->id,
                    'url' => '/supplier/profile',
                    'allow_inactive' => true,
                ]
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function suspendVendor(Vendor $vendor, string $reason, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'            => Vendor::STATUS_SUSPENDED,
            'suspended_at'      => now(),
            'suspension_reason' => $reason,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => false]);
        $this->logAction($vendor, 'suspended', $reason, $actor);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.suspended',
                ['name' => $portalUser->name, 'supplier' => $vendor->name, 'comment' => $reason],
                [
                    'module'         => 'procurement',
                    'record_id'      => $vendor->id,
                    'allow_inactive' => true,
                ]
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function blacklistVendor(Vendor $vendor, string $reason, ?string $reference, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'              => Vendor::STATUS_DEBARRED,
            'blacklisted_at'      => now(),
            'blacklisted_by'      => $actor->id,
            'blacklist_reason'    => $reason,
            'blacklist_reference' => $reference,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => false]);
        $this->logAction($vendor, 'debarred', $reason, $actor, ['reference' => $reference]);

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function unblacklistVendor(Vendor $vendor, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'              => $vendor->approved_at ? Vendor::STATUS_APPROVED : Vendor::STATUS_SUBMITTED,
            'blacklisted_at'      => null,
            'blacklisted_by'      => null,
            'blacklist_reason'    => null,
            'blacklist_reference' => null,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => in_array($vendor->normalizedStatus(), Vendor::PORTAL_LOGIN_STATUSES, true)]);
        $this->logAction($vendor, 'reinstated', null, $actor);

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function logAction(Vendor $vendor, string $action, ?string $reason, User $actor, array $metadata = []): void
    {
        SupplierApprovalLog::create([
            'tenant_id'    => $vendor->tenant_id,
            'vendor_id'    => $vendor->id,
            'action'       => $action,
            'reason'       => $reason,
            'metadata'     => $metadata ?: null,
            'performed_by' => $actor->id,
            'performed_at' => now(),
        ]);
    }
}
