<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetFxRate;
use Illuminate\Validation\ValidationException;

class BudgetFxConversionService
{
    public function convert(int $tenantId, float|int|string $amount, string $from, string $to, ?string $asOf = null): array
    {
        $from = strtoupper(trim($from));
        $to = strtoupper(trim($to));
        $value = (float) $amount;
        $asOfDate = $asOf ?: now()->toDateString();

        if ($from === $to) {
            return [
                'amount' => $value,
                'from' => $from,
                'to' => $to,
                'converted' => $value,
                'rate' => 1.0,
                'as_of' => $asOfDate,
                'source' => 'identity',
            ];
        }

        $direct = BudgetFxRate::query()
            ->where('tenant_id', $tenantId)
            ->where('base_currency', $from)
            ->where('quote_currency', $to)
            ->whereDate('effective_date', '<=', $asOfDate)
            ->orderByDesc('effective_date')
            ->first();

        if ($direct) {
            $converted = $value * (float) $direct->rate;

            return [
                'amount' => $value,
                'from' => $from,
                'to' => $to,
                'converted' => round($converted, 8),
                'rate' => (float) $direct->rate,
                'as_of' => $direct->effective_date->toDateString(),
                'source' => $direct->source,
            ];
        }

        $inverse = BudgetFxRate::query()
            ->where('tenant_id', $tenantId)
            ->where('base_currency', $to)
            ->where('quote_currency', $from)
            ->whereDate('effective_date', '<=', $asOfDate)
            ->orderByDesc('effective_date')
            ->first();

        if ($inverse && (float) $inverse->rate != 0.0) {
            $rate = 1 / (float) $inverse->rate;
            $converted = $value * $rate;

            return [
                'amount' => $value,
                'from' => $from,
                'to' => $to,
                'converted' => round($converted, 8),
                'rate' => round($rate, 8),
                'as_of' => $inverse->effective_date->toDateString(),
                'source' => $inverse->source . '_inverse',
            ];
        }

        throw ValidationException::withMessages([
            'rate' => "No FX rate found for {$from}/{$to} on or before {$asOfDate}.",
        ]);
    }
}
