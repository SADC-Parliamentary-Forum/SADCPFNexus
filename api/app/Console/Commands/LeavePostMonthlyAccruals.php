<?php

namespace App\Console\Commands;

use App\Modules\Leave\Services\LeaveAccrualService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class LeavePostMonthlyAccruals extends Command
{
    protected $signature = 'leave:post-monthly-accruals
        {--tenant= : Restrict accrual posting to one tenant ID}
        {--month= : Accrual period in YYYY-MM format; defaults to the current month}
        {--dry-run : Report what would be posted without writing ledger entries}';

    protected $description = 'Post configured monthly annual leave accruals to the leave ledger.';

    public function handle(LeaveAccrualService $service): int
    {
        $tenantId = $this->option('tenant') !== null ? (int) $this->option('tenant') : null;
        $month = $this->parseMonth($this->option('month'));

        if ($month === false) {
            $this->error('The --month option must use YYYY-MM format.');

            return self::INVALID;
        }

        $summary = $service->postMonthlyAnnualAccruals(
            tenantId: $tenantId,
            month: $month,
            dryRun: (bool) $this->option('dry-run'),
        );

        $this->info(sprintf(
            'Leave accrual period %s: %d posted, %d would post, %d duplicates skipped, %d users considered, %d tenants without configured annual accrual.',
            $summary['period'],
            $summary['entries_posted'],
            $summary['entries_would_post'],
            $summary['duplicates_skipped'],
            $summary['users_considered'],
            $summary['tenants_without_config'],
        ));

        return self::SUCCESS;
    }

    private function parseMonth(mixed $month): CarbonImmutable|false|null
    {
        if ($month === null || $month === '') {
            return null;
        }

        if (! is_string($month) || ! preg_match('/^\d{4}-\d{2}$/', $month)) {
            return false;
        }

        $parsed = CarbonImmutable::createFromFormat('Y-m-d', $month.'-01');

        if (! $parsed || $parsed->format('Y-m') !== $month) {
            return false;
        }

        return $parsed->startOfMonth();
    }
}
