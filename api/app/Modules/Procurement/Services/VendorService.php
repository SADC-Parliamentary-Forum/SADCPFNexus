<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\SupplierApprovalLog;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;

class VendorService
{
    public function __construct(protected NotificationService $notificationService) {}

    public function approveVendor(Vendor $vendor, User $approver): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $approver->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'                   => 'approved',
            'risk_level'               => $vendor->risk_level,
            'rejection_reason'         => null,
            'approved_by'              => $approver->id,
            'approved_at'              => now(),
            'rejected_at'              => null,
            'rejected_by'              => null,
            'suspended_at'             => null,
            'suspension_reason'        => null,
            'last_info_request_reason' => null,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => true]);
        $this->logAction($vendor, 'approved', null, $approver);

        AuditLog::record('vendor.approved', [
            'auditable_type' => Vendor::class,
            'auditable_id'   => $vendor->id,
            'new_values'     => ['status' => 'approved'],
            'tags'           => 'procurement',
        ]);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.approved',
                ['name' => $portalUser->name, 'supplier' => $vendor->name],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/supplier']
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
            'status'            => 'rejected',
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
            'new_values'     => ['reason' => $reason, 'status' => 'rejected'],
            'tags'           => 'procurement',
        ]);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.rejected',
                ['name' => $portalUser->name, 'supplier' => $vendor->name, 'comment' => $reason],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/supplier/profile']
            );
        }

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function requestInfo(Vendor $vendor, string $reason, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->update([
            'status'                   => $vendor->status === 'approved' ? 'pending_approval' : $vendor->status,
            'last_info_request_reason' => $reason,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $this->logAction($vendor, 'request_info', $reason, $actor);

        foreach ($vendor->portalUsers()->get() as $portalUser) {
            $this->notificationService->dispatch(
                $portalUser,
                'supplier.info_requested',
                ['name' => $portalUser->name, 'supplier' => $vendor->name, 'comment' => $reason],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/supplier/profile']
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
            'status'            => 'suspended',
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
                ['module' => 'procurement', 'record_id' => $vendor->id]
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
            'status'              => 'blacklisted',
            'blacklisted_at'      => now(),
            'blacklisted_by'      => $actor->id,
            'blacklist_reason'    => $reason,
            'blacklist_reference' => $reference,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => false]);
        $this->logAction($vendor, 'blacklisted', $reason, $actor, ['reference' => $reference]);

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    public function unblacklistVendor(Vendor $vendor, User $actor): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $vendor->fill([
            'status'              => $vendor->approved_at ? 'approved' : 'pending_approval',
            'blacklisted_at'      => null,
            'blacklisted_by'      => null,
            'blacklist_reason'    => null,
            'blacklist_reference' => null,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        $vendor->portalUsers()->update(['is_active' => $vendor->status === 'approved']);
        $this->logAction($vendor, 'unblacklisted', null, $actor);

        return $vendor->fresh(['categories', 'portalUsers']);
    }

    private function logAction(Vendor $vendor, string $action, ?string $reason, User $actor, array $metadata = []): void
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
