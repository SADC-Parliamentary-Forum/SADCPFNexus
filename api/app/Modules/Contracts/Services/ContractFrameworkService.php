<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Framework agreements and call-offs (PRD §79). A call-off cannot exceed the
 * framework ceiling, its remaining value or its term.
 */
class ContractFrameworkService
{
    /**
     * @return array{ceiling: float, used: float, remaining: float, call_off_count: int, currency: string}
     */
    public function utilisation(Contract $framework): array
    {
        $ceiling = (float) ($framework->framework_ceiling ?? 0);
        $callOffs = $framework->callOffs()->get(['id', 'current_value']);
        $used = (float) $callOffs->sum(fn ($c) => (float) $c->current_value);

        return [
            'ceiling' => $ceiling,
            'used' => round($used, 2),
            'remaining' => round($ceiling - $used, 2),
            'call_off_count' => $callOffs->count(),
            'currency' => (string) $framework->currency,
        ];
    }

    public function createCallOff(Contract $framework, User $user, array $data): Contract
    {
        if (! $framework->is_framework) {
            throw ValidationException::withMessages(['framework' => ['The parent contract is not a framework agreement.']]);
        }
        if (! in_array($framework->lifecycle(), ['ACTIVE', 'FULLY_EXECUTED'], true)) {
            throw ValidationException::withMessages(['framework' => ['Call-offs can only be issued under an active framework.']]);
        }

        $value = (float) ($data['value'] ?? 0);
        $util = $this->utilisation($framework);
        if ($util['ceiling'] > 0 && $value > $util['remaining'] + 0.01) {
            throw ValidationException::withMessages([
                'value' => [sprintf('Call-off exceeds the framework remaining value (%s %s).', $framework->currency, number_format($util['remaining'], 2))],
            ]);
        }

        $end = \Illuminate\Support\Carbon::parse($data['end_date']);
        if ($framework->end_date && $end->gt($framework->end_date)) {
            throw ValidationException::withMessages(['end_date' => ['Call-off end date cannot exceed the framework term.']]);
        }

        return DB::transaction(function () use ($framework, $user, $data, $value): Contract {
            return Contract::create([
                'tenant_id' => $framework->tenant_id,
                'created_by' => $user->id,
                'origin_type' => 'framework',
                'parent_contract_id' => $framework->id,
                'type_id' => $data['type_id'] ?? $framework->type_id,
                'vendor_id' => $framework->vendor_id,
                'counterparty_type' => $framework->counterparty_type,
                'counterparty_name' => $framework->counterparty_name,
                'department_id' => $data['department_id'] ?? $framework->department_id,
                'procurement_officer_id' => $user->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'service_start_date' => $data['start_date'],
                'service_end_date' => $data['end_date'],
                'value' => $value,
                'original_value' => $value,
                'current_value' => $value,
                'ceiling_value' => $value,
                'currency' => $framework->currency,
                'contract_status' => 'DRAFT',
                'status' => 'draft',
            ]);
        });
    }
}
