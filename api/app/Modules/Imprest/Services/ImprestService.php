<?php
namespace App\Modules\Imprest\Services;

use App\Models\AuditLog;
use App\Models\ImprestRequest;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImprestService
{
    public function __construct(protected NotificationService $notificationService) {}
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = ImprestRequest::with(['requester'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): ImprestRequest
    {
        $imprest = ImprestRequest::create([
            'tenant_id'                 => $user->tenant_id,
            'requester_id'              => $user->id,
            'reference_number'          => 'IMP-' . strtoupper(Str::random(8)),
            'budget_line'               => $data['budget_line'],
            'amount_requested'          => $data['amount_requested'],
            'currency'                  => $data['currency'] ?? 'USD',
            'expected_liquidation_date' => $data['expected_liquidation_date'],
            'purpose'                   => $data['purpose'],
            'justification'             => $data['justification'] ?? null,
            'status'                    => 'draft',
        ]);

        AuditLog::record('imprest.created', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'new_values'     => ['reference' => $imprest->reference_number, 'amount' => $imprest->amount_requested],
            'tags'           => 'imprest',
        ]);

        return $imprest->load('requester');
    }

    public function update(ImprestRequest $imprest, array $data, User $user): ImprestRequest
    {
        if (!$imprest->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $imprest->update(array_filter([
            'budget_line'               => $data['budget_line'] ?? null,
            'amount_requested'          => $data['amount_requested'] ?? null,
            'expected_liquidation_date' => $data['expected_liquidation_date'] ?? null,
            'purpose'                   => $data['purpose'] ?? null,
            'justification'             => $data['justification'] ?? null,
        ], fn($v) => $v !== null));

        AuditLog::record('imprest.updated', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'tags'           => 'imprest',
        ]);

        return $imprest->fresh('requester');
    }

    public function submit(ImprestRequest $imprest, User $user): ImprestRequest
    {
        if (!$imprest->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        $imprest->update(['status' => 'submitted', 'submitted_at' => now()]);

        // Notify Finance approvers, excluding the requester
        $approvers = User::role(['Finance Controller', 'Secretary General'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();
        $this->notificationService->dispatchToMany($approvers, 'imprest.submitted', [
            'reference' => $imprest->reference_number,
            'requester' => $user->name,
            'amount'    => number_format($imprest->amount_requested, 2) . ' ' . $imprest->currency,
        ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/' . $imprest->id]);

        AuditLog::record('imprest.submitted', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'tags'           => 'imprest',
        ]);

        return $imprest->fresh();
    }

    public function approve(ImprestRequest $imprest, array $data, User $approver): ImprestRequest
    {
        if (!$imprest->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        if ((int) $imprest->requester_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }

        $imprest->update([
            'status'          => 'approved',
            'approved_by'     => $approver->id,
            'amount_approved' => $data['amount_approved'] ?? $imprest->amount_requested,
            'approved_at'     => now(),
        ]);

        AuditLog::record('imprest.approved', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'tags'           => 'imprest',
        ]);

        $imprest->loadMissing('requester');
        if ($imprest->requester) {
            $this->notificationService->dispatch($imprest->requester, 'imprest.approved', [
                'name'      => $imprest->requester->name,
                'reference' => $imprest->reference_number,
                'amount'    => number_format($imprest->amount_approved ?? $imprest->amount_requested, 2) . ' ' . $imprest->currency,
            ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/' . $imprest->id]);
        }

        return $imprest->fresh();
    }

    public function reject(ImprestRequest $imprest, string $reason, User $approver): ImprestRequest
    {
        if (!$imprest->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $imprest->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('imprest.rejected', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'imprest',
        ]);

        $imprest->loadMissing('requester');
        if ($imprest->requester) {
            $this->notificationService->dispatch($imprest->requester, 'imprest.rejected', [
                'name'      => $imprest->requester->name,
                'reference' => $imprest->reference_number,
                'comment'   => $reason,
            ], ['module' => 'imprest', 'record_id' => $imprest->id, 'url' => '/imprest/' . $imprest->id]);
        }

        return $imprest->fresh();
    }

    public function retire(ImprestRequest $imprest, array $data, User $user): ImprestRequest
    {
        if (!$imprest->isApproved()) {
            throw ValidationException::withMessages(['status' => 'Only approved requests can be retired.']);
        }

        $imprest->update([
            'status'            => 'liquidated',
            'amount_liquidated' => $data['amount_liquidated'],
            'liquidated_at'     => now(),
            'justification'     => $data['notes'] ?? $imprest->justification,
        ]);

        AuditLog::record('imprest.liquidated', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id'   => $imprest->id,
            'new_values'     => ['amount_liquidated' => $data['amount_liquidated']],
            'tags'           => 'imprest',
        ]);

        return $imprest->fresh('requester');
    }
}
