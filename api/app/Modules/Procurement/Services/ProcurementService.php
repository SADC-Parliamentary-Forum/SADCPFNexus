<?php
namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowService;
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
        $query = ProcurementRequest::with(['requester', 'items', 'quotes'])
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

        if (!empty($data['quotes'])) {
            foreach ($data['quotes'] as $quote) {
                $request->quotes()->create($quote);
            }
        }

        AuditLog::record('procurement.created', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => ['reference' => $request->reference_number, 'title' => $request->title],
            'tags'           => 'procurement',
        ]);

        return $request->load(['requester', 'items', 'quotes']);
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

        return $request->fresh(['requester', 'items', 'quotes']);
    }

    public function submit(ProcurementRequest $request, User $user): ProcurementRequest
    {
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

    public function approve(ProcurementRequest $request, User $approver): ProcurementRequest
    {
        if (!$request->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
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
}
