<?php

namespace App\Modules\Finance\Services;

use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * Resolves the configured payroll recovery adapter driver.
 *
 * Unknown drivers and unconfigured vendor classes fail closed (exception)
 * so production never silently binds a half-wired vendor path.
 */
class PayrollRecoveryAdapterFactory
{
    /**
     * @var array<string, class-string<PayrollRecoveryAdapterInterface>>
     */
    private const BUILTIN = [
        'manual'   => ManualPayrollRecoveryAdapter::class,
        'null'     => NullPayrollRecoveryAdapter::class,
        'disabled' => NullPayrollRecoveryAdapter::class,
    ];

    public function make(?string $driver = null): PayrollRecoveryAdapterInterface
    {
        $driver = strtolower(trim((string) ($driver ?? config('salary_advance.payroll_recovery_driver', 'manual'))));

        if ($driver === '') {
            $driver = 'manual';
        }

        if (isset(self::BUILTIN[$driver])) {
            return app(self::BUILTIN[$driver]);
        }

        if ($driver === 'vendor') {
            return $this->makeVendorAdapter();
        }

        throw new InvalidArgumentException(
            "Unknown salary advance payroll recovery driver [{$driver}]. Allowed: manual, null, disabled, vendor."
        );
    }

    private function makeVendorAdapter(): PayrollRecoveryAdapterInterface
    {
        $class = trim((string) config('salary_advance.payroll_vendor_class', ''));

        if ($class === '') {
            throw new InvalidArgumentException(
                'Payroll driver [vendor] is not configured. Set SALARY_ADVANCE_PAYROLL_VENDOR_CLASS to a class implementing PayrollRecoveryAdapterInterface, or keep SALARY_ADVANCE_PAYROLL_DRIVER=manual.'
            );
        }

        if (! class_exists($class)) {
            throw new InvalidArgumentException(
                "Configured payroll vendor class [{$class}] does not exist."
            );
        }

        $adapter = app($class);

        if (! $adapter instanceof PayrollRecoveryAdapterInterface) {
            throw new RuntimeException(
                "Configured payroll vendor class [{$class}] must implement PayrollRecoveryAdapterInterface."
            );
        }

        return $adapter;
    }
}
