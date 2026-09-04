<?php

namespace App\Modules\Procurement\Support;

use App\Support\Money;

final class ArithmeticValidator
{
    /**
     * @param  list<array{quantity?: mixed, unit_price?: mixed, line_total?: mixed}>  $lines
     * @return array{ok: bool, issues: list<string>, calculated_subtotal: string, calculated_grand_total: string}
     */
    public function validate(array $lines, mixed $subtotal, mixed $tax, mixed $discount, mixed $grandTotal): array
    {
        $issues = [];
        $sum = 0;
        foreach ($lines as $i => $line) {
            $qty = Money::toCents($line['quantity'] ?? 0);
            // quantity may be non-currency; treat as thousandths then convert via string
            $qtyValue = (string) ($line['quantity'] ?? 0);
            $unit = Money::toCents($line['unit_price'] ?? 0);
            $expected = $this->qtyTimesUnitCents($qtyValue, $unit);
            $actual = Money::toCents($line['line_total'] ?? 0);
            if ($expected !== $actual) {
                $issues[] = 'Line '.($i + 1).' quantity × unit price does not equal line total.';
            }
            $sum += $actual;
        }

        $sub = $subtotal !== null && $subtotal !== '' ? Money::toCents($subtotal) : $sum;
        if ($subtotal !== null && $subtotal !== '' && $sub !== $sum) {
            $issues[] = 'Sum of line totals does not equal subtotal.';
        }

        $taxCents = $tax === null || $tax === '' ? 0 : Money::toCents($tax);
        $discCents = $discount === null || $discount === '' ? 0 : Money::toCents($discount);
        $calculated = $sub + $taxCents - $discCents;
        if ($grandTotal !== null && $grandTotal !== '' && Money::toCents($grandTotal) !== $calculated) {
            $issues[] = 'Subtotal + tax − discount does not equal grand total.';
        }

        return [
            'ok' => $issues === [],
            'issues' => $issues,
            'calculated_subtotal' => Money::fromCents($sum),
            'calculated_grand_total' => Money::fromCents($calculated),
        ];
    }

    private function qtyTimesUnitCents(string $qty, int $unitCents): int
    {
        $qty = preg_replace('/[^\d.\-]/', '', str_replace(',', '', $qty)) ?: '0';
        if (function_exists('bcmul')) {
            return (int) bcmul($qty, (string) $unitCents, 0);
        }

        return (int) round(((float) $qty) * $unitCents);
    }
}
