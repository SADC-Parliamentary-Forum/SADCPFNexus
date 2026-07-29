<?php

namespace App\Modules\Finance\Services;

use App\Modules\Finance\Contracts\VendorPayrollAdapterInterface;

class NullPayrollVendorAdapter implements VendorPayrollAdapterInterface
{
    public function driver(): string
    {
        return 'null';
    }

    public function importPayslips(array $payload): array
    {
        return $this->normalize($payload['lines'] ?? []);
    }

    /**
     * @param  array<int, array>  $lines
     * @return array<int, array>
     */
    protected function normalize(array $lines): array
    {
        $out = [];
        foreach ($lines as $line) {
            if (! is_array($line)) {
                continue;
            }
            $out[] = [
                'employee_number' => isset($line['employee_number']) ? (string) $line['employee_number'] : null,
                'period' => isset($line['period']) ? (string) $line['period'] : null,
                'gross' => array_key_exists('gross', $line) ? (float) $line['gross'] : null,
                'deductions' => array_key_exists('deductions', $line) ? (float) $line['deductions'] : null,
                'net' => array_key_exists('net', $line) ? (float) $line['net'] : null,
                'external_ref' => isset($line['external_ref']) ? (string) $line['external_ref'] : null,
            ];
        }

        return $out;
    }
}
