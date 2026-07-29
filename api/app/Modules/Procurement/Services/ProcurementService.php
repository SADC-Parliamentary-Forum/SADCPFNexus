<?php
namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\BudgetReservation;
use App\Models\RfqInvitation;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\SupplierCategory;
use App\Models\Vendor;
use App\Models\User;
use App\Mail\ModuleNotificationMail;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetCommitmentService;
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
        protected WorkflowService $workflowService,
        protected BudgetCommitmentService $commitments,
        protected BudgetAvailabilityService $budgetAvailability,
    ) {}
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = ProcurementRequest::with(['requester', 'items', 'quotes', 'supplierCategories', 'programme:id,reference_number,title'])
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

        if (!empty($filters['has_programme'])) {
            $query->whereNotNull('programme_id');
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

    public function submit(ProcurementRequest $request, User $user, ?string $splitJustification = null): ProcurementRequest
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

        $this->assertSplitJustificationIfRequired($request, $splitJustification);

        $payload = ['status' => 'submitted', 'submitted_at' => now()];
        if ($splitJustification !== null) {
            $payload['split_justification'] = $splitJustification;
        }
        $request->update($payload);

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

    public function suggestMethod(float $estimatedValue): string
    {
        $direct = (float) config('procurement.direct_purchase_limit');
        $rfqMax = (float) config('procurement.quotation_limit');

        if ($estimatedValue <= $direct) {
            return 'approved_supplier';
        }
        if ($estimatedValue <= $rfqMax) {
            return 'quotation';
        }

        return 'tender';
    }

    public function policySnapshot(): array
    {
        return [
            'direct_purchase_limit'   => (float) config('procurement.direct_purchase_limit'),
            'quotation_limit'         => (float) config('procurement.quotation_limit'),
            'tender_threshold'        => (float) config('procurement.tender_threshold'),
            'minimum_quotes_required' => (int) config('procurement.minimum_quotes_required'),
            'split_lookback_days'     => (int) config('procurement.split_lookback_days'),
            'split_enforcement'       => (string) config('procurement.split_enforcement', 'hard'),
            'profile_key'             => 'sadc_pf_core',
            'captured_at'             => now()->toIso8601String(),
        ];
    }

    public function authoriseSplit(ProcurementRequest $request, User $authoriser, ?string $notes = null): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $authoriser->tenant_id) {
            abort(404);
        }

        if (!$authoriser->hasAnyRole(['Finance Controller', 'Secretary General', 'System Admin', 'super-admin'])) {
            abort(403);
        }

        $warning = $this->detectSplitPurchase($request);
        if (!$warning && blank($request->split_justification)) {
            throw ValidationException::withMessages([
                'split_authorisation' => 'No split purchase warning is present for this request.',
            ]);
        }

        $request->update([
            'split_authorised_by'         => $authoriser->id,
            'split_authorised_at'         => now(),
            'split_authorisation_notes'   => $notes,
        ]);

        AuditLog::record('procurement.split_authorised', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'notes'   => $notes,
                'warning' => $warning,
            ],
            'tags' => 'procurement',
        ]);

        return $request->fresh();
    }

    public function assertSplitAuthorisedIfRequired(ProcurementRequest $request): void
    {
        if ((string) config('procurement.split_enforcement', 'hard') !== 'hard') {
            return;
        }

        $warning = $this->detectSplitPurchase($request);
        $hadSplitFlag = filled($request->split_justification) || $warning !== null;
        if (!$hadSplitFlag) {
            return;
        }

        if (blank($request->split_authorised_at)) {
            throw ValidationException::withMessages([
                'split_authorisation' => 'Potential split purchasing requires Finance / SG authorisation before this action.',
            ]);
        }
    }

    /**
     * Detect potential anti-split purchases within the lookback window.
     *
     * @return array{message: string, related_count: int, combined_value: float}|null
     */
    public function detectSplitPurchase(ProcurementRequest $request): ?array
    {
        $lookbackDays = (int) config('procurement.split_lookback_days', 30);
        $quotationLimit = (float) config('procurement.quotation_limit', 100_000);
        $currentValue = (float) ($request->estimated_value ?? 0);

        if ($currentValue <= 0 || $currentValue > $quotationLimit) {
            return null;
        }

        $titlePrefix = mb_substr(trim($request->title ?? ''), 0, 20);

        $related = ProcurementRequest::query()
            ->where('tenant_id', $request->tenant_id)
            ->when($request->exists, fn ($q) => $q->where('id', '!=', $request->id))
            ->whereNotIn('status', ['cancelled', 'rejected', 'withdrawn'])
            ->where('created_at', '>=', now()->subDays($lookbackDays))
            ->where(function ($q) use ($request) {
                $q->where('requester_id', $request->requester_id);
                if ($request->programme_id) {
                    $q->orWhere('programme_id', $request->programme_id);
                }
            })
            ->where(function ($q) use ($request, $titlePrefix) {
                $q->where('category', $request->category);
                if ($titlePrefix !== '') {
                    $q->orWhere('title', 'ilike', $titlePrefix . '%');
                }
                if ($request->budget_line) {
                    $q->orWhere('budget_line', $request->budget_line);
                }
            })
            ->get();

        if ($related->isEmpty()) {
            return null;
        }

        $combined = $related->sum(fn ($row) => (float) $row->estimated_value) + $currentValue;
        if ($combined <= $quotationLimit) {
            return null;
        }

        return [
            'message'         => 'Combined estimated value with similar recent requests exceeds the RFQ threshold. Provide split justification to proceed.',
            'related_count'   => $related->count(),
            'combined_value'  => round($combined, 2),
            'quotation_limit' => $quotationLimit,
        ];
    }

    public function assertSplitJustificationIfRequired(ProcurementRequest $request, ?string $splitJustification): void
    {
        $warning = $this->detectSplitPurchase($request);
        if (!$warning) {
            return;
        }

        if (blank($splitJustification)) {
            throw ValidationException::withMessages([
                'split_justification' => [$warning['message']],
                'split_warning'         => [$warning],
            ]);
        }

        AuditLog::record('procurement.split_justification', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'split_justification' => $splitJustification,
                'warning'             => $warning,
            ],
            'tags' => 'procurement',
        ]);
    }

    public function hodApprove(ProcurementRequest $request, User $hod): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $hod->tenant_id) {
            abort(404);
        }

        if (!$request->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be HOD-approved.']);
        }

        $suggested = $this->suggestMethod((float) ($request->estimated_value ?? 0));

        $request->update([
            'status'             => 'hod_approved',
            'hod_id'             => $hod->id,
            'hod_reviewed_at'    => now(),
            'suggested_method'   => $suggested,
            'policy_profile_key' => 'sadc_pf_core',
            'policy_snapshot'    => $this->policySnapshot(),
        ]);

        AuditLog::record('procurement.hod_approved', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'hod_id'           => $hod->id,
                'suggested_method' => $suggested,
            ],
            'tags'           => 'procurement',
        ]);

        return $request->fresh();
    }

    public function setMethod(ProcurementRequest $request, array $data, User $actor): ProcurementRequest
    {
        if ((int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $method = $data['procurement_method'];
        $suggested = $request->suggested_method ?: $this->suggestMethod((float) ($request->estimated_value ?? 0));
        $overrideReason = $data['method_override_reason'] ?? null;

        if ($method !== $suggested && blank($overrideReason)) {
            throw ValidationException::withMessages([
                'method_override_reason' => 'A reason is required when overriding the suggested procurement method.',
            ]);
        }

        $payload = ['procurement_method' => $method];
        if ($method !== $suggested) {
            $payload['method_override_reason'] = $overrideReason;
            $payload['method_override_by'] = $actor->id;
            $payload['method_override_at'] = now();
        } else {
            $payload['method_override_reason'] = null;
            $payload['method_override_by'] = null;
            $payload['method_override_at'] = null;
        }

        $request->update($payload);

        AuditLog::record('procurement.method_override', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'procurement_method'     => $method,
                'suggested_method'       => $suggested,
                'method_override_reason' => $overrideReason,
            ],
            'tags'           => 'procurement',
        ]);

        return $request->fresh();
    }

    protected function assertBudgetConfirmed(ProcurementRequest $request): void
    {
        $active = $request->budgetReservations()
            ->whereNull('released_at')
            ->where(function ($q) {
                $q->whereNull('status')
                    ->orWhereIn('status', BudgetReservation::ACTIVE_STATUSES);
            })
            ->exists();

        if (! $active) {
            throw ValidationException::withMessages([
                'budget' => 'Finance budget confirmation is required before this action.',
            ]);
        }
    }

    /**
     * Shared award gates: SoD (awarder ≠ requester), budget line, confirmed reservation,
     * and reservation/availability cover for the award amount.
     */
    public function assertAwardGates(ProcurementRequest $request, User $awarder, float $awardAmount): void
    {
        if ((int) $request->requester_id === (int) $awarder->id) {
            throw ValidationException::withMessages([
                'award' => 'You cannot award a request you originated (segregation of duties).',
            ]);
        }

        if (blank($request->budget_line)) {
            throw ValidationException::withMessages([
                'budget_line' => 'A budget line is required before award.',
            ]);
        }

        $this->assertBudgetConfirmed($request);

        $reservation = $request->budgetReservations()
            ->whereNull('released_at')
            ->where(function ($q) {
                $q->whereNull('status')
                    ->orWhereIn('status', BudgetReservation::ACTIVE_STATUSES);
            })
            ->latest('id')
            ->first();

        $reserved = round((float) ($reservation?->current_amount ?? $reservation?->reserved_amount ?? 0), 2);
        $awardAmount = round($awardAmount, 2);

        if ($reserved + 1e-9 >= $awardAmount) {
            return;
        }

        if ($reservation?->budget_line_id) {
            $shortfall = round($awardAmount - $reserved, 2);
            $check = $this->budgetAvailability->check((int) $reservation->budget_line_id, $shortfall);
            if ($check['sufficient']) {
                return;
            }
        }

        throw ValidationException::withMessages([
            'budget' => 'Insufficient budget availability for the award amount.',
        ]);
    }

    /**
     * Align the procurement commitment to the awarded quote amount.
     * Savings (award < reserved) are released back to available budget.
     * Increases require remaining available funds.
     */
    public function adjustCommitmentToAwardAmount(ProcurementRequest $request, float $awardAmount, User $actor): void
    {
        $awardAmount = round($awardAmount, 2);
        if ($awardAmount <= 0) {
            return;
        }

        $commitment = $this->commitments->findBySourceKey((int) $request->tenant_id, 'PROCUREMENT:'.$request->id)
            ?? BudgetReservation::query()
                ->where('procurement_request_id', $request->id)
                ->whereNull('released_at')
                ->latest('id')
                ->first();

        if (! $commitment || ! $commitment->isActive()) {
            return;
        }

        $current = round((float) $commitment->current_amount, 2);
        if (abs($current - $awardAmount) < 0.01) {
            return;
        }

        $this->commitments->adjust(
            $commitment,
            $awardAmount,
            $actor,
            $awardAmount < $current
                ? 'Procurement award savings release'
                : 'Procurement award amount increase',
        );
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

        $this->assertBudgetConfirmed($request);
        $this->assertSplitAuthorisedIfRequired($request);

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

        $this->assertBudgetConfirmed($request);
        $this->assertSplitAuthorisedIfRequired($request);

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

        // Enforce minimum quotation count above the direct-purchase threshold.
        $estimatedValue   = (float) ($request->estimated_value ?? 0);
        $quotationLimit   = (float) config('procurement.quotation_limit', 100_000);
        $minQuotes        = (int)   config('procurement.minimum_quotes_required', 3);
        if ($estimatedValue > $quotationLimit) {
            $receivedQuotes = $request->quotes()->whereNotNull('assessed_at')->count();
            if ($receivedQuotes < $minQuotes) {
                throw ValidationException::withMessages([
                    'quote_id' => "At least {$minQuotes} assessed quotations are required for purchases above NAD " . number_format($quotationLimit, 2) . '. Only ' . $receivedQuotes . ' assessed quote(s) received.',
                ]);
            }
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

        $this->adjustCommitmentToAwardAmount($request, (float) $quote->quoted_amount, $awarder);

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

        $this->assertBudgetConfirmed($request);
        $this->assertSplitAuthorisedIfRequired($request);

        // Enforce tender-method requirement above the tender threshold.
        $estimatedValue    = (float) ($request->estimated_value ?? 0);
        $tenderThreshold   = (float) config('procurement.tender_threshold', 100_000);
        $procurementMethod = $request->procurement_method ?? 'quotation';
        if ($estimatedValue >= $tenderThreshold && $procurementMethod !== 'tender') {
            throw ValidationException::withMessages([
                'procurement_method' => 'Purchases at or above NAD ' . number_format($tenderThreshold, 2) . ' require an open tender process. Please update the procurement method to "tender".',
            ]);
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
