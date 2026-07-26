<?php

namespace App\Modules\Travel\Services;

use App\Models\Attachment;
use App\Models\DsaRate;
use App\Models\TravelDsaLine;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\Travel\Contracts\FxRateFeedInterface;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TravelDsaService
{
    public function __construct(
        private readonly FxRateFeedInterface $fxFeed,
    ) {}

    public function calculateAndSave(TravelRequest $travel, array $payload, User $user): TravelRequest
    {
        if (! $user->can('travel.finance-review') && ! $user->isSystemAdmin() && ! $user->hasRole('Finance Controller')) {
            abort(403, 'Only Finance may calculate DSA.');
        }

        if ((int) $travel->requester_id === (int) $user->id && ! $user->isSystemAdmin()) {
            throw ValidationException::withMessages([
                'dsa' => 'You cannot calculate DSA on your own travel request.',
            ]);
        }

        $lines = $payload['lines'] ?? null;
        if ($lines === null) {
            $lines = $this->buildDefaultLines($travel, (int) ($payload['rate_type'] ?? 1));
        }

        $mealDeductionTotal = 0.0;
        $payableTotal = 0.0;
        $asOf = Carbon::today();

        DB::transaction(function () use ($travel, $lines, &$mealDeductionTotal, &$payableTotal, $payload, $asOf) {
            $travel->dsaLines()->delete();

            foreach ($lines as $line) {
                $isPersonal = (bool) ($line['is_personal'] ?? false);
                $dailyRate = (float) ($line['daily_rate'] ?? 0);
                $mealDeduction = (float) ($line['meal_deduction'] ?? 0);
                $adjustments = (float) ($line['adjustments'] ?? 0);
                $dailyPayable = $isPersonal ? 0.0 : max(0, $dailyRate - $mealDeduction + $adjustments);

                $fxFrom = isset($line['fx_from_currency']) ? strtoupper((string) $line['fx_from_currency']) : null;
                $fxTo = isset($line['fx_to_currency'])
                    ? strtoupper((string) $line['fx_to_currency'])
                    : ($fxFrom ? strtoupper((string) ($travel->currency ?? 'NAD')) : null);
                $fxRate = null;
                $fxAsOf = null;
                if ($fxFrom && $fxTo) {
                    $fxRate = $this->fxFeed->getRate($fxFrom, $fxTo, $asOf, (int) $travel->tenant_id);
                    $fxAsOf = $asOf->toDateString();
                }

                TravelDsaLine::create([
                    'travel_request_id' => $travel->id,
                    'date'              => $line['date'],
                    'destination'       => $line['destination'] ?? $travel->destination_city,
                    'rate_type'         => (int) ($line['rate_type'] ?? 1),
                    'daily_rate'        => $dailyRate,
                    'meal_deduction'    => $mealDeduction,
                    'adjustments'       => $adjustments,
                    'daily_payable'     => $dailyPayable,
                    'is_personal'       => $isPersonal,
                    'notes'             => $line['notes'] ?? null,
                    'fx_from_currency'  => $fxFrom,
                    'fx_to_currency'    => $fxTo,
                    'fx_rate'           => $fxRate,
                    'fx_as_of'          => $fxAsOf,
                ]);

                if (! $isPersonal) {
                    $mealDeductionTotal += $mealDeduction;
                    $payableTotal += $dailyPayable;
                }
            }

            $terminal = (float) ($payload['terminal_comms_total'] ?? $travel->terminal_comms_total ?? 0);
            $travel->update([
                'finance_dsa_total'     => $payableTotal + $terminal,
                'meal_deduction_total' => $mealDeductionTotal,
                'terminal_comms_total' => $terminal,
                'actual_dsa'           => $payableTotal + $terminal,
                'finance_status'       => 'dsa_calculated',
            ]);
        });

        $officialDays = $this->countOfficialDays($travel);
        $payableLines = $travel->fresh()->dsaLines()->where('is_personal', false)->count();
        if ($officialDays > 0 && $payableLines !== $officialDays) {
            // Variance is a warning only — stored in response via controller
            $travel->setAttribute('dsa_day_variance_warning', true);
            $travel->setAttribute('dsa_expected_official_days', $officialDays);
            $travel->setAttribute('dsa_payable_line_count', $payableLines);
        }

        return $travel->fresh(['dsaLines', 'requester']);
    }

    public function buildDefaultLines(TravelRequest $travel, int $rateType = 1): array
    {
        $personal = array_flip($travel->personalDayDates());
        $rate = DsaRate::where('tenant_id', $travel->tenant_id)
            ->where('country', $travel->destination_country)
            ->where('rate_type', $rateType)
            ->where('is_active', true)
            ->where(function ($q) use ($travel) {
                $q->whereNull('effective_from')
                    ->orWhere('effective_from', '<=', $travel->departure_date);
            })
            ->where(function ($q) use ($travel) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $travel->departure_date);
            })
            ->orderByDesc('version')
            ->first();

        $daily = $rate ? $rate->dailyTotal() : 0.0;
        $lines = [];
        $dep = Carbon::parse($travel->departure_date);
        $ret = Carbon::parse($travel->return_date);

        for ($d = $dep->copy(); $d->lte($ret); $d->addDay()) {
            $dateStr = $d->format('Y-m-d');
            $isPersonal = isset($personal[$dateStr]);
            $lines[] = [
                'date'           => $dateStr,
                'destination'    => $travel->destination_city,
                'rate_type'      => $rateType,
                'daily_rate'     => $isPersonal ? 0 : $daily,
                'meal_deduction' => 0,
                'adjustments'    => 0,
                'is_personal'    => $isPersonal,
            ];
        }

        return $lines;
    }

    public function countOfficialDays(TravelRequest $travel): int
    {
        $personal = array_flip($travel->personalDayDates());
        $count = 0;
        $dep = Carbon::parse($travel->departure_date);
        $ret = Carbon::parse($travel->return_date);
        for ($d = $dep->copy(); $d->lte($ret); $d->addDay()) {
            if (! isset($personal[$d->format('Y-m-d')])) {
                $count++;
            }
        }

        return $count;
    }

    public function listRates(int $tenantId, array $filters = [])
    {
        $q = DsaRate::where('tenant_id', $tenantId)->orderBy('country')->orderBy('rate_type');
        if (! empty($filters['country'])) {
            $q->where('country', $filters['country']);
        }
        if (isset($filters['is_active'])) {
            $q->where('is_active', (bool) $filters['is_active']);
        }

        return $q->paginate($filters['per_page'] ?? 50);
    }

    public function upsertRate(array $data, User $user): DsaRate
    {
        if (! empty($data['id'])) {
            $rate = DsaRate::where('tenant_id', $user->tenant_id)->findOrFail($data['id']);
            $rate->update(collect($data)->except('id')->all());

            return $rate->fresh();
        }

        return DsaRate::create(array_merge($data, [
            'tenant_id' => $user->tenant_id,
            'version'   => $data['version'] ?? 1,
        ]));
    }
}
