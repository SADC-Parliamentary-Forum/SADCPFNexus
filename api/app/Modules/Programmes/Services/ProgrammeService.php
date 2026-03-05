<?php
namespace App\Modules\Programmes\Services;

use App\Models\AuditLog;
use App\Models\Programme;
use App\Models\ProgrammeActivity;
use App\Models\ProgrammeBudgetLine;
use App\Models\ProgrammeDeliverable;
use App\Models\ProgrammeMilestone;
use App\Models\ProgrammeProcurementItem;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class ProgrammeService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Programme::with(['creator', 'approver', 'budgetLines'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('created_by', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('reference_number', 'ilike', "%{$filters['search']}%")
                  ->orWhere('title', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function get(Programme $programme): Programme
    {
        return $programme->load([
            'creator', 'approver',
            'activities', 'milestones', 'deliverables',
            'budgetLines', 'procurementItems',
        ]);
    }

    public function create(array $data, User $user): Programme
    {
        $year = now()->year;
        $count = Programme::whereYear('created_at', $year)->count() + 1;
        $ref = 'PIF-' . $year . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);

        $programme = Programme::create([
            'tenant_id'               => $user->tenant_id,
            'created_by'              => $user->id,
            'reference_number'        => $ref,
            'status'                  => 'draft',
            'title'                   => $data['title'],
            'strategic_alignment'     => $data['strategic_alignment'] ?? null,
            'strategic_pillar'        => $data['strategic_pillar'] ?? null,
            'implementing_department' => $data['implementing_department'] ?? null,
            'supporting_departments'  => $data['supporting_departments'] ?? null,
            'background'              => $data['background'] ?? null,
            'overall_objective'       => $data['overall_objective'] ?? null,
            'specific_objectives'     => $data['specific_objectives'] ?? null,
            'expected_outputs'        => $data['expected_outputs'] ?? null,
            'target_beneficiaries'    => $data['target_beneficiaries'] ?? null,
            'gender_considerations'   => $data['gender_considerations'] ?? null,
            'primary_currency'        => $data['primary_currency'] ?? 'USD',
            'base_currency'           => $data['base_currency'] ?? 'USD',
            'exchange_rate'           => $data['exchange_rate'] ?? 1,
            'contingency_pct'         => $data['contingency_pct'] ?? 10,
            'total_budget'            => $data['total_budget'] ?? 0,
            'funding_source'          => $data['funding_source'] ?? null,
            'responsible_officer'     => $data['responsible_officer'] ?? null,
            'start_date'              => $data['start_date'] ?? null,
            'end_date'                => $data['end_date'] ?? null,
            'travel_required'         => $data['travel_required'] ?? false,
            'delegates_count'         => $data['delegates_count'] ?? null,
            'member_states'           => $data['member_states'] ?? null,
            'travel_services'         => $data['travel_services'] ?? null,
            'procurement_required'    => $data['procurement_required'] ?? false,
            'media_options'           => $data['media_options'] ?? null,
        ]);

        $this->syncSubRecords($programme, $data);

        AuditLog::record('programme.created', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['reference' => $programme->reference_number, 'title' => $programme->title],
            'tags'           => 'programme',
        ]);

        return $this->get($programme);
    }

    public function update(Programme $programme, array $data, User $user): Programme
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be edited.']);
        }

        $programme->update(array_filter([
            'title'                   => $data['title'] ?? null,
            'strategic_alignment'     => $data['strategic_alignment'] ?? null,
            'strategic_pillar'        => $data['strategic_pillar'] ?? null,
            'implementing_department' => $data['implementing_department'] ?? null,
            'supporting_departments'  => $data['supporting_departments'] ?? null,
            'background'              => $data['background'] ?? null,
            'overall_objective'       => $data['overall_objective'] ?? null,
            'specific_objectives'     => $data['specific_objectives'] ?? null,
            'expected_outputs'        => $data['expected_outputs'] ?? null,
            'target_beneficiaries'    => $data['target_beneficiaries'] ?? null,
            'gender_considerations'   => $data['gender_considerations'] ?? null,
            'primary_currency'        => $data['primary_currency'] ?? null,
            'base_currency'           => $data['base_currency'] ?? null,
            'exchange_rate'           => $data['exchange_rate'] ?? null,
            'contingency_pct'         => $data['contingency_pct'] ?? null,
            'total_budget'            => $data['total_budget'] ?? null,
            'funding_source'          => $data['funding_source'] ?? null,
            'responsible_officer'     => $data['responsible_officer'] ?? null,
            'start_date'              => $data['start_date'] ?? null,
            'end_date'                => $data['end_date'] ?? null,
            'travel_required'         => $data['travel_required'] ?? null,
            'delegates_count'         => $data['delegates_count'] ?? null,
            'member_states'           => $data['member_states'] ?? null,
            'travel_services'         => $data['travel_services'] ?? null,
            'procurement_required'    => $data['procurement_required'] ?? null,
            'media_options'           => $data['media_options'] ?? null,
        ], fn($v) => $v !== null));

        AuditLog::record('programme.updated', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        return $this->get($programme->fresh());
    }

    public function submit(Programme $programme, User $user): Programme
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be submitted.']);
        }

        $programme->update(['status' => 'submitted', 'submitted_at' => now()]);

        AuditLog::record('programme.submitted', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
    }

    public function approve(Programme $programme, User $approver): Programme
    {
        if (!$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be approved.']);
        }

        $programme->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('programme.approved', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'tags'           => 'programme',
        ]);

        return $programme->fresh(['creator', 'approver']);
    }

    public function reject(Programme $programme, string $reason, User $approver): Programme
    {
        if (!$programme->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted programmes can be rejected.']);
        }

        $programme->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('programme.rejected', [
            'auditable_type' => Programme::class,
            'auditable_id'   => $programme->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'programme',
        ]);

        return $programme->fresh();
    }

    public function delete(Programme $programme): void
    {
        if (!$programme->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft programmes can be deleted.']);
        }
        $programme->delete();
    }

    // --- Sub-resource: Activities ---

    public function addActivity(Programme $programme, array $data): ProgrammeActivity
    {
        return $programme->activities()->create($data);
    }

    public function updateActivity(ProgrammeActivity $activity, array $data): ProgrammeActivity
    {
        $activity->update($data);
        return $activity->fresh();
    }

    public function deleteActivity(ProgrammeActivity $activity): void
    {
        $activity->delete();
    }

    // --- Sub-resource: Milestones ---

    public function addMilestone(Programme $programme, array $data): ProgrammeMilestone
    {
        return $programme->milestones()->create($data);
    }

    public function updateMilestone(ProgrammeMilestone $milestone, array $data): ProgrammeMilestone
    {
        $milestone->update($data);
        return $milestone->fresh();
    }

    public function deleteMilestone(ProgrammeMilestone $milestone): void
    {
        $milestone->delete();
    }

    // --- Sub-resource: Deliverables ---

    public function addDeliverable(Programme $programme, array $data): ProgrammeDeliverable
    {
        return $programme->deliverables()->create($data);
    }

    public function updateDeliverable(ProgrammeDeliverable $deliverable, array $data): ProgrammeDeliverable
    {
        $deliverable->update($data);
        return $deliverable->fresh();
    }

    public function deleteDeliverable(ProgrammeDeliverable $deliverable): void
    {
        $deliverable->delete();
    }

    // --- Sub-resource: Budget Lines ---

    public function addBudgetLine(Programme $programme, array $data): ProgrammeBudgetLine
    {
        return $programme->budgetLines()->create($data);
    }

    public function updateBudgetLine(ProgrammeBudgetLine $line, array $data): ProgrammeBudgetLine
    {
        $line->update($data);
        return $line->fresh();
    }

    public function deleteBudgetLine(ProgrammeBudgetLine $line): void
    {
        $line->delete();
    }

    // --- Sub-resource: Procurement Items ---

    public function addProcurementItem(Programme $programme, array $data): ProgrammeProcurementItem
    {
        return $programme->procurementItems()->create($data);
    }

    public function updateProcurementItem(ProgrammeProcurementItem $item, array $data): ProgrammeProcurementItem
    {
        $item->update($data);
        return $item->fresh();
    }

    public function deleteProcurementItem(ProgrammeProcurementItem $item): void
    {
        $item->delete();
    }

    // --- Private helpers ---

    private function syncSubRecords(Programme $programme, array $data): void
    {
        if (!empty($data['activities'])) {
            foreach ($data['activities'] as $row) {
                $programme->activities()->create($row);
            }
        }
        if (!empty($data['milestones'])) {
            foreach ($data['milestones'] as $row) {
                $programme->milestones()->create($row);
            }
        }
        if (!empty($data['deliverables'])) {
            foreach ($data['deliverables'] as $row) {
                $programme->deliverables()->create($row);
            }
        }
        if (!empty($data['budget_lines'])) {
            foreach ($data['budget_lines'] as $row) {
                $programme->budgetLines()->create($row);
            }
        }
        if (!empty($data['procurement_items'])) {
            foreach ($data['procurement_items'] as $row) {
                $programme->procurementItems()->create($row);
            }
        }
    }
}
