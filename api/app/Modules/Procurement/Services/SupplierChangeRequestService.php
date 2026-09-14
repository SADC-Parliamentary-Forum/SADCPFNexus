<?php

namespace App\Modules\Procurement\Services;

use App\Models\SupplierApprovalLog;
use App\Models\SupplierCategory;
use App\Models\SupplierChangeRequest;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorOwner;
use App\Services\NotificationService;
use Illuminate\Validation\ValidationException;

class SupplierChangeRequestService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function queueOrApply(Vendor $vendor, string $group, array $payload, User $actor, ?string $reason = null): Vendor|SupplierChangeRequest
    {
        if (! in_array($group, SupplierChangeRequest::CRITICAL_GROUPS, true)) {
            throw ValidationException::withMessages(['field_group' => ['Unsupported critical field group.']]);
        }

        if (! $vendor->criticalFieldsLocked()) {
            $this->applyPayload($vendor, $group, $payload);
            $vendor->save();

            return $vendor->fresh(['owners', 'categories']);
        }

        $previous = $this->snapshot($vendor, $group);

        $request = SupplierChangeRequest::create([
            'tenant_id' => $vendor->tenant_id,
            'vendor_id' => $vendor->id,
            'field_group' => $group,
            'payload' => $payload,
            'previous_payload' => $previous,
            'status' => SupplierChangeRequest::STATUS_PENDING,
            'reason' => $reason,
            'requested_by' => $actor->id,
        ]);

        $this->notifyProcurement($vendor, $request);

        return $request;
    }

    /**
     * @param  list<int|string>  $ids
     */
    public function queueCategoryIds(Vendor $vendor, array $ids, User $actor, ?string $reason = null): Vendor|SupplierChangeRequest|null
    {
        $valid = SupplierCategory::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->whereIn('id', array_map('intval', $ids))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $current = $vendor->categories()->pluck('supplier_categories.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $next = collect($valid)->sort()->values()->all();
        if ($current === $next) {
            return null;
        }

        return $this->queueOrApply($vendor, SupplierChangeRequest::GROUP_CATEGORIES, ['category_ids' => $valid], $actor, $reason);
    }

    public function approve(SupplierChangeRequest $request, User $reviewer, ?string $remarks = null): SupplierChangeRequest
    {
        if ((int) $request->tenant_id !== (int) $reviewer->tenant_id) {
            abort(404);
        }

        $vendor = $request->vendor;
        $this->applyPayload($vendor, $request->field_group, $request->payload ?? []);
        $vendor->save();

        $request->update([
            'status' => SupplierChangeRequest::STATUS_APPROVED,
            'review_remarks' => $remarks,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        SupplierApprovalLog::create([
            'tenant_id' => $vendor->tenant_id,
            'vendor_id' => $vendor->id,
            'action' => 'change_request_approved',
            'reason' => $remarks,
            'metadata' => ['change_request_id' => $request->id, 'field_group' => $request->field_group],
            'performed_by' => $reviewer->id,
            'performed_at' => now(),
        ]);

        $this->notifySupplier($vendor, $request, 'supplier.change_request_resolved');

        return $request->fresh();
    }

    public function reject(SupplierChangeRequest $request, User $reviewer, string $remarks): SupplierChangeRequest
    {
        if ((int) $request->tenant_id !== (int) $reviewer->tenant_id) {
            abort(404);
        }

        $request->update([
            'status' => SupplierChangeRequest::STATUS_REJECTED,
            'review_remarks' => $remarks,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        SupplierApprovalLog::create([
            'tenant_id' => $request->tenant_id,
            'vendor_id' => $request->vendor_id,
            'action' => 'change_request_rejected',
            'reason' => $remarks,
            'metadata' => ['change_request_id' => $request->id, 'field_group' => $request->field_group],
            'performed_by' => $reviewer->id,
            'performed_at' => now(),
        ]);

        $this->notifySupplier($request->vendor, $request, 'supplier.change_request_resolved');

        return $request->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function snapshot(Vendor $vendor, string $group): array
    {
        return match ($group) {
            SupplierChangeRequest::GROUP_LEGAL_NAME => ['name' => $vendor->name],
            SupplierChangeRequest::GROUP_REGISTRATION => ['registration_number' => $vendor->registration_number],
            SupplierChangeRequest::GROUP_TAX => ['tax_number' => $vendor->tax_number],
            SupplierChangeRequest::GROUP_BANKING => [
                'bank_name' => $vendor->bank_name,
                'bank_account' => $vendor->bank_account,
                'bank_branch' => $vendor->bank_branch,
            ],
            SupplierChangeRequest::GROUP_OWNERSHIP => [
                'owners' => $vendor->owners()->get(['full_name', 'role', 'ownership_percent', 'nationality', 'id_number', 'is_beneficial_owner', 'is_pep', 'sort_order'])->toArray(),
            ],
            SupplierChangeRequest::GROUP_CATEGORIES => [
                'category_ids' => $vendor->categories()->pluck('supplier_categories.id')->map(fn ($id) => (int) $id)->values()->all(),
            ],
            default => [],
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function applyPayload(Vendor $vendor, string $group, array $payload): void
    {
        match ($group) {
            SupplierChangeRequest::GROUP_LEGAL_NAME => $vendor->name = $payload['name'] ?? $vendor->name,
            SupplierChangeRequest::GROUP_REGISTRATION => $vendor->registration_number = $payload['registration_number'] ?? $vendor->registration_number,
            SupplierChangeRequest::GROUP_TAX => $vendor->tax_number = $payload['tax_number'] ?? $vendor->tax_number,
            SupplierChangeRequest::GROUP_BANKING => $vendor->fill([
                'bank_name' => $payload['bank_name'] ?? $vendor->bank_name,
                'bank_account' => $payload['bank_account'] ?? $vendor->bank_account,
                'bank_branch' => $payload['bank_branch'] ?? $vendor->bank_branch,
                'finance_verified_at' => null,
                'finance_verified_by' => null,
            ]),
            SupplierChangeRequest::GROUP_OWNERSHIP => $this->replaceOwners($vendor, $payload['owners'] ?? []),
            SupplierChangeRequest::GROUP_CATEGORIES => $this->syncCategories($vendor, $payload['category_ids'] ?? []),
            default => null,
        };
    }

    /**
     * @param  list<int|string>  $ids
     */
    public function syncCategories(Vendor $vendor, array $ids): void
    {
        $categories = SupplierCategory::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->whereIn('id', array_map('intval', $ids))
            ->orderBy('name')
            ->get();

        $vendor->categories()->sync($categories->pluck('id')->all());
        $vendor->category = $categories->pluck('name')->join(', ');
    }

    /**
     * @param  list<array<string, mixed>>  $owners
     */
    public function replaceOwners(Vendor $vendor, array $owners): void
    {
        $vendor->owners()->delete();
        foreach (array_values($owners) as $index => $owner) {
            if (! is_array($owner) || empty($owner['full_name'])) {
                continue;
            }
            VendorOwner::create([
                'tenant_id' => $vendor->tenant_id,
                'vendor_id' => $vendor->id,
                'full_name' => $owner['full_name'],
                'role' => $owner['role'] ?? null,
                'ownership_percent' => $owner['ownership_percent'] ?? null,
                'nationality' => $owner['nationality'] ?? null,
                'id_number' => $owner['id_number'] ?? null,
                'is_beneficial_owner' => $owner['is_beneficial_owner'] ?? true,
                'is_pep' => $owner['is_pep'] ?? false,
                'sort_order' => $owner['sort_order'] ?? $index,
            ]);
        }
    }

    private function notifyProcurement(Vendor $vendor, SupplierChangeRequest $request): void
    {
        $recipients = User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.manage_vendors', 'procurement.admin']));

        foreach ($recipients as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.change_request_submitted',
                [
                    'name' => $recipient->name,
                    'supplier' => $vendor->name,
                    'field_group' => $request->field_group,
                ],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/procurement/vendors/'.$vendor->id]
            );
        }
    }

    private function notifySupplier(Vendor $vendor, SupplierChangeRequest $request, string $event): void
    {
        foreach ($vendor->portalUsers as $portalUser) {
            $this->notifications->dispatch(
                $portalUser,
                $event,
                [
                    'name' => $portalUser->name,
                    'supplier' => $vendor->name,
                    'field_group' => $request->field_group,
                    'status' => $request->status,
                    'comment' => $request->review_remarks,
                ],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/supplier/profile', 'allow_inactive' => true]
            );
        }
    }
}
