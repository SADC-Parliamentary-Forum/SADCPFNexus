<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetCycle;
use App\Models\BudgetSubmission;
use App\Models\BudgetSubmissionItem;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetSubmissionService
{
    public function __construct(
        private readonly WorkflowService $workflow,
    ) {}

    public function list(int $tenantId, array $filters = [])
    {
        return BudgetSubmission::query()
            ->with(['items', 'department', 'preparer', 'cycle.financialYear'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['budget_cycle_id']), fn ($q) => $q->where('budget_cycle_id', $filters['budget_cycle_id']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 50);
    }

    public function create(array $data, User $actor): BudgetSubmission
    {
        $cycle = BudgetCycle::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereKey($data['budget_cycle_id'])
            ->firstOrFail();

        if (! $cycle->allowsDepartmentEdits() && $cycle->status !== BudgetCycle::STATUS_DEPARTMENT_PREPARATION) {
            // Allow create while in department_preparation or planning after guidelines
            if (! in_array($cycle->status, [
                BudgetCycle::STATUS_PLANNING,
                BudgetCycle::STATUS_DEPARTMENT_PREPARATION,
            ], true)) {
                throw ValidationException::withMessages([
                    'budget_cycle_id' => 'Submissions can only be created while the cycle is open for department preparation.',
                ]);
            }
        }

        return DB::transaction(function () use ($data, $actor, $cycle) {
            $submission = BudgetSubmission::create([
                'tenant_id' => $actor->tenant_id,
                'budget_cycle_id' => $cycle->id,
                'department_id' => $data['department_id'] ?? $actor->department_id,
                'programme_id' => $data['programme_id'] ?? null,
                'type' => $data['type'] ?? 'department',
                'title' => $data['title'],
                'status' => BudgetSubmission::STATUS_DRAFT,
                'prepared_by' => $actor->id,
                'require_hod_approval' => (bool) ($data['require_hod_approval'] ?? false),
                'motivation' => $data['motivation'] ?? null,
            ]);

            foreach ($data['items'] ?? [] as $i => $item) {
                $this->createItem($submission, $item, $i);
            }

            return $submission->fresh(['items', 'department', 'preparer']);
        });
    }

    public function update(BudgetSubmission $submission, array $data, User $actor): BudgetSubmission
    {
        $this->assertTenant($submission, $actor);
        $this->assertEditable($submission);

        return DB::transaction(function () use ($submission, $data, $actor) {
            $submission->update([
                'department_id' => $data['department_id'] ?? $submission->department_id,
                'programme_id' => array_key_exists('programme_id', $data) ? $data['programme_id'] : $submission->programme_id,
                'type' => $data['type'] ?? $submission->type,
                'title' => $data['title'] ?? $submission->title,
                'require_hod_approval' => array_key_exists('require_hod_approval', $data)
                    ? (bool) $data['require_hod_approval']
                    : $submission->require_hod_approval,
                'motivation' => array_key_exists('motivation', $data) ? $data['motivation'] : $submission->motivation,
            ]);

            if (array_key_exists('items', $data)) {
                $submission->items()->delete();
                foreach ($data['items'] as $i => $item) {
                    $this->createItem($submission, $item, $i);
                }
            }

            return $submission->fresh(['items', 'department', 'preparer']);
        });
    }

    public function submit(BudgetSubmission $submission, User $actor): BudgetSubmission
    {
        $this->assertTenant($submission, $actor);

        if (! in_array($submission->status, [
            BudgetSubmission::STATUS_DRAFT,
            BudgetSubmission::STATUS_RETURNED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only draft or returned submissions can be submitted.',
            ]);
        }

        $cycle = $submission->cycle;
        if (! in_array($cycle->status, [
            BudgetCycle::STATUS_PLANNING,
            BudgetCycle::STATUS_DEPARTMENT_PREPARATION,
        ], true)) {
            throw ValidationException::withMessages([
                'cycle' => 'Cycle is not open for department submissions.',
            ]);
        }

        if ($submission->items()->count() === 0) {
            throw ValidationException::withMessages([
                'items' => 'Add at least one line item before submitting.',
            ]);
        }

        return DB::transaction(function () use ($submission, $actor) {
            $submission->update([
                'submitted_at' => now(),
                'returned_reason' => null,
            ]);

            if ($submission->require_hod_approval) {
                $approval = $this->workflow->initiate($submission, 'budget_submission', $actor);
                if ($approval) {
                    $submission->update([
                        'status' => BudgetSubmission::STATUS_PENDING_HOD,
                        'approval_request_id' => $approval->id,
                    ]);
                } else {
                    // No workflow configured — fall through to submitted
                    $submission->update(['status' => BudgetSubmission::STATUS_SUBMITTED]);
                }
            } else {
                $submission->update(['status' => BudgetSubmission::STATUS_SUBMITTED]);
            }

            $cycle = $submission->cycle()->first();
            if ($cycle && $cycle->status === BudgetCycle::STATUS_PLANNING) {
                $cycle->update(['status' => BudgetCycle::STATUS_DEPARTMENT_PREPARATION]);
            }

            return $submission->fresh(['items', 'department', 'preparer', 'approvalRequest']);
        });
    }

    public function accept(BudgetSubmission $submission, User $actor): BudgetSubmission
    {
        $this->assertFinance($actor);
        $this->assertTenant($submission, $actor);

        if ($submission->status !== BudgetSubmission::STATUS_SUBMITTED) {
            throw ValidationException::withMessages([
                'status' => 'Only submitted packs can be accepted.',
            ]);
        }

        $submission->update(['status' => BudgetSubmission::STATUS_ACCEPTED]);

        return $submission->fresh(['items']);
    }

    public function consolidate(BudgetSubmission $submission, User $actor): BudgetSubmission
    {
        $this->assertFinance($actor);
        $this->assertTenant($submission, $actor);

        if (! in_array($submission->status, [
            BudgetSubmission::STATUS_SUBMITTED,
            BudgetSubmission::STATUS_ACCEPTED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only submitted/accepted packs can be consolidated.',
            ]);
        }

        $submission->update(['status' => BudgetSubmission::STATUS_CONSOLIDATED]);

        return $submission->fresh(['items']);
    }

    public function returnToPreparer(BudgetSubmission $submission, User $actor, string $reason): BudgetSubmission
    {
        $this->assertFinance($actor);
        $this->assertTenant($submission, $actor);

        if (! in_array($submission->status, [
            BudgetSubmission::STATUS_SUBMITTED,
            BudgetSubmission::STATUS_ACCEPTED,
            BudgetSubmission::STATUS_PENDING_HOD,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'This pack cannot be returned in its current status.',
            ]);
        }

        $submission->update([
            'status' => BudgetSubmission::STATUS_RETURNED,
            'returned_reason' => $reason,
        ]);

        return $submission->fresh(['items']);
    }

    private function createItem(BudgetSubmission $submission, array $item, int $sortOrder): BudgetSubmissionItem
    {
        $qty = isset($item['quantity']) ? (float) $item['quantity'] : null;
        $rate = isset($item['unit_rate']) ? (float) $item['unit_rate'] : null;
        $calculated = ($qty !== null && $rate !== null) ? round($qty * $rate, 2) : ($item['calculated_amount'] ?? null);
        $requested = (float) ($item['requested_amount'] ?? $calculated ?? 0);

        if ($requested <= 0) {
            throw ValidationException::withMessages([
                'items' => 'Each item needs a positive requested_amount.',
            ]);
        }

        return BudgetSubmissionItem::create([
            'budget_submission_id' => $submission->id,
            'funding_source_id' => $item['funding_source_id'] ?? null,
            'category' => $item['category'] ?? null,
            'code' => $item['code'] ?? null,
            'name' => $item['name'],
            'description' => $item['description'] ?? null,
            'quantity' => $qty,
            'unit_rate' => $rate,
            'calculated_amount' => $calculated,
            'requested_amount' => $requested,
            'prior_year_amount' => $item['prior_year_amount'] ?? null,
            'justification' => $item['justification'] ?? null,
            'workplan_ref' => $item['workplan_ref'] ?? null,
            'sort_order' => $item['sort_order'] ?? $sortOrder,
        ]);
    }

    private function assertEditable(BudgetSubmission $submission): void
    {
        if (! in_array($submission->status, [
            BudgetSubmission::STATUS_DRAFT,
            BudgetSubmission::STATUS_RETURNED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only draft or returned submissions can be edited.',
            ]);
        }
    }

    private function assertFinance(User $actor): void
    {
        if (
            ! $actor->can('finance.create')
            && ! $actor->can('finance.admin')
            && ! $actor->hasRole('Finance Controller')
            && ! $actor->isSystemAdmin()
        ) {
            abort(403);
        }
    }

    private function assertTenant(BudgetSubmission $submission, User $actor): void
    {
        if ((int) $submission->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
