<?php

namespace App\Modules\Budget\Services;

use App\Models\Budget;
use App\Models\BudgetChangeItem;
use App\Models\BudgetChangeRequest;
use App\Models\BudgetControlSetting;
use App\Models\BudgetLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetChangeRequestService
{
    public function list(int $tenantId, array $filters = [])
    {
        return BudgetChangeRequest::query()
            ->with(['items', 'preparer', 'budget'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['type']), fn ($q) => $q->where('type', $filters['type']))
            ->when(! empty($filters['budget_id']), fn ($q) => $q->where('budget_id', $filters['budget_id']))
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 50);
    }

    public function create(array $data, User $actor): BudgetChangeRequest
    {
        $budget = Budget::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereKey($data['budget_id'])
            ->firstOrFail();

        if ($budget->status !== 'active') {
            throw ValidationException::withMessages([
                'budget_id' => 'Change requests require an active institutional budget.',
            ]);
        }

        return DB::transaction(function () use ($data, $actor, $budget) {
            $request = BudgetChangeRequest::create([
                'tenant_id' => $actor->tenant_id,
                'financial_year_id' => $budget->financial_year_id,
                'budget_id' => $budget->id,
                'type' => $data['type'],
                'title' => $data['title'],
                'status' => BudgetChangeRequest::STATUS_DRAFT,
                'justification' => $data['justification'] ?? null,
                'requires_sg' => false,
                'prepared_by' => $actor->id,
            ]);

            foreach ($data['items'] ?? [] as $i => $item) {
                $this->createItem($request, $item, $i);
            }

            $request->update(['requires_sg' => $this->computeRequiresSg($request->fresh(['items']))]);

            return $request->fresh(['items', 'preparer', 'budget']);
        });
    }

    public function update(BudgetChangeRequest $request, array $data, User $actor): BudgetChangeRequest
    {
        $this->assertTenant($request, $actor);
        $this->assertEditable($request);

        return DB::transaction(function () use ($request, $data) {
            $request->update([
                'title' => $data['title'] ?? $request->title,
                'justification' => array_key_exists('justification', $data) ? $data['justification'] : $request->justification,
                'type' => $data['type'] ?? $request->type,
            ]);

            if (array_key_exists('items', $data)) {
                $request->items()->delete();
                foreach ($data['items'] as $i => $item) {
                    $this->createItem($request, $item, $i);
                }
            }

            $request->update(['requires_sg' => $this->computeRequiresSg($request->fresh(['items']))]);

            return $request->fresh(['items', 'preparer', 'budget']);
        });
    }

    public function submit(BudgetChangeRequest $request, User $actor): BudgetChangeRequest
    {
        $this->assertTenant($request, $actor);

        if (! in_array($request->status, [
            BudgetChangeRequest::STATUS_DRAFT,
            BudgetChangeRequest::STATUS_RETURNED,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft/returned requests can be submitted.']);
        }

        if ($request->items()->count() === 0) {
            throw ValidationException::withMessages(['items' => 'Add at least one change item.']);
        }

        $this->validateItemsForType($request->fresh(['items']));

        $request->update([
            'status' => BudgetChangeRequest::STATUS_PENDING_FINANCE,
            'submitted_at' => now(),
            'requires_sg' => $this->computeRequiresSg($request),
            'rejected_reason' => null,
        ]);

        return $request->fresh(['items']);
    }

    public function financeDecide(BudgetChangeRequest $request, string $decision, User $actor, ?string $comments = null): BudgetChangeRequest
    {
        $this->assertFinance($actor);
        $this->assertTenant($request, $actor);

        if ($request->status !== BudgetChangeRequest::STATUS_PENDING_FINANCE) {
            throw ValidationException::withMessages(['status' => 'Finance decision requires pending_finance.']);
        }

        if ($decision === 'return') {
            $request->update([
                'status' => BudgetChangeRequest::STATUS_RETURNED,
                'finance_decided_by' => $actor->id,
                'finance_decided_at' => now(),
                'finance_comments' => $comments,
            ]);

            return $request->fresh(['items']);
        }

        if ($decision === 'reject') {
            $request->update([
                'status' => BudgetChangeRequest::STATUS_REJECTED,
                'finance_decided_by' => $actor->id,
                'finance_decided_at' => now(),
                'finance_comments' => $comments,
                'rejected_reason' => $comments ?? 'Rejected by Finance',
            ]);

            return $request->fresh(['items']);
        }

        if ($decision !== 'approve') {
            throw ValidationException::withMessages(['decision' => 'Invalid decision.']);
        }

        $next = $request->requires_sg
            ? BudgetChangeRequest::STATUS_PENDING_SG
            : BudgetChangeRequest::STATUS_APPROVED;

        $request->update([
            'status' => $next,
            'finance_decided_by' => $actor->id,
            'finance_decided_at' => now(),
            'finance_comments' => $comments,
        ]);

        return $request->fresh(['items']);
    }

    public function sgDecide(BudgetChangeRequest $request, string $decision, User $actor, ?string $comments = null): BudgetChangeRequest
    {
        $this->assertTenant($request, $actor);

        if (! $actor->hasRole('Secretary General') && ! $actor->can('finance.admin') && ! $actor->isSystemAdmin()) {
            abort(403);
        }

        if ($request->status !== BudgetChangeRequest::STATUS_PENDING_SG) {
            throw ValidationException::withMessages(['status' => 'SG decision requires pending_sg.']);
        }

        if ($decision === 'return') {
            $request->update([
                'status' => BudgetChangeRequest::STATUS_RETURNED,
                'sg_decided_by' => $actor->id,
                'sg_decided_at' => now(),
                'sg_comments' => $comments,
            ]);

            return $request->fresh(['items']);
        }

        if ($decision === 'reject') {
            $request->update([
                'status' => BudgetChangeRequest::STATUS_REJECTED,
                'sg_decided_by' => $actor->id,
                'sg_decided_at' => now(),
                'sg_comments' => $comments,
                'rejected_reason' => $comments ?? 'Rejected by SG',
            ]);

            return $request->fresh(['items']);
        }

        if ($decision !== 'approve') {
            throw ValidationException::withMessages(['decision' => 'Invalid decision.']);
        }

        $request->update([
            'status' => BudgetChangeRequest::STATUS_APPROVED,
            'sg_decided_by' => $actor->id,
            'sg_decided_at' => now(),
            'sg_comments' => $comments,
        ]);

        return $request->fresh(['items']);
    }

    public function computeRequiresSg(BudgetChangeRequest $request): bool
    {
        if (in_array($request->type, [
            BudgetChangeRequest::TYPE_SUPPLEMENTARY,
            BudgetChangeRequest::TYPE_CONTINGENCY,
        ], true)) {
            return true;
        }

        if ($request->type === BudgetChangeRequest::TYPE_TRANSFER) {
            return false;
        }

        // revision — any item over ceiling % of original
        $settings = BudgetControlSetting::forTenant((int) $request->tenant_id);
        $ceiling = (float) ($settings->revision_finance_ceiling_pct ?? 10);

        foreach ($request->items as $item) {
            if (! $item->target_budget_line_id) {
                continue;
            }
            $line = BudgetLine::find($item->target_budget_line_id);
            if (! $line) {
                continue;
            }
            $base = (float) ($line->original_allocation ?? $line->amount_allocated ?? 0);
            if ($base <= 0) {
                return true;
            }
            $pct = (abs((float) $item->amount) / $base) * 100;
            if ($pct > $ceiling + 1e-9) {
                return true;
            }
        }

        return false;
    }

    private function createItem(BudgetChangeRequest $request, array $item, int $sortOrder): BudgetChangeItem
    {
        $amount = abs((float) ($item['amount'] ?? 0));
        if ($amount < 0.01) {
            throw ValidationException::withMessages(['items' => 'Each item needs a positive amount.']);
        }

        return BudgetChangeItem::create([
            'budget_change_request_id' => $request->id,
            'source_budget_line_id' => $item['source_budget_line_id'] ?? null,
            'target_budget_line_id' => $item['target_budget_line_id'] ?? null,
            'new_line_code' => $item['new_line_code'] ?? null,
            'new_line_name' => $item['new_line_name'] ?? null,
            'new_line_category' => $item['new_line_category'] ?? null,
            'new_line_funding_source_id' => $item['new_line_funding_source_id'] ?? null,
            'amount' => $amount,
            'is_decrease' => (bool) ($item['is_decrease'] ?? false),
            'notes' => $item['notes'] ?? null,
            'sort_order' => $item['sort_order'] ?? $sortOrder,
        ]);
    }

    private function validateItemsForType(BudgetChangeRequest $request): void
    {
        foreach ($request->items as $item) {
            match ($request->type) {
                BudgetChangeRequest::TYPE_TRANSFER,
                BudgetChangeRequest::TYPE_CONTINGENCY => $this->assertSourceAndTarget($item, $request->type),
                BudgetChangeRequest::TYPE_REVISION => $this->assertRevisionItem($item),
                BudgetChangeRequest::TYPE_SUPPLEMENTARY => $this->assertSupplementaryItem($item),
                default => null,
            };
        }
    }

    private function assertSourceAndTarget(BudgetChangeItem $item, string $type): void
    {
        if (! $item->source_budget_line_id || ! $item->target_budget_line_id) {
            throw ValidationException::withMessages([
                'items' => ucfirst($type).' items need source and target budget lines.',
            ]);
        }
        if ((int) $item->source_budget_line_id === (int) $item->target_budget_line_id) {
            throw ValidationException::withMessages(['items' => 'Source and target must differ.']);
        }
        if ($type === BudgetChangeRequest::TYPE_CONTINGENCY) {
            $source = BudgetLine::find($item->source_budget_line_id);
            if (! $source?->is_contingency) {
                throw ValidationException::withMessages([
                    'items' => 'Contingency draws must use a contingency-flagged source line.',
                ]);
            }
        }
    }

    private function assertRevisionItem(BudgetChangeItem $item): void
    {
        if (! $item->target_budget_line_id) {
            throw ValidationException::withMessages(['items' => 'Revision items need a target line.']);
        }
    }

    private function assertSupplementaryItem(BudgetChangeItem $item): void
    {
        $hasTarget = (bool) $item->target_budget_line_id;
        $hasNew = filled($item->new_line_name);
        if (! $hasTarget && ! $hasNew) {
            throw ValidationException::withMessages([
                'items' => 'Supplementary items need a target line or a new line name.',
            ]);
        }
    }

    private function assertEditable(BudgetChangeRequest $request): void
    {
        if (! in_array($request->status, [
            BudgetChangeRequest::STATUS_DRAFT,
            BudgetChangeRequest::STATUS_RETURNED,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft/returned requests can be edited.']);
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

    private function assertTenant(BudgetChangeRequest $request, User $actor): void
    {
        if ((int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
