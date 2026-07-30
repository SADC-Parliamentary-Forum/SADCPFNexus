<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalStep;

/**
 * Declarative, versioned condition evaluation (PRD §36–§39).
 * Conditions are JSON expressions snapshotted onto the definition version /
 * approval request — never free-form executable code from modules.
 */
class ConditionEvaluationService
{
    /**
     * Expression shape:
     * {
     *   "all": [ { "field": "amount", "op": "gte", "value": 5000 }, ... ],
     *   "any": [ ... ]
     * }
     * or a single predicate object.
     */
    public function evaluate(?array $expression, array $context): bool
    {
        if ($expression === null || $expression === []) {
            return true;
        }

        if (isset($expression['all']) || isset($expression['any'])) {
            $all = $expression['all'] ?? [];
            $any = $expression['any'] ?? [];

            $allOk = empty($all) || collect($all)->every(fn ($p) => $this->predicate($p, $context));
            $anyOk = empty($any) || collect($any)->contains(fn ($p) => $this->predicate($p, $context));

            if (! empty($all) && ! empty($any)) {
                return $allOk && $anyOk;
            }

            return ! empty($all) ? $allOk : $anyOk;
        }

        return $this->predicate($expression, $context);
    }

    public function stageApplies(ApprovalStep $step, array $context): bool
    {
        $expr = $step->condition_expression;
        if (! is_array($expr) || $expr === []) {
            return true;
        }

        $ok = $this->evaluate($expr, $context);
        if ($ok) {
            return true;
        }

        // If skip_if_condition_false, stage is not applicable (explicit skip, audited).
        return ! (bool) $step->skip_if_condition_false;
    }

    private function predicate(array $p, array $context): bool
    {
        $field = (string) ($p['field'] ?? '');
        $op = (string) ($p['op'] ?? 'eq');
        $expected = $p['value'] ?? null;
        $actual = data_get($context, $field);

        return match ($op) {
            'eq', '=' => $actual == $expected,
            'neq', '!=' => $actual != $expected,
            'gt', '>' => is_numeric($actual) && is_numeric($expected) && (float) $actual > (float) $expected,
            'gte', '>=' => is_numeric($actual) && is_numeric($expected) && (float) $actual >= (float) $expected,
            'lt', '<' => is_numeric($actual) && is_numeric($expected) && (float) $actual < (float) $expected,
            'lte', '<=' => is_numeric($actual) && is_numeric($expected) && (float) $actual <= (float) $expected,
            'in' => is_array($expected) && in_array($actual, $expected, false),
            'not_in' => is_array($expected) && ! in_array($actual, $expected, false),
            'truthy' => (bool) $actual,
            'falsy' => ! $actual,
            'exists' => $actual !== null && $actual !== '',
            default => false,
        };
    }
}
