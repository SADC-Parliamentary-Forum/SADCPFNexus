<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalWorkflow;

/**
 * Module-centric dry-run catalog. Each business module has its own fields,
 * presets, and condition context — not a generic amount form.
 */
class WorkflowSimulationCatalog
{
    /**
     * @return array{modules: list<array<string, mixed>>}
     */
    public function forTenant(int $tenantId): array
    {
        $workflows = ApprovalWorkflow::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('module_type')
            ->orderBy('name')
            ->get(['id', 'name', 'module_type', 'record_type', 'self_approval_policy']);

        $modules = [];
        foreach ($workflows->groupBy('module_type') as $moduleType => $rows) {
            $schema = $this->schemaFor((string) $moduleType);
            $schema['workflows'] = $rows->map(fn (ApprovalWorkflow $wf) => [
                'id' => $wf->id,
                'name' => $wf->name,
                'record_type' => $wf->record_type,
                'self_approval_policy' => $wf->self_approval_policy,
            ])->values()->all();
            $modules[] = $schema;
        }

        return ['modules' => $modules];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function normalize(string $moduleType, array $input, ?string $scenarioKey = null): array
    {
        $schema = $this->schemaFor($moduleType);
        $base = [];
        if ($scenarioKey) {
            foreach ($schema['presets'] as $preset) {
                if (($preset['key'] ?? '') === $scenarioKey) {
                    $base = is_array($preset['context'] ?? null) ? $preset['context'] : [];
                    break;
                }
            }
        }

        $merged = array_merge($base, $input);
        $out = [];
        foreach ($schema['fields'] as $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '') {
                continue;
            }
            if (! array_key_exists($key, $merged) || $merged[$key] === '') {
                if (array_key_exists('default', $field)) {
                    $out[$key] = $this->coerce($field, $field['default']);
                }
                continue;
            }
            $out[$key] = $this->coerce($field, $merged[$key]);
        }

        foreach ($merged as $key => $value) {
            if (array_key_exists($key, $out)) {
                continue;
            }
            if (is_scalar($value) || is_bool($value) || $value === null) {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    public function scenarioLabelKey(string $moduleType, ?string $scenarioKey): ?string
    {
        if (! $scenarioKey) {
            return null;
        }
        foreach ($this->schemaFor($moduleType)['presets'] as $preset) {
            if (($preset['key'] ?? '') === $scenarioKey) {
                return $preset['label_key'] ?? null;
            }
        }

        return null;
    }

    /**
     * @return array{
     *     module_type: string,
     *     label_key: string,
     *     description_key: string,
     *     fields: list<array<string, mixed>>,
     *     presets: list<array<string, mixed>>,
     *     workflows?: list<array<string, mixed>>
     * }
     */
    public function schemaFor(string $moduleType): array
    {
        return match ($moduleType) {
            'leave' => $this->module('leave', [
                $this->select('leave_type', true, ['annual', 'sick', 'compassionate', 'study', 'unpaid', 'maternity', 'paternity']),
                $this->field('leave_days', 'number', true, ['default' => 2, 'min' => 0.5, 'step' => 0.5]),
                $this->field('is_emergency', 'boolean', false, ['default' => false]),
                $this->field('start_date', 'date'),
            ], [
                $this->preset('annual_standard', ['leave_type' => 'annual', 'leave_days' => 2, 'is_emergency' => false]),
                $this->preset('annual_extended', ['leave_type' => 'annual', 'leave_days' => 12, 'is_emergency' => false]),
                $this->preset('emergency_sick', ['leave_type' => 'sick', 'leave_days' => 3, 'is_emergency' => true]),
            ]),
            'travel' => $this->module('travel', [
                $this->field('destination_country', 'text', true, ['default' => 'Zimbabwe']),
                $this->field('travel_days', 'number', true, ['default' => 4, 'min' => 1]),
                $this->field('amount', 'number', true, ['default' => 8500]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->field('is_emergency', 'boolean', false, ['default' => false]),
            ], [
                $this->preset('regional_short', ['destination_country' => 'Zimbabwe', 'travel_days' => 3, 'amount' => 4200, 'currency' => 'NAD', 'is_emergency' => false]),
                $this->preset('high_cost_mission', ['destination_country' => 'Belgium', 'travel_days' => 8, 'amount' => 78000, 'currency' => 'NAD', 'is_emergency' => false]),
            ]),
            'procurement' => $this->module('procurement', [
                $this->field('amount', 'number', true, ['default' => 1200]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->select('procurement_method', true, ['rfq', 'tender', 'direct']),
                $this->field('is_emergency', 'boolean', false, ['default' => false]),
            ], [
                $this->preset('below_finance', ['amount' => 1200, 'currency' => 'NAD', 'procurement_method' => 'rfq', 'is_emergency' => false]),
                $this->preset('above_finance', ['amount' => 50000, 'currency' => 'NAD', 'procurement_method' => 'tender', 'is_emergency' => false]),
                $this->preset('emergency_direct', ['amount' => 250000, 'currency' => 'NAD', 'procurement_method' => 'direct', 'is_emergency' => true]),
            ]),
            'purchase_order' => $this->module('purchase_order', [
                $this->field('amount', 'number', true, ['default' => 18000]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->field('supplier_name', 'text'),
            ], [
                $this->preset('standard_lpo', ['amount' => 18000, 'currency' => 'NAD']),
                $this->preset('high_value_lpo', ['amount' => 120000, 'currency' => 'NAD']),
            ]),
            'imprest' => $this->module('imprest', [
                $this->field('amount', 'number', true, ['default' => 3500]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->field('purpose', 'text'),
            ], [
                $this->preset('workshop_float', ['amount' => 3500, 'currency' => 'NAD', 'purpose' => 'Workshop float']),
                $this->preset('large_mission_float', ['amount' => 25000, 'currency' => 'NAD', 'purpose' => 'Plenary mission float']),
            ]),
            'salary_advance' => $this->module('salary_advance', [
                $this->field('amount', 'number', true, ['default' => 4000]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->field('months_of_service', 'number', false, ['default' => 18]),
                $this->field('outstanding_balance', 'number', false, ['default' => 0]),
            ], [
                $this->preset('first_advance', ['amount' => 4000, 'months_of_service' => 18, 'outstanding_balance' => 0]),
                $this->preset('with_balance', ['amount' => 8000, 'months_of_service' => 36, 'outstanding_balance' => 2500]),
            ]),
            'finance' => $this->module('finance', [
                $this->field('amount', 'number', true, ['default' => 15000]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->select('payment_type', true, ['supplier', 'staff', 'transfer']),
            ], [
                $this->preset('supplier_payment', ['amount' => 15000, 'currency' => 'NAD', 'payment_type' => 'supplier']),
                $this->preset('high_value_transfer', ['amount' => 200000, 'currency' => 'NAD', 'payment_type' => 'transfer']),
            ]),
            'timesheet' => $this->module('timesheet', [
                $this->field('hours', 'number', true, ['default' => 40]),
                $this->field('is_donor_funded', 'boolean', true, ['default' => false]),
                $this->field('project_code', 'text'),
            ], [
                $this->preset('core_hours', ['hours' => 40, 'is_donor_funded' => false, 'project_code' => '']),
                $this->preset('donor_project', ['hours' => 40, 'is_donor_funded' => true, 'project_code' => 'SADC-PF-01']),
            ]),
            'correspondence' => $this->module('correspondence', [
                $this->select('classification', true, ['routine', 'confidential', 'restricted']),
                $this->field('is_outgoing', 'boolean', false, ['default' => true]),
                $this->select('urgency', false, ['normal', 'urgent']),
            ], [
                $this->preset('routine_outgoing', ['classification' => 'routine', 'is_outgoing' => true, 'urgency' => 'normal']),
                $this->preset('restricted_urgent', ['classification' => 'restricted', 'is_outgoing' => true, 'urgency' => 'urgent']),
            ]),
            'hr' => $this->module('hr', [
                $this->select('request_type', true, ['recruitment', 'acting', 'change', 'confirmation']),
                $this->field('is_emergency', 'boolean', false, ['default' => false]),
            ], [
                $this->preset('acting_cover', ['request_type' => 'acting', 'is_emergency' => false]),
                $this->preset('urgent_recruitment', ['request_type' => 'recruitment', 'is_emergency' => true]),
            ]),
            'governance' => $this->module('governance', [
                $this->select('body_type', true, ['exco', 'plenary', 'committee']),
                $this->field('requires_quorum', 'boolean', false, ['default' => true]),
            ], [
                $this->preset('committee_paper', ['body_type' => 'committee', 'requires_quorum' => true]),
                $this->preset('plenary_resolution', ['body_type' => 'plenary', 'requires_quorum' => true]),
            ]),
            'programmes' => $this->module('programmes', [
                $this->field('amount', 'number', true, ['default' => 45000]),
                $this->field('currency', 'text', false, ['default' => 'NAD']),
                $this->field('is_donor_funded', 'boolean', false, ['default' => false]),
                $this->field('programme_code', 'text'),
            ], [
                $this->preset('core_activity', ['amount' => 12000, 'currency' => 'NAD', 'is_donor_funded' => false, 'programme_code' => 'PIF-CORE']),
                $this->preset('donor_activity', ['amount' => 85000, 'currency' => 'NAD', 'is_donor_funded' => true, 'programme_code' => 'PIF-EU']),
            ]),
            'mande' => $this->module('mande', [
                $this->select('report_type', true, ['activity', 'quarterly', 'mission']),
                $this->field('has_evidence', 'boolean', false, ['default' => true]),
            ], [
                $this->preset('activity_with_evidence', ['report_type' => 'activity', 'has_evidence' => true]),
                $this->preset('quarterly_missing_evidence', ['report_type' => 'quarterly', 'has_evidence' => false]),
            ]),
            'risk' => $this->module('risk', [
                $this->select('severity', true, ['low', 'medium', 'high', 'critical']),
            ], [
                $this->preset('low_operational', ['severity' => 'low']),
                $this->preset('critical_escalation', ['severity' => 'critical']),
            ]),
            'supplier' => $this->module('supplier', [
                $this->field('country', 'text', false, ['default' => 'Namibia']),
                $this->field('has_tax_clearance', 'boolean', true, ['default' => true]),
            ], [
                $this->preset('complete_pack', ['country' => 'Namibia', 'has_tax_clearance' => true]),
                $this->preset('missing_tax', ['country' => 'Zambia', 'has_tax_clearance' => false]),
            ]),
            'weekly_report' => $this->module('weekly_report', [
                $this->field('week_ending', 'date'),
            ], [
                $this->preset('current_week', ['week_ending' => now()->endOfWeek()->toDateString()]),
            ]),
            'lifecycle_appointment_authorise', 'lifecycle_final_hr_clearance' => $this->module($moduleType, [
                $this->select('employee_type', true, ['professional', 'general', 'contract']),
            ], [
                $this->preset('professional', ['employee_type' => 'professional']),
                $this->preset('contract', ['employee_type' => 'contract']),
            ]),
            default => $this->module($moduleType, [
                $this->field('amount', 'number', false),
                $this->field('notes', 'text'),
            ], [
                $this->preset('standard', []),
            ]),
        };
    }

    /**
     * @param  list<array<string, mixed>>  $fields
     * @param  list<array<string, mixed>>  $presets
     * @return array<string, mixed>
     */
    private function module(string $moduleType, array $fields, array $presets): array
    {
        return [
            'module_type' => $moduleType,
            'label_key' => 'workflows.simulate.module.'.$moduleType,
            'description_key' => 'workflows.simulate.moduleHint.'.$moduleType,
            'fields' => $fields,
            'presets' => array_map(function (array $preset) use ($moduleType) {
                $preset['label_key'] = $preset['label_key'] ?? 'workflows.simulate.preset.'.$moduleType.'.'.$preset['key'];

                return $preset;
            }, $presets),
        ];
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function field(string $key, string $type, bool $required = false, array $extra = []): array
    {
        return array_merge([
            'key' => $key,
            'type' => $type,
            'required' => $required,
            'label_key' => 'workflows.simulate.field.'.$key,
        ], $extra);
    }

    /**
     * @param  list<string>  $values
     * @return array<string, mixed>
     */
    private function select(string $key, bool $required, array $values): array
    {
        return $this->field($key, 'select', $required, [
            'options' => array_map(fn (string $value) => [
                'value' => $value,
                'label_key' => 'workflows.simulate.option.'.$key.'.'.$value,
            ], $values),
        ]);
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function preset(string $key, array $context): array
    {
        return [
            'key' => $key,
            'context' => $context,
        ];
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function coerce(array $field, mixed $value): mixed
    {
        $type = (string) ($field['type'] ?? 'text');

        return match ($type) {
            'number' => is_numeric($value) ? (str_contains((string) $value, '.') ? (float) $value : (int) $value) : null,
            'boolean' => $this->asBool($value),
            'date' => is_string($value) && $value !== '' ? $value : null,
            default => is_scalar($value) || $value === null ? $value : (string) $value,
        };
    }

    private function asBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }
}
