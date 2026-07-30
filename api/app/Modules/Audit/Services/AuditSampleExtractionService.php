<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditEngagement;
use App\Models\AuditSample;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuditSampleExtractionService
{
    /** @var array<string, string> */
    private const MODULE_TABLES = [
        'procurement' => 'procurement_requests',
        'travel' => 'travel_requests',
        'assets' => 'assets',
        'stock' => 'stock_items',
        'payroll' => 'payroll_runs',
    ];

    public function __construct(
        private readonly AuditEventRecorder $events,
        private readonly AuditAccessGate $gate,
    ) {}

    public function extractAndFreeze(AuditEngagement $engagement, array $data, User $user): AuditSample
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);

        $module = $data['source_module'] ?? 'manual';
        $population = array_values(array_map('intval', $data['population_ids'] ?? []));

        if ($population === [] && isset(self::MODULE_TABLES[$module])) {
            $population = $this->pullReadablePopulation(self::MODULE_TABLES[$module], $user->tenant_id);
        }

        if ($population === []) {
            throw ValidationException::withMessages([
                'population_ids' => 'Provide population_ids or a readable source_module with exportable rows.',
            ]);
        }

        sort($population);
        $sampleSize = (int) ($data['sample_size'] ?? min(5, count($population)));
        $method = $data['method'] ?? 'random';
        $sampleIds = $this->draw($population, $sampleSize, $method);

        $sample = AuditSample::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'method' => $method,
            'population_size' => count($population),
            'sample_size' => count($sampleIds),
            'population_description' => $data['population_description'] ?? null,
            'rationale' => $data['rationale'] ?? 'Automated extraction with frozen population',
            'source_table' => self::MODULE_TABLES[$module] ?? ($data['source_table'] ?? null),
            'source_module' => $module,
            'sample_ids' => $sampleIds,
            'frozen_population' => $population,
            'is_frozen' => true,
            'frozen_at' => now(),
            'population_hash' => hash('sha256', json_encode($population)),
            'created_by' => $user->id,
        ]);

        $this->events->record('audit.sample.frozen', $user, AuditSample::class, $sample->id, [
            'population_size' => count($population),
            'sample_size' => count($sampleIds),
            'source_module' => $module,
        ]);

        return $sample;
    }

    public function adjust(AuditSample $sample, array $data, User $user): AuditSample
    {
        $this->assertTenant($sample->tenant_id, $user);

        if (! $sample->is_frozen) {
            throw ValidationException::withMessages(['sample' => 'Only frozen samples require justified adjustment.']);
        }

        $justification = trim((string) ($data['justification'] ?? ''));
        if ($justification === '') {
            throw ValidationException::withMessages([
                'justification' => 'Adjustment of a frozen sample requires a written justification.',
            ]);
        }

        $newIds = array_values(array_map('intval', $data['sample_ids'] ?? []));
        $frozen = $sample->frozen_population ?? [];
        foreach ($newIds as $id) {
            if (! in_array($id, $frozen, true)) {
                throw ValidationException::withMessages([
                    'sample_ids' => "Sample id {$id} is outside the frozen population.",
                ]);
            }
        }

        $sample->update([
            'adjusted_from_sample_ids' => $sample->sample_ids,
            'sample_ids' => $newIds,
            'sample_size' => count($newIds),
            'adjustment_justification' => $justification,
            'adjusted_by' => $user->id,
            'adjusted_at' => now(),
        ]);

        $this->events->record('audit.sample.adjusted', $user, AuditSample::class, $sample->id, [
            'justification' => $justification,
        ]);

        return $sample->fresh();
    }

    /**
     * @return list<int>
     */
    private function pullReadablePopulation(string $table, int $tenantId): array
    {
        if (! Schema::hasTable($table)) {
            return [];
        }

        $q = \DB::table($table);
        if (Schema::hasColumn($table, 'tenant_id')) {
            $q->where('tenant_id', $tenantId);
        }
        if (Schema::hasColumn($table, 'deleted_at')) {
            $q->whereNull('deleted_at');
        }

        return $q->orderBy('id')->limit(500)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * @param  list<int>  $population
     * @return list<int>
     */
    private function draw(array $population, int $sampleSize, string $method): array
    {
        $sampleSize = max(0, min($sampleSize, count($population)));
        if ($sampleSize === 0) {
            return [];
        }
        if ($method === 'full_population' || $sampleSize >= count($population)) {
            return $population;
        }
        if ($method === 'systematic') {
            $step = (int) max(1, floor(count($population) / $sampleSize));
            $out = [];
            for ($i = 0; $i < count($population) && count($out) < $sampleSize; $i += $step) {
                $out[] = $population[$i];
            }

            return $out;
        }

        $keys = array_rand($population, $sampleSize);
        if (! is_array($keys)) {
            $keys = [$keys];
        }
        $picked = array_map(fn ($k) => $population[$k], $keys);
        sort($picked);

        return $picked;
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
