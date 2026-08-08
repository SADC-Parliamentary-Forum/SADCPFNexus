<?php

namespace App\Modules\WorkflowEngine\Services;

/**
 * Automated definition linting — hard failures block publish (PRD §114 / §122).
 */
class DefinitionLintService
{
    /**
     * @return array{hard: string[], soft: string[], valid: bool}
     */
    public function lint(array $stages, array $transitions = []): array
    {
        $hard = [];
        $soft = [];

        if ($stages === []) {
            $hard[] = 'Workflow must have at least one stage.';

            return ['hard' => $hard, 'soft' => $soft, 'valid' => false];
        }

        $orders = [];
        $hasTerminal = false;
        $hasFinalTransition = false;

        foreach ($stages as $stage) {
            $order = $stage['step_order'] ?? null;
            if ($order === null) {
                $hard[] = 'Every stage needs step_order.';
            } elseif (in_array($order, $orders, true)) {
                $hard[] = "Duplicate step_order {$order}.";
            } else {
                $orders[] = $order;
            }

            if (empty($stage['actor_selector']) && empty($stage['approver_type']) && empty($stage['governance_body_name'])) {
                $hard[] = "Stage {$order} is missing an actor selector.";
            }
            if (empty($stage['stage_type'])) {
                $hard[] = "Stage {$order} is missing stage_type.";
            }
            if (in_array($stage['stage_type'] ?? '', ['approve', 'authorise', 'sign', 'release', 'accept'], true)) {
                $hasTerminal = true;
            }

            $rule = $stage['completion_rule'] ?? 'any';
            $isParallel = in_array($rule, ['all', 'quorum', 'percentage', 'lead_plus_support'], true)
                || ! empty($stage['parallel_group']);
            if ($isParallel && empty($stage['completion_rule'])) {
                $hard[] = "Parallel stage {$order} is missing a completion rule.";
            }
            if (($rule === 'quorum') && empty($stage['quorum_count'])) {
                $hard[] = "Quorum stage {$order} requires quorum_count (N-of-M).";
            }
            if (($rule === 'percentage') && empty($stage['quorum_percentage'])) {
                $hard[] = "Percentage quorum stage {$order} requires quorum_percentage.";
            }

            // Self-approval vulnerability: specific_user with no SoD hint
            if (($stage['actor_selector'] ?? $stage['approver_type'] ?? '') === 'specific_user'
                && empty($stage['sod_segregated'])
                && ($stage['stage_type'] ?? '') === 'approve') {
                $soft[] = "Stage {$order} uses specific_user for approve — ensure SoD prevents applicant self-approval.";
            }
        }

        if (! $hasTerminal) {
            $hard[] = 'Workflow must include a terminal approve/authorise/sign/release stage (no final state).';
        }

        // Transition graph checks
        if ($transitions !== []) {
            $fromSet = collect($transitions)->pluck('from')->unique()->all();
            $toSet = collect($transitions)->pluck('to')->unique()->all();
            foreach ($orders as $order) {
                if (! in_array($order, $fromSet, true) && ! in_array($order, $toSet, true) && count($orders) > 1) {
                    $hard[] = "Unreachable or disconnected stage {$order} (missing transitions).";
                }
            }
            foreach ($transitions as $t) {
                if (($t['to'] ?? null) === 'completed' || ($t['to'] ?? null) === 'rejected') {
                    $hasFinalTransition = true;
                }
                if (($t['from'] ?? null) !== null && ($t['to'] ?? null) === ($t['from'] ?? null) && ($t['on'] ?? '') === 'approve') {
                    $hard[] = "Loop detected: stage {$t['from']} transitions to itself on approve.";
                }
            }
            if (! $hasFinalTransition) {
                $hard[] = 'Missing transition to a final state (completed/rejected).';
            }

            // Simple cycle detection on approve edges among numeric stages
            $graph = [];
            foreach ($transitions as $t) {
                if (($t['on'] ?? '') !== 'approve') {
                    continue;
                }
                if (! is_numeric($t['from'] ?? null) || ! is_numeric($t['to'] ?? null)) {
                    continue;
                }
                $graph[(int) $t['from']][] = (int) $t['to'];
            }
            if ($this->hasCycle($graph)) {
                $hard[] = 'Approve transition graph contains a cycle (infinite loop).';
            }
        } else {
            // Linear default — still require ordered stages without gaps for soft
            sort($orders);
            for ($i = 1; $i < count($orders); $i++) {
                if ($orders[$i] !== $orders[$i - 1] + 1 && $orders[$i] !== $orders[$i - 1]) {
                    $soft[] = 'Stage orders are non-contiguous; ensure transitions cover gaps.';
                }
            }
        }

        return [
            'hard' => array_values(array_unique($hard)),
            'soft' => array_values(array_unique($soft)),
            'valid' => $hard === [],
        ];
    }

    private function hasCycle(array $graph): bool
    {
        $visited = [];
        $stack = [];
        $dfs = function (int $node) use (&$dfs, &$visited, &$stack, $graph): bool {
            $visited[$node] = true;
            $stack[$node] = true;
            foreach ($graph[$node] ?? [] as $next) {
                if (! isset($visited[$next])) {
                    if ($dfs($next)) {
                        return true;
                    }
                } elseif (! empty($stack[$next])) {
                    return true;
                }
            }
            $stack[$node] = false;

            return false;
        };
        foreach (array_keys($graph) as $node) {
            if (! isset($visited[$node]) && $dfs((int) $node)) {
                return true;
            }
        }

        return false;
    }
}
