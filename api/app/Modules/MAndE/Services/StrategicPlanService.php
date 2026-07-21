<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicOutcome;
use App\Models\StrategicOutput;
use App\Models\StrategicPlan;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StrategicPlanService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return StrategicPlan::query()
            ->where('tenant_id', $user->tenant_id)
            ->when(!empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(!empty($filters['search']), fn ($q) => $q->where('name', 'ilike', "%{$filters['search']}%"))
            ->withCount('goals')
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function get(StrategicPlan $plan): StrategicPlan
    {
        return $plan->load([
            'creator:id,name',
            'goals.objectives.outcomes.outputs',
        ]);
    }

    public function create(array $data, User $user): StrategicPlan
    {
        $plan = StrategicPlan::create([
            'tenant_id'   => $user->tenant_id,
            'name'        => $data['name'],
            'period'      => $data['period'] ?? null,
            'start_date'  => $data['start_date'] ?? null,
            'end_date'    => $data['end_date'] ?? null,
            'status'      => $data['status'] ?? 'draft',
            'description' => $data['description'] ?? null,
            'created_by'  => $user->id,
        ]);

        AuditLog::record('mande.strategic_plan.created', [
            'auditable_type' => StrategicPlan::class,
            'auditable_id'   => $plan->id,
            'new_values'     => ['name' => $plan->name, 'period' => $plan->period],
            'tags'           => 'mande',
        ]);

        return $plan;
    }

    public function update(StrategicPlan $plan, array $data, User $user): StrategicPlan
    {
        if ($plan->isArchived()) {
            throw ValidationException::withMessages(['status' => 'Archived plans cannot be edited.']);
        }

        $plan->update(array_filter([
            'name'        => $data['name'] ?? null,
            'period'      => $data['period'] ?? null,
            'start_date'  => $data['start_date'] ?? null,
            'end_date'    => $data['end_date'] ?? null,
            'status'      => $data['status'] ?? null,
            'description' => $data['description'] ?? null,
        ], fn ($v) => $v !== null));

        AuditLog::record('mande.strategic_plan.updated', [
            'auditable_type' => StrategicPlan::class,
            'auditable_id'   => $plan->id,
            'tags'           => 'mande',
        ]);

        return $plan->fresh();
    }

    /**
     * Archiving retains all child records (goals/objectives/etc.) and any
     * historical links from indicators / activity reports. Nothing is deleted.
     */
    public function archive(StrategicPlan $plan, User $user): StrategicPlan
    {
        $plan->update(['status' => 'archived']);

        AuditLog::record('mande.strategic_plan.archived', [
            'auditable_type' => StrategicPlan::class,
            'auditable_id'   => $plan->id,
            'tags'           => 'mande',
        ]);

        return $plan->fresh();
    }

    public function activate(StrategicPlan $plan, User $user): StrategicPlan
    {
        $plan->update(['status' => 'active']);

        AuditLog::record('mande.strategic_plan.activated', [
            'auditable_type' => StrategicPlan::class,
            'auditable_id'   => $plan->id,
            'tags'           => 'mande',
        ]);

        return $plan->fresh();
    }

    public function delete(StrategicPlan $plan, User $user): void
    {
        if (!$plan->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft plans can be deleted.']);
        }

        AuditLog::record('mande.strategic_plan.deleted', [
            'auditable_type' => StrategicPlan::class,
            'auditable_id'   => $plan->id,
            'tags'           => 'mande',
        ]);

        $plan->delete();
    }

    // ── Nested configuration (goals → objectives → outcomes → outputs) ──────────

    public function addGoal(StrategicPlan $plan, array $data, User $user): StrategicGoal
    {
        return $plan->goals()->create([
            'tenant_id'   => $plan->tenant_id,
            'code'        => $data['code'] ?? null,
            'title'       => $data['title'],
            'description' => $data['description'] ?? null,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);
    }

    public function addObjective(StrategicGoal $goal, array $data): StrategicObjective
    {
        return $goal->objectives()->create([
            'tenant_id'   => $goal->tenant_id,
            'code'        => $data['code'] ?? null,
            'title'       => $data['title'],
            'description' => $data['description'] ?? null,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);
    }

    public function addOutcome(StrategicObjective $objective, array $data): StrategicOutcome
    {
        return $objective->outcomes()->create([
            'tenant_id'   => $objective->tenant_id,
            'code'        => $data['code'] ?? null,
            'title'       => $data['title'],
            'description' => $data['description'] ?? null,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);
    }

    public function addOutput(StrategicOutcome $outcome, array $data): StrategicOutput
    {
        return $outcome->outputs()->create([
            'tenant_id'   => $outcome->tenant_id,
            'code'        => $data['code'] ?? null,
            'title'       => $data['title'],
            'description' => $data['description'] ?? null,
            'sort_order'  => $data['sort_order'] ?? 0,
        ]);
    }

    /**
     * Generic delete for a configuration node. Uses soft deletes so historical
     * links (e.g. an indicator that referenced the objective) are preserved.
     */
    public function deleteNode(string $type, int $id, User $user): void
    {
        $model = match ($type) {
            'goal'      => StrategicGoal::class,
            'objective' => StrategicObjective::class,
            'outcome'   => StrategicOutcome::class,
            'output'    => StrategicOutput::class,
            default     => throw ValidationException::withMessages(['type' => 'Invalid node type.']),
        };

        $node = $model::where('id', $id)->where('tenant_id', $user->tenant_id)->firstOrFail();
        $node->delete();
    }
}
