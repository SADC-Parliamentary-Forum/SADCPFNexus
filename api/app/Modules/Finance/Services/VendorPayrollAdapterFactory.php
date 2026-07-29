<?php

namespace App\Modules\Finance\Services;

use App\Modules\Finance\Contracts\VendorPayrollAdapterInterface;

class VendorPayrollAdapterFactory
{
    public function make(?string $driver = null): VendorPayrollAdapterInterface
    {
        $driver = $driver ?: (string) config('payroll_vendor.driver', 'null');

        return match ($driver) {
            'generic_http' => app(GenericHttpPayrollAdapter::class),
            default => app(NullPayrollVendorAdapter::class),
        };
    }
}
