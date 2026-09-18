<?php

namespace App\Modules\Contracts\Services;

use Illuminate\Support\Facades\DB;

/**
 * Allocates unique, sequential, per-tenant, per-year contract references of the
 * form CTR/{YYYY}/{SEQ:4} (PRD §13).
 *
 * Numbers are allocated at draft creation and never rolled back, so a cancelled
 * draft permanently reserves its number (it can never be reused). Allocation is
 * concurrency-safe via a row lock on the per-year sequence.
 */
class ContractNumberAllocator
{
    public function allocate(int $tenantId, ?int $year = null): string
    {
        $year ??= (int) now()->year;

        return DB::transaction(function () use ($tenantId, $year): string {
            $row = DB::table('contract_number_sequences')
                ->where('tenant_id', $tenantId)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                DB::table('contract_number_sequences')->insert([
                    'tenant_id' => $tenantId,
                    'year' => $year,
                    'last_number' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                // Re-fetch under lock to serialise concurrent first inserts.
                $row = DB::table('contract_number_sequences')
                    ->where('tenant_id', $tenantId)
                    ->where('year', $year)
                    ->lockForUpdate()
                    ->first();
            }

            $next = (int) $row->last_number + 1;

            DB::table('contract_number_sequences')
                ->where('id', $row->id)
                ->update(['last_number' => $next, 'updated_at' => now()]);

            return sprintf('CTR/%d/%04d', $year, $next);
        });
    }
}
