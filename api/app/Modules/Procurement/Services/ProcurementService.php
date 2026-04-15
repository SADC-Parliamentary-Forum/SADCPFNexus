<?php
namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\RfqInvitation;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\SupplierCategory;
use App\Models\Vendor;
use App\Models\User;
use App\Mail\ModuleNotificationMail;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProcurementService
{
    public function __construct(
        protected NotificationService $notificationService,
        protected WorkflowService     $workflowService,
    ) {}
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = ProcurementRequest::with(['requester', 'items', 'quotes', 'supplierCategories'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('title', 'ilike', "%{$filters['search']}%")
                  ->orWhere('reference_number', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): ProcurementRequest
    {
        $request = ProcurementRequest::create([
            'tenant_id'          => $user->tenant_id,
            'requester_id'       => $user->id,
            'reference_number'   => 'PRQ-' . strtoupper(Str::random(8)),
            'title'              => $data['title'],
            'description'        => $data['description'],
            'category'           => $data['category'],
            'estimated_value'    => $data['estimated_value'] ?? 0,
            'currency'           => $data['currency'] ?? 'USD',
            'procurement_method' => $data['procurement_method'] ?? 'quotation',
            'budget_line'        => $data['budget_line'] ?? null,
            'justification'      => $data['justification'] ?? null,
            'required_by_date'   => $data['required_by_date'] ?? null,
            'status'             => 'draft',
        ]);

        if (!empty($data['items'])) {
            foreach ($data['items'] as $item) {
                $request->items()->create([
                    'description'          => $item['description'],
                    'quantity'             => $item['quantity'] ?? 1,
                    'unit'                 => $item['unit'] ?? 'unit',
                    'estimated_unit_price' => $item['estimated_unit_price'] ?? 0,
                    'total_price'          => ($item['quantity'] ?? 1) * ($item['estimated_unit_price'] ?? 0),
                ]);
            }
        }

        AuditLog::record('procurement.created', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['reference' => $request->reference_number, 'title' => $request->title],
            'tags'           => 'procurement',
        ]);

        return $request->load(['requester', 'items']);
    }

    public function update(ProcurementRequest $request, array $data, User $user): ProcurementRequest
    {
        if (!$request->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $request->update(array_filter([
            'title'            => $data['title'] ?? null,
            'description'      => $data['description'] ?? null,
            'category'         => $data['category'] ?? null,
            'estimated_value'  => $data['estimated_value'] ?? null,
            'budget_line'      => $data['budget_line'] ?? null,
            'justification'    => $data['justification'] ?? null,
            'required_by_date' => $data['required_by_date'] ?? null,
        ], fn($v) => $v !== null));

        AuditLog::record('procurement.updated', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'tags'           => 'procurement',
        ]);

        return $request->fresh(['requester', 'items']);
    }

    public function submit(ProcurementRequest $request, User $user): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ((int) $request->requester_id !== (int) $user->id && !$user->hasAnyRole(['Procurement Officer', 'procurement_officer', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        if (!$request->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        $request->update(['status' => 'submitted', 'submitted_at' => now()]);

        AuditLog::record('procurement.submitted', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'tags'           => 'procurement',
        ]);

        // Initiate workflow — WorkflowService::initiate() calls notifyApprovers() internally,
        // which sends approval emails with action buttons to the first-step approvers.
        $this->workflowService->initiate($request, 'procurement', $user);

        return $request->fresh();
    }

    public function hodApprove(ProcurementRequest $request, User $hod): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $hod->tenant_id) {
            abort(404);
        }

        if (!$request->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be HOD-approved.']);
        }

        $request->update([
            'status'          => 'hod_approved',
            'hod_id'          => $hod->id,
            'hod_reviewed_at' => now(),
        ]);

        AuditLog::record('procurement.hod_approved', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['hod_id' => $hod->id],
            'tags'           => 'procurement',
        ]);

        return $request->fresh();
    }

    public function hodReject(ProcurementRequest $request, string $reason, User $hod): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $hod->tenant_id) {
            abort(404);
        }

        if (!$request->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be HOD-rejected.']);
        }

        $request->update([
            'status'           => 'hod_rejected',
            'hod_id'           => $hod->id,
            'hod_reviewed_at'  => now(),
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('procurement.hod_rejected', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'procurement',
        ]);

        $request->loadMissing('requester');
        if ($request->requester) {
            $this->notificationService->dispatch(
                $request->requester,
                'procurement.rejected',
                ['name' => $request->requester->name, 'reference' => $request->reference_number, 'comment' => $reason],
                ['module' => 'procurement', 'record_id' => $request->id, 'url' => '/procurement/' . $request->id]
            );
        }

        return $request->fresh();
    }

    public function approve(ProcurementRequest $request, User $approver): ProcurementRequest
    {
        // HOD must have reviewed before procurement officer can approve
        if (!$request->isHodApproved() && !$request->isBudgetReserved()) {
            throw ValidationException::withMessages(['status' => 'Request must be HOD-approved before procurement approval.']);
        }

        if ((int) $request->requester_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $request->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('procurement.approved', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'tags'           => 'procurement',
        ]);

        $request->loadMissing('requester');
        if ($request->requester) {
            $this->notificationService->dispatch(
                $request->requester,
                'procurement.approved',
                ['name' => $request->requester->name, 'reference' => $request->reference_number],
                ['module' => 'procurement', 'record_id' => $request->id, 'url' => '/procurement/' . $request->id]
            );
        }

        return $request->fresh();
    }

    public function award(ProcurementRequest $request, int $quoteId, ?string $notes, User $awarder): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $awarder->tenant_id) {
            abort(404);
        }

        if (!$request->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved requests can be awarded.']);
        }

        if (!$request->rfq_issued_at) {
            throw ValidationException::withMessages(['status' => 'Issue the RFQ before awarding this request.']);
        }

        // Quote must belong to this request
        $quote = $request->quotes()->find($quoteId);
        if (!$quote) {
            throw ValidationException::withMessages(['quote_id' => 'The selected quote does not belong to this request.']);
        }

        if (!$quote->assessed_at || $quote->compliance_passed !== true) {
            throw ValidationException::withMessages([
                'quote_id' => 'Only assessed and compliant quotes can be awarded.',
            ]);
        }

        if (! $quote->vendor_id) {
            throw ValidationException::withMessages([
                'quote_id' => 'Only quotes from registered suppliers can be awarded because purchase order and invoice processing continues in the supplier portal.',
            ]);
        }

        $request->update([
            'status'           => 'awarded',
            'awarded_quote_id' => $quote->id,
            'awarded_at'       => now(),
            'award_notes'      => $notes,
        ]);

        // Mark the winning quote as recommended
        $request->quotes()->where('id', '!=', $quote->id)->update(['is_recommended' => false]);
        $quote->update(['is_recommended' => true]);

        AuditLog::record('procurement.awarded', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'awarded_quote_id' => $quote->id,
                'vendor'           => $quote->vendor_name,
                'amount'           => $quote->quoted_amount,
            ],
            'tags' => 'procurement',
        ]);

        // Notify requester
        $request->loadMissing('requester');
        $this->ensureDraftPurchaseOrderForAward($request, $quote, $awarder);

        if ($request->requester) {
            $this->notificationService->dispatch(
                $request->requester,
                'procurement.awarded',
                [
                    'name'      => $request->requester->name,
                    'reference' => $request->reference_number,
                    'vendor'    => $quote->vendor_name,
                    'amount'    => number_format($quote->quoted_amount, 2) . ' ' . $quote->currency,
                ],
                ['module' => 'procurement', 'record_id' => $request->id, 'url' => '/procurement/' . $request->id]
            );
        }

        return $request->fresh(['requester', 'items', 'quotes', 'awardedQuote', 'supplierCategories', 'purchaseOrder.vendor', 'purchaseOrder.items']);
    }

    public function reject(ProcurementRequest $request, string $reason, User $approver): ProcurementRequest
    {
        if (!$request->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $request->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('procurement.rejected', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'procurement',
        ]);

        $request->loadMissing('requester');
        if ($request->requester) {
            $this->notificationService->dispatch(
                $request->requester,
                'procurement.rejected',
                ['name' => $request->requester->name, 'reference' => $request->reference_number, 'comment' => $reason],
                ['module' => 'procurement', 'record_id' => $request->id, 'url' => '/procurement/' . $request->id]
            );
        }

        return $request->fresh();
    }

    public function issueRfq(ProcurementRequest $request, array $data, User $actor): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if (!$request->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved procurement requests can be issued as RFQs.']);
        }

        $categoryIds = SupplierCategory::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('id', $data['category_ids'] ?? [])
            ->pluck('id')
            ->all();

        if (count($categoryIds) < 1 || count($categoryIds) > 3) {
            throw ValidationException::withMessages(['category_ids' => 'Select between 1 and 3 supplier categories for the RFQ.']);
        }

        $request->supplierCategories()->sync($categoryIds);
        $request->update([
            'rfq_issued_at' => $request->rfq_issued_at ?? now(),
            'rfq_issued_by' => $actor->id,
            'rfq_deadline'  => $data['rfq_deadline'] ?? null,
            'rfq_notes'     => $data['rfq_notes'] ?? null,
        ]);

        $vendors = Vendor::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('status', 'approved')
            ->whereHas('categories', fn ($q) => $q->whereIn('supplier_categories.id', $categoryIds))
            ->with('portalUsers')
            ->get();

        foreach ($vendors as $vendor) {
            $invitation = RfqInvitation::updateOrCreate(
                [
                    'procurement_request_id' => $request->id,
                    'vendor_id'              => $vendor->id,
                ],
                [
                    'tenant_id'            => $actor->tenant_id,
                    'invitation_type'      => 'system',
                    'status'               => 'sent',
                    'invited_name'         => $vendor->contact_name ?: $vendor->name,
                    'invited_email'        => $vendor->contact_email,
                    'response_token'       => Str::random(48),
                    'response_expires_at'  => $data['rfq_deadline'] ? Carbon::parse($data['rfq_deadline'])->endOfDay() : null,
                    'invited_at'           => now(),
                    'last_notified_at'     => now(),
                    'notes'                => $data['rfq_notes'] ?? null,
                    'created_by'           => $actor->id,
                ]
            );
            $this->notifySupplierInvitation($request, $vendor, $invitation);
        }

        foreach (($data['external_invites'] ?? []) as $invite) {
            if (empty($invite['email'])) {
                continue;
            }

            $invitation = RfqInvitation::updateOrCreate(
                [
                    'procurement_request_id' => $request->id,
                    'invited_email'          => $invite['email'],
                ],
                [
                    'tenant_id'            => $actor->tenant_id,
                    'vendor_id'            => null,
                    'invitation_type'      => 'email',
                    'status'               => 'sent',
                    'invited_name'         => $invite['name'] ?? $invite['email'],
                    'response_token'       => Str::random(48),
                    'response_expires_at'  => $data['rfq_deadline'] ? Carbon::parse($data['rfq_deadline'])->endOfDay() : null,
                    'invited_at'           => now(),
                    'last_notified_at'     => now(),
                    'notes'                => $data['rfq_notes'] ?? null,
                    'created_by'           => $actor->id,
                ]
            );

            $frontendBase = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
            $quoteUrl = $frontendBase . '/external-rfq/' . $invitation->response_token;
            $registerUrl = $frontendBase . '/supplier/register';
            Mail::to($invite['email'])->queue(new ModuleNotificationMail(
                "RFQ Invitation — {$request->reference_number}",
                "You have been invited to submit a quotation for {$request->title}.\n\nPlease use the secure link below to submit your quote before the deadline.\n\nWe strongly encourage you to register as a supplier on SADC-PF Nexus to view the full RFQ, receive future supplier notifications, and manage your submissions in one place.\n\nSupplier registration: {$registerUrl}",
                $invite['name'] ?? 'Supplier',
                $quoteUrl,
                null,
            ));
        }

        AuditLog::record('procurement.rfq_issued', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['rfq_deadline' => $request->rfq_deadline?->toDateString(), 'categories' => $categoryIds],
            'tags'           => 'procurement',
        ]);

        return $request->fresh(['requester', 'items', 'quotes.vendor', 'supplierCategories', 'rfqInvitations']);
    }

    private function notifySupplierInvitation(ProcurementRequest $request, Vendor $vendor, RfqInvitation $invitation): void
    {
        $frontendBase = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
        $portalUrl = $frontendBase . '/supplier/rfqs/' . $request->id;

        foreach ($vendor->portalUsers as $portalUser) {
            if (!$portalUser->is_active) {
                continue;
            }

            $this->notificationService->dispatch(
                $portalUser,
                'procurement.rfq_invited',
                [
                    'name'      => $portalUser->name,
                    'reference' => $request->reference_number,
                    'title'     => $request->title,
                    'deadline'  => $request->rfq_deadline?->toDateString() ?? 'No deadline specified',
                ],
                ['module' => 'procurement', 'record_id' => $request->id, 'url' => '/supplier/rfqs/' . $request->id]
            );
        }

        if ($vendor->contact_email) {
            Mail::to($vendor->contact_email)->queue(new ModuleNotificationMail(
                "RFQ Invitation — {$request->reference_number}",
                "An RFQ matching your supplier categories is available in the SADC-PF supplier portal.\n\nTitle: {$request->title}\nDeadline: " . ($request->rfq_deadline?->toDateString() ?? 'No deadline specified'),
                $vendor->contact_name ?: $vendor->name,
                $portalUrl,
                null,
            ));
        }
    }

    private function ensureDraftPurchaseOrderForAward(ProcurementRequest $request, $quote, User $awarder): void
    {
        $purchaseOrder = PurchaseOrder::query()
            ->where('procurement_request_id', $request->id)
            ->first();

        if ($purchaseOrder && ! $purchaseOrder->isDraft()) {
            return;
        }

        $vendor = Vendor::query()
            ->where('tenant_id', $awarder->tenant_id)
            ->findOrFail($quote->vendor_id);

        if (! $purchaseOrder) {
            $purchaseOrder = PurchaseOrder::create([
                'tenant_id'              => $awarder->tenant_id,
                'procurement_request_id' => $request->id,
                'vendor_id'              => $vendor->id,
                'title'                  => $request->title,
                'description'            => $request->description,
                'delivery_address'       => $vendor->address,
                'payment_terms'          => in_array($vendor->payment_terms, ['net_30', 'net_60', 'on_delivery'], true)
                    ? $vendor->payment_terms
                    : 'net_30',
                'total_amount'           => $quote->quoted_amount,
                'currency'               => $quote->currency ?: $request->currency ?: 'USD',
                'status'                 => 'draft',
                'expected_delivery_date' => $request->required_by_date,
                'created_by'             => $awarder->id,
            ]);

            foreach ($request->items as $item) {
                $purchaseOrder->items()->create([
                    'description'         => $item->description,
                    'quantity'            => $item->quantity,
                    'unit'                => $item->unit ?? 'unit',
                    'unit_price'          => $item->estimated_unit_price ?? 0,
                    'total_price'         => $item->total_price ?? (($item->quantity ?? 1) * ($item->estimated_unit_price ?? 0)),
                    'procurement_item_id' => $item->id,
                ]);
            }
        } else {
            $purchaseOrder->update([
                'vendor_id'              => $vendor->id,
                'title'                  => $request->title,
                'description'            => $request->description,
                'delivery_address'       => $vendor->address,
                'payment_terms'          => in_array($vendor->payment_terms, ['net_30', 'net_60', 'on_delivery'], true)
                    ? $vendor->payment_terms
                    : 'net_30',
                'total_amount'           => $quote->quoted_amount,
                'currency'               => $quote->currency ?: $request->currency ?: 'USD',
                'expected_delivery_date' => $request->required_by_date,
            ]);
        }
    }
}
