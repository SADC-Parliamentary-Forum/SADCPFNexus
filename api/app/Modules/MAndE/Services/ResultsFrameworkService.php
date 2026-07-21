<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\ResultsFramework;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ResultsFrameworkService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return ResultsFramework::query()
            ->where('tenant_id', $user->tenant_id)
            ->when(!empty($filters['type']), fn ($q) => $q->where('type', $filters['type']))
            ->when(!empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(!empty($filters['search']), fn ($q) => $q->where('name', 'ilike', "%{$filters['search']}%"))
            ->with(['plan:id,name', 'goal:id,title'])
            ->withCount('indicators')
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function get(ResultsFramework $framework): ResultsFramework
    {
        return $framework->load(['plan:id,name', 'goal:id,title', 'creator:id,name', 'indicators']);
    }

    public function create(array $data, User $user): ResultsFramework
    {
        $framework = ResultsFramework::create([
            'tenant_id'         => $user->tenant_id,
            'name'              => $data['name'],
            'type'              => $data['type'] ?? 'institutional',
            'donor_name'        => $data['donor_name'] ?? null,
            'description'       => $data['description'] ?? null,
            'strategic_plan_id' => $data['strategic_plan_id'] ?? null,
            'strategic_goal_id' => $data['strategic_goal_id'] ?? null,
            'start_date'        => $data['start_date'] ?? null,
            'end_date'          => $data['end_date'] ?? null,
            'status'            => $data['status'] ?? 'active',
            'created_by'        => $user->id,
        ]);

        AuditLog::record('mande.results_framework.created', [
            'auditable_type' => ResultsFramework::class,
            'auditable_id'   => $framework->id,
            'new_values'     => ['name' => $framework->name, 'type' => $framework->type],
            'tags'           => 'mande',
        ]);

        return $framework;
    }

    public function update(ResultsFramework $framework, array $data, User $user): ResultsFramework
    {
        $framework->update(array_filter([
            'name'              => $data['name'] ?? null,
            'type'              => $data['type'] ?? null,
            'donor_name'        => $data['donor_name'] ?? null,
            'description'       => $data['description'] ?? null,
            'strategic_plan_id' => array_key_exists('strategic_plan_id', $data) ? $data['strategic_plan_id'] : null,
            'strategic_goal_id' => array_key_exists('strategic_goal_id', $data) ? $data['strategic_goal_id'] : null,
            'start_date'        => $data['start_date'] ?? null,
            'end_date'          => $data['end_date'] ?? null,
            'status'            => $data['status'] ?? null,
        ], fn ($v) => $v !== null));

        AuditLog::record('mande.results_framework.updated', [
            'auditable_type' => ResultsFramework::class,
            'auditable_id'   => $framework->id,
            'tags'           => 'mande',
        ]);

        return $framework->fresh(['plan', 'goal']);
    }

    public function delete(ResultsFramework $framework, User $user): void
    {
        AuditLog::record('mande.results_framework.deleted', [
            'auditable_type' => ResultsFramework::class,
            'auditable_id'   => $framework->id,
            'tags'           => 'mande',
        ]);

        $framework->delete();
    }
}
