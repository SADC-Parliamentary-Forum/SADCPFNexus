<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Validation\ValidationException;

class VendorService
{
    public function __construct(protected NotificationService $notificationService) {}

    public function approveVendor(Vendor $vendor, User $approver): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $approver->tenant_id) {
            abort(404);
        }

        $vendor->update([
            'is_approved'      => true,
            'rejection_reason' => null,
            'approved_by'      => $approver->id,
            'approved_at'      => now(),
        ]);

        AuditLog::record('vendor.approved', [
            'auditable_type' => Vendor::class,
            'auditable_id'   => $vendor->id,
            'new_values'     => ['is_approved' => true],
            'tags'           => 'procurement',
        ]);

        return $vendor->fresh();
    }

    public function rejectVendor(Vendor $vendor, string $reason, User $approver): Vendor
    {
        if ((int) $vendor->tenant_id !== (int) $approver->tenant_id) {
            abort(404);
        }

        $vendor->update([
            'is_approved'      => false,
            'is_active'        => false,
            'rejection_reason' => $reason,
            'approved_by'      => $approver->id,
            'approved_at'      => now(),
        ]);

        AuditLog::record('vendor.rejected', [
            'auditable_type' => Vendor::class,
            'auditable_id'   => $vendor->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'procurement',
        ]);

        return $vendor->fresh();
    }
}
