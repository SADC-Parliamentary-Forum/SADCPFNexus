<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetContributionSchedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class BudgetContributionScheduleService
{
    public function create(array $data, User $user): BudgetContributionSchedule
    {
        $freq = $data['frequency'];
        if (! in_array($freq, ['monthly', 'quarterly', 'annual', 'one_off'], true)) {
            throw ValidationException::withMessages(['frequency' => 'Invalid frequency.']);
        }

        $start = Carbon::parse($data['start_date'])->startOfDay();

        return BudgetContributionSchedule::create([
            'tenant_id' => $user->tenant_id,
            'donor_name' => $data['donor_name'],
            'source_type' => $data['source_type'] ?? 'donor',
            'currency' => strtoupper($data['currency'] ?? 'NAD'),
            'amount' => $data['amount'],
            'frequency' => $freq,
            'start_date' => $start->toDateString(),
            'end_date' => $data['end_date'] ?? null,
            'next_due_date' => $start->toDateString(),
            'status' => $data['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    public function upcoming(BudgetContributionSchedule $schedule, int $months = 6): array
    {
        $months = max(1, min(36, $months));
        $cursor = Carbon::parse($schedule->next_due_date ?: $schedule->start_date)->startOfDay();
        $endLimit = now()->startOfDay()->addMonths($months);
        $hardEnd = $schedule->end_date ? Carbon::parse($schedule->end_date)->startOfDay() : null;
        $out = [];

        for ($i = 0; $i < 48; $i++) {
            if ($cursor->gt($endLimit)) {
                break;
            }
            if ($hardEnd && $cursor->gt($hardEnd)) {
                break;
            }
            $out[] = [
                'due_date' => $cursor->toDateString(),
                'amount' => (float) $schedule->amount,
                'currency' => $schedule->currency,
                'donor_name' => $schedule->donor_name,
            ];
            if ($schedule->frequency === 'one_off') {
                break;
            }
            $cursor = match ($schedule->frequency) {
                'monthly' => $cursor->copy()->addMonth(),
                'quarterly' => $cursor->copy()->addMonths(3),
                'annual' => $cursor->copy()->addYear(),
                default => $cursor->copy()->addMonth(),
            };
        }

        return $out;
    }
}
