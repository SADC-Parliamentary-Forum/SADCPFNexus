<?php

namespace App\Modules\Budget\Services;

use App\Models\AuditLog;
use App\Models\BudgetActualTransaction;
use App\Models\BudgetLine;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BudgetActualService
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
    ) {}

    /**
     * @param  array{
     *   tenant_id:int,
     *   budget_line_id:int,
     *   accounting_reference:string,
     *   transaction_date:string,
     *   amount:float|int|string,
     *   currency?:string,
     *   posting_date?:?string,
     *   base_currency_amount?:float|int|string|null,
     *   fx_rate?:float|int|string|null,
     *   vendor_payee?:?string,
     *   description?:?string,
     *   source_module?:?string,
     *   source_id?:?int,
     *   import_batch?:?string,
     *   financial_year_id?:?int
     * }  $data
     */
    public function post(array $data, User $actor): BudgetActualTransaction
    {
        return DB::transaction(function () use ($data, $actor) {
            $line = BudgetLine::query()->whereKey($data['budget_line_id'])->lockForUpdate()->firstOrFail();
            $amount = round((float) $data['amount'], 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages(['amount' => 'Actual amount must be greater than zero.']);
            }

            $existing = BudgetActualTransaction::query()
                ->where('tenant_id', $data['tenant_id'])
                ->where('accounting_reference', $data['accounting_reference'])
                ->where('budget_line_id', $line->id)
                ->first();
            if ($existing) {
                return $existing;
            }

            $actual = BudgetActualTransaction::create([
                'tenant_id' => $data['tenant_id'],
                'budget_line_id' => $line->id,
                'financial_year_id' => $data['financial_year_id'] ?? $line->budget?->financial_year_id,
                'accounting_reference' => $data['accounting_reference'],
                'transaction_date' => $data['transaction_date'],
                'posting_date' => $data['posting_date'] ?? $data['transaction_date'],
                'amount' => $amount,
                'currency' => $data['currency'] ?? 'NAD',
                'base_currency_amount' => isset($data['base_currency_amount'])
                    ? (float) $data['base_currency_amount']
                    : $amount,
                'fx_rate' => isset($data['fx_rate']) ? (float) $data['fx_rate'] : null,
                'vendor_payee' => $data['vendor_payee'] ?? null,
                'description' => $data['description'] ?? null,
                'source_module' => $data['source_module'] ?? 'manual',
                'source_id' => $data['source_id'] ?? null,
                'import_batch' => $data['import_batch'] ?? null,
                'reconciliation_status' => 'unmatched',
                'posted_by' => $actor->id,
            ]);

            $this->availability->syncLegacySpent($line->fresh());

            AuditLog::record('budget.actual_posted', [
                'auditable_type' => BudgetActualTransaction::class,
                'auditable_id' => $actual->id,
                'new_values' => [
                    'accounting_reference' => $actual->accounting_reference,
                    'amount' => $amount,
                    'budget_line_id' => $line->id,
                ],
                'tags' => 'budget,actual',
            ]);

            return $actual;
        });
    }

    /**
     * CSV columns: accounting_reference,transaction_date,budget_line_code,amount,currency,vendor_payee,description
     *
     * @return array{imported:int, skipped:int, batch:string, errors:array<int,string>}
     */
    public function importCsv(UploadedFile $file, int $tenantId, User $actor): array
    {
        $batch = 'IMP-'.Str::upper(Str::random(10));
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'Unable to read CSV file.']);
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'CSV is empty.']);
        }
        $header = array_map(fn ($h) => Str::snake(trim((string) $h)), $header);

        $imported = 0;
        $skipped = 0;
        $errors = [];
        $rowNum = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNum++;
            if (count(array_filter($row, fn ($v) => $v !== null && $v !== '')) === 0) {
                continue;
            }
            $data = [];
            foreach ($header as $i => $key) {
                $data[$key] = $row[$i] ?? null;
            }

            $code = $data['budget_line_code'] ?? $data['budget_line'] ?? null;
            $ref = $data['accounting_reference'] ?? null;
            $date = $data['transaction_date'] ?? $data['date'] ?? null;
            $amount = $data['amount'] ?? null;

            if (! $code || ! $ref || ! $date || $amount === null) {
                $skipped++;
                $errors[] = "Row {$rowNum}: missing required fields";
                continue;
            }

            $line = BudgetLine::query()
                ->where('code', $code)
                ->whereHas('budget', fn ($q) => $q->where('tenant_id', $tenantId))
                ->first();

            if (! $line) {
                $skipped++;
                $errors[] = "Row {$rowNum}: unknown budget_line_code {$code}";
                continue;
            }

            try {
                $this->post([
                    'tenant_id' => $tenantId,
                    'budget_line_id' => $line->id,
                    'accounting_reference' => (string) $ref,
                    'transaction_date' => (string) $date,
                    'amount' => (float) $amount,
                    'currency' => $data['currency'] ?? 'NAD',
                    'vendor_payee' => $data['vendor_payee'] ?? null,
                    'description' => $data['description'] ?? null,
                    'import_batch' => $batch,
                    'source_module' => 'csv_import',
                ], $actor);
                $imported++;
            } catch (\Throwable $e) {
                $skipped++;
                $errors[] = "Row {$rowNum}: ".$e->getMessage();
            }
        }

        fclose($handle);

        return [
            'imported' => $imported,
            'skipped' => $skipped,
            'batch' => $batch,
            'errors' => $errors,
        ];
    }
}
