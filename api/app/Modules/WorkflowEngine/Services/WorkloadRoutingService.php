<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\User;
use App\Models\WorkflowEngine\WorkflowTask;
use Illuminate\Support\Collection;

/**
 * Advanced workload routing among eligible actors (PRD §122).
 * Strategies: primary | queue_claim | workload | deterministic_fallback
 */
class WorkloadRoutingService
{
    /**
     * @param  User[]  $eligible
     * @return array{actors: User[], strategy: string, reason: string}
     */
    public function route(array $eligible, string $strategy, int $tenantId, array $context = []): array
    {
        $actors = array_values(array_filter($eligible));
        if ($actors === []) {
            return ['actors' => [], 'strategy' => $strategy, 'reason' => 'No eligible actors.'];
        }

        return match ($strategy) {
            'queue_claim' => [
                'actors' => [],
                'strategy' => 'queue_claim',
                'reason' => 'Assigned to queue for claim; no primary assignee until claimed.',
                'queue' => $context['queue'] ?? 'default',
            ],
            'workload' => $this->byWorkload($actors, $tenantId),
            'deterministic_fallback' => $this->deterministic($actors, $context),
            default => [
                'actors' => [$actors[0]],
                'strategy' => 'primary',
                'reason' => 'Primary eligible actor selected.',
            ],
        };
    }

    private function byWorkload(array $actors, int $tenantId): array
    {
        $ranked = collect($actors)->map(function (User $u) use ($tenantId) {
            $load = WorkflowTask::where('tenant_id', $tenantId)
                ->where('assigned_user_id', $u->id)
                ->where('status', 'awaiting')
                ->count();

            return ['user' => $u, 'load' => $load];
        })->sortBy('load')->values();

        $best = $ranked->first();

        return [
            'actors' => $best ? [$best['user']] : [],
            'strategy' => 'workload',
            'reason' => 'Selected eligible actor with lowest awaiting workload ('.$best['load'].').',
        ];
    }

    private function deterministic(array $actors, array $context): array
    {
        $key = (string) ($context['routing_key'] ?? $context['approval_request_id'] ?? '0');
        $idx = abs(crc32($key)) % count($actors);

        return [
            'actors' => [$actors[$idx]],
            'strategy' => 'deterministic_fallback',
            'reason' => 'Deterministic hash fallback among eligible actors.',
        ];
    }

    /**
     * For parallel-all / quorum: keep all eligible (no single-assignee collapse).
     *
     * @param  User[]  $eligible
     * @return User[]
     */
    public function keepAllForParallel(array $eligible): array
    {
        return array_values(array_filter($eligible));
    }
}
