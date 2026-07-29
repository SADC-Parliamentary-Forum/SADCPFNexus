<?php

namespace App\Modules\Finance\Services;

use App\Models\PayrollImportBatch;
use App\Models\PayrollImportLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayslipImportService
{
    public function __construct(private readonly VendorPayrollAdapterFactory $factory) {}

    public function import(array $payload, User $user): PayrollImportBatch
    {
        $adapter = $this->factory->make();
        $lines = $adapter->importPayslips($payload);
        if ($lines === []) {
            throw ValidationException::withMessages(['lines' => 'No payslip lines to import.']);
        }

        return DB::transaction(function () use ($lines, $user, $adapter, $payload) {
            $batch = PayrollImportBatch::create([
                'tenant_id' => $user->tenant_id,
                'reference' => $payload['reference'] ?? ('PAYIMP-'.strtoupper(substr(uniqid(), -8))),
                'driver' => $adapter->driver(),
                'status' => 'draft',
                'period' => $payload['period'] ?? null,
                'line_count' => count($lines),
                'source_meta' => ['uploaded' => ! empty($payload['lines']), 'remote' => ! empty($payload['remote'])],
                'created_by' => $user->id,
            ]);

            foreach ($lines as $line) {
                PayrollImportLine::create([
                    'batch_id' => $batch->id,
                    'employee_number' => $line['employee_number'],
                    'period' => $line['period'] ?? $batch->period,
                    'gross' => $line['gross'],
                    'deductions' => $line['deductions'],
                    'net' => $line['net'],
                    'external_ref' => $line['external_ref'],
                    'raw' => $line,
                ]);
            }

            return $batch->load('lines');
        });
    }

    public function stage(PayrollImportBatch $batch, User $user): PayrollImportBatch
    {
        if ((int) $batch->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($batch->status === 'exported') {
            throw ValidationException::withMessages(['status' => 'Exported batches cannot be re-staged.']);
        }
        $batch->update(['status' => 'staged', 'staged_at' => now()]);

        return $batch->fresh('lines');
    }
}
