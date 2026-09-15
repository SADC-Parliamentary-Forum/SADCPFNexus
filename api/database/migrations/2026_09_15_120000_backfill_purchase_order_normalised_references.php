<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchase_orders') || ! Schema::hasColumn('purchase_orders', 'normalised_reference')) {
            return;
        }

        $orders = DB::table('purchase_orders')
            ->whereNull('normalised_reference')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get(['id', 'tenant_id', 'lpo_number', 'reference_number']);

        foreach ($orders as $order) {
            $raw = $this->officialRawReference($order->lpo_number, $order->reference_number);
            if ($raw === null) {
                continue;
            }
            $normalised = $this->normalize($raw);
            if ($normalised === '') {
                continue;
            }
            $taken = DB::table('purchase_orders')
                ->where('tenant_id', $order->tenant_id)
                ->where('normalised_reference', $normalised)
                ->whereNull('deleted_at')
                ->exists();
            if ($taken) {
                continue;
            }

            DB::table('purchase_orders')->where('id', $order->id)->update([
                'normalised_reference' => $normalised,
            ]);
        }
    }

    public function down(): void
    {
        // Keep backfilled official numbers; they remain valid unique keys.
    }

    private function officialRawReference(mixed $lpoNumber, mixed $referenceNumber): ?string
    {
        foreach ([$lpoNumber, $referenceNumber] as $raw) {
            if (! is_string($raw) || $raw === '' || str_starts_with($raw, 'PROC-DRAFT-')) {
                continue;
            }

            return $raw;
        }

        return null;
    }

    private function normalize(string $display): string
    {
        $value = strtoupper(trim($display));

        return preg_replace('/[\s\-_\/]+/', '', $value) ?? $value;
    }
};
