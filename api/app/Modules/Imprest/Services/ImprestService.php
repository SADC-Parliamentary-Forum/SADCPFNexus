<?php
namespace App\Modules\Imprest\Services;

use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\ImprestRequest;
use App\Models\User;
use App\Modules\Finance\Services\BalanceRegisterService;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImprestService
{
    public function __construct(
        protected NotificationService $notificationService,
        protected WorkflowService $workflowService,
        protected ImprestBudgetReservationService $budgetReservationService,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = ImprestRequest::with(['requester', 'orgBudgetLine'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): ImprestRequest
    {
        $orgBudgetLineId = isset($data['budget_line_id']) ? (int) $data['budget_line_id'] : null;
        $orgBudgetLineLabel = $data['budget_line'] ?? null;

        if ($orgBudgetLineId) {
            $line = BudgetLine::query()
                ->whereKey($orgBudgetLineId)
                ->whereHas('budget', fn ($q) => $q->where('tenant_id', $user->tenant_id))
                ->firstOrFail();
            $orgBudgetLineLabel = $orgBudgetLineLabel ?: $line->displayName();
        }

        if (! filled($orgBudgetLineLabel) && ! $orgBudgetLineId) {
            throw ValidationException::withMessages([
                'budget_line' => 'A budget line is required.',
            ]);
        }

        $imprest = ImprestRequest::create([
            'tenant_id' => $user->tenant_id,
            'requester_id' => $user->id,
            'reference_number' => 'IMP-'.strtoupper(Str::random(8)),
            'budget_line' => $orgBudgetLineLabel ?? 'Unspecified',
            'budget_line_id' => $orgBudgetLineId,
            'amount_requested' => $data['amount_requested'],
            'currency' => $data['currency'] ?? 'USD',
            'expected_liquidation_date' => $data['expected_liquidation_date'],
            'purpose' => $data['purpose'],
            'justification' => $data['justification'] ?? null,
            'travel_request_id' => $data['travel_request_id'] ?? null,
            'status' => 'draft',
        ]);

        AuditLog::record('imprest.created', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => ['reference' => $imprest->reference_number, 'amount' => $imprest->amount_requested],
            'tags' => 'imprest',
        ]);

        return $imprest->load(['requester', 'orgBudgetLine']);
    }

    public function update(ImprestRequest $imprest, array $data, User $user): ImprestRequest
    {
        if (! $imprest->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $payload = array_filter([
            'amount_requested' => $data['amount_requested'] ?? null,
            'expected_liquidation_date' => $data['expected_liquidation_date'] ?? null,
            'purpose' => $data['purpose'] ?? null,
            'justification' => $data['justification'] ?? null,
        ], fn ($v) => $v !== null);

        if (array_key_exists('budget_line_id', $data)) {
            $orgBudgetLineId = $data['budget_line_id'] !== null ? (int) $data['budget_line_id'] : null;
            $payload['budget_line_id'] = $orgBudgetLineId;
            if ($orgBudgetLineId) {
                $line = BudgetLine::query()
                    ->whereKey($orgBudgetLineId)
                    ->whereHas('budget', fn ($q) => $q->where('tenant_id', $user->tenant_id))
                    ->firstOrFail();
                $payload['budget_line'] = $data['budget_line'] ?? $line->displayName();
            } elseif (isset($data['budget_line'])) {
                $payload['budget_line'] = $data['budget_line'];
            }
        } elseif (isset($data['budget_line'])) {
            $payload['budget_line'] = $data['budget_line'];
        }

        $imprest->update($payload);

        AuditLog::record('imprest.updated', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'tags' => 'imprest',
        ]);

        return $imprest->fresh(['requester', 'orgBudgetLine']);
    }

    public function submit(ImprestRequest $imprest, User $user): ImprestRequest
    {
        if (! $imprest->isDraft() && $imprest->status !== 'returned_for_correction') {
            throw ValidationException::withMessages(['status' => 'Only draft or returned requests can be submitted.']);
        }

        $imprest->update(['status' => 'submitted', 'submitted_at' => now()]);

        $workflowStarted = $this->workflowService->initiate($imprest, 'imprest', $user);

        if (! $workflowStarted) {
            $approvers = User::role(['Finance Controller', 'Secretary General'])
                ->where('tenant_id', $user->tenant_id)
                ->where('id', '!=', $user->id)
                ->get();
            $this->notificationService->dispatchToMany($approvers, 'imprest.submitted', [
                'reference' => $imprest->reference_number,
                'requester' => $user->name,
                'amount' => number_format($imprest->amount_requested, 2).' '.$imprest->currency,
            ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/'.$imprest->id]);
        }

        AuditLog::record('imprest.submitted', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'tags' => 'imprest',
        ]);

        return $imprest->fresh();
    }

    public function approve(ImprestRequest $imprest, array $data, User $approver): ImprestRequest
    {
        if (! $imprest->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        if ((int) $imprest->requester_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $imprest->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'amount_approved' => $data['amount_approved'] ?? $imprest->amount_requested,
            'approved_at' => now(),
        ]);

        AuditLog::record('imprest.approved', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'tags' => 'imprest',
        ]);

        $imprest->loadMissing('requester');
        if ($imprest->requester) {
            $this->notificationService->dispatch($imprest->requester, 'imprest.approved', [
                'name' => $imprest->requester->name,
                'reference' => $imprest->reference_number,
                'amount' => number_format($imprest->amount_approved ?? $imprest->amount_requested, 2).' '.$imprest->currency,
            ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/'.$imprest->id]);
        }

        try {
            app(BalanceRegisterService::class)->createFromImprest($imprest->fresh(), $approver);
        } catch (\Throwable) {
        }

        $this->budgetReservationService->reserveOnApprove($imprest->fresh(), $approver);

        return $imprest->fresh(['requester', 'orgBudgetLine']);
    }

    public function reject(ImprestRequest $imprest, string $reason, User $approver): ImprestRequest
    {
        if (! $imprest->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $imprest->update([
            'status' => 'rejected',
            'approved_by' => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('imprest.rejected', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => ['reason' => $reason],
            'tags' => 'imprest',
        ]);

        $imprest->loadMissing('requester');
        if ($imprest->requester) {
            $this->notificationService->dispatch($imprest->requester, 'imprest.rejected', [
                'name' => $imprest->requester->name,
                'reference' => $imprest->reference_number,
                'comment' => $reason,
            ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/'.$imprest->id]);
        }

        $this->budgetReservationService->releaseOnCancel($imprest->fresh(), $approver, $reason);

        return $imprest->fresh();
    }

    public function retire(ImprestRequest $imprest, array $data, User $user): ImprestRequest
    {
        if (! $imprest->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved requests can be retired.']);
        }

        abort_if(
            (int) $imprest->requester_id !== (int) $user->id
            && ! ($user->isSystemAdmin() || $user->hasAnyRole(['Finance Controller', 'Secretary General'])),
            403,
            'You are not allowed to liquidate this imprest request.'
        );

        $imprest->update([
            'status' => 'liquidated',
            'amount_liquidated' => $data['amount_liquidated'],
            'liquidated_at' => now(),
            'justification' => $data['notes'] ?? $imprest->justification,
        ]);

        AuditLog::record('imprest.liquidated', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => ['amount_liquidated' => $data['amount_liquidated']],
            'tags' => 'imprest',
        ]);

        $this->budgetReservationService->settleOnRetire($imprest->fresh(), $user);

        return $imprest->fresh(['requester', 'orgBudgetLine']);
    }
}
