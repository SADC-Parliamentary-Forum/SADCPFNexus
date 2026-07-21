<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\Indicator;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class IndicatorService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return Indicator::query()
            ->where('tenant_id', $user->tenant_id)
            ->when(isset($filters['result_level']), fn ($q) => $q->where('result_level', $filters['result_level']))
            ->when(isset($filters['results_framework_id']), fn ($q) => $q->where('results_framework_id', $filters['results_framework_id']))
            ->when(isset($filters['programme_id']), fn ($q) => $q->where('programme_id', $filters['programme_id']))
            ->when(array_key_exists('is_active', $filters) && $filters['is_active'] !== null && $filters['is_active'] !== '',
                fn ($q) => $q->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN)))
            ->when(!empty($filters['search']), function ($q) use ($filters) {
                $q->where(function ($qq) use ($filters) {
                    $qq->where('name', 'ilike', "%{$filters['search']}%")
                       ->orWhere('code', 'ilike', "%{$filters['search']}%");
                });
            })
            ->with(['framework:id,name', 'objective:id,title', 'responsiblePerson:id,name'])
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 25);
    }

    public function get(Indicator $indicator): Indicator
    {
        return $indicator->load([
            'framework:id,name', 'objective:id,title', 'output:id,title',
            'programme:id,title,reference_number', 'responsiblePerson:id,name',
        ]);
    }

    public function create(array $data, User $user): Indicator
    {
        $indicator = Indicator::create(array_merge(
            $this->fillable($data),
            [
                'tenant_id'  => $user->tenant_id,
                'code'       => $data['code'] ?? ('IND-' . strtoupper(Str::random(6))),
                'created_by' => $user->id,
            ]
        ));

        AuditLog::record('mande.indicator.created', [
            'auditable_type' => Indicator::class,
            'auditable_id'   => $indicator->id,
            'new_values'     => ['code' => $indicator->code, 'name' => $indicator->name],
            'tags'           => 'mande',
        ]);

        return $indicator;
    }

    public function update(Indicator $indicator, array $data, User $user): Indicator
    {
        $indicator->update($this->fillable($data));

        AuditLog::record('mande.indicator.updated', [
            'auditable_type' => Indicator::class,
            'auditable_id'   => $indicator->id,
            'tags'           => 'mande',
        ]);

        return $indicator->fresh(['framework', 'objective', 'responsiblePerson']);
    }

    public function delete(Indicator $indicator, User $user): void
    {
        AuditLog::record('mande.indicator.deleted', [
            'auditable_type' => Indicator::class,
            'auditable_id'   => $indicator->id,
            'tags'           => 'mande',
        ]);

        $indicator->delete();
    }

    private function fillable(array $data): array
    {
        $keys = [
            'results_framework_id', 'strategic_objective_id', 'strategic_output_id', 'programme_id',
            'name', 'result_level', 'unit', 'baseline_value', 'baseline_year',
            'annual_target', 'cumulative_target', 'disaggregation', 'data_source',
            'evidence_required', 'frequency', 'responsible_person_id', 'is_active', 'description',
        ];

        $out = [];
        foreach ($keys as $k) {
            if (array_key_exists($k, $data)) {
                $out[$k] = $data[$k];
            }
        }
        return $out;
    }
}
