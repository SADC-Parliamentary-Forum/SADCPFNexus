<?php

namespace App\Modules\Stock\Services;

use App\Models\StockCategory;
use App\Models\StockUnit;
use Illuminate\Database\QueryException;

/**
 * Tenant-scoped default UoM and categories (PRD §§12–13).
 * Idempotent: firstOrCreate by (tenant_id, code).
 */
class StockCatalogueService
{
    /** @var list<array{code: string, name: string, sort_order: int}> */
    public const DEFAULT_UNITS = [
        ['code' => 'each', 'name' => 'Each', 'sort_order' => 10],
        ['code' => 'box', 'name' => 'Box', 'sort_order' => 20],
        ['code' => 'pack', 'name' => 'Pack', 'sort_order' => 30],
        ['code' => 'ream', 'name' => 'Ream', 'sort_order' => 40],
        ['code' => 'carton', 'name' => 'Carton', 'sort_order' => 50],
        ['code' => 'roll', 'name' => 'Roll', 'sort_order' => 60],
        ['code' => 'bottle', 'name' => 'Bottle', 'sort_order' => 70],
        ['code' => 'set', 'name' => 'Set', 'sort_order' => 80],
        ['code' => 'pair', 'name' => 'Pair', 'sort_order' => 90],
        ['code' => 'other', 'name' => 'Other', 'sort_order' => 100],
    ];

    /** @var list<array{code: string, name: string, sort_order: int}> */
    public const DEFAULT_CATEGORIES = [
        ['code' => 'stationery', 'name' => 'Stationery', 'sort_order' => 10],
        ['code' => 'printing', 'name' => 'Printing Supplies', 'sort_order' => 20],
        ['code' => 'toner', 'name' => 'Toner & Ink', 'sort_order' => 30],
        ['code' => 'it_consumables', 'name' => 'IT Consumables', 'sort_order' => 40],
        ['code' => 'conference', 'name' => 'Conference Supplies', 'sort_order' => 50],
        ['code' => 'cleaning', 'name' => 'Cleaning Supplies', 'sort_order' => 60],
        ['code' => 'kitchen', 'name' => 'Kitchen Supplies', 'sort_order' => 70],
        ['code' => 'maintenance', 'name' => 'Maintenance Consumables', 'sort_order' => 80],
        ['code' => 'promotional', 'name' => 'Promotional Materials', 'sort_order' => 90],
        ['code' => 'other', 'name' => 'Other', 'sort_order' => 100],
    ];

    public function ensureDefaults(int $tenantId): void
    {
        $this->ensureUnits($tenantId);
        $this->ensureCategories($tenantId);
    }

    public function ensureUnits(int $tenantId): void
    {
        foreach (self::DEFAULT_UNITS as $row) {
            $this->firstOrCreateQuietly(StockUnit::class, $tenantId, $row, [
                'is_active' => true,
            ]);
        }
    }

    public function ensureCategories(int $tenantId): void
    {
        foreach (self::DEFAULT_CATEGORIES as $row) {
            $this->firstOrCreateQuietly(StockCategory::class, $tenantId, $row);
        }
    }

    /**
     * @param  class-string<StockUnit|StockCategory>  $model
     * @param  array{code: string, name: string, sort_order: int}  $row
     * @param  array<string, mixed>  $extra
     */
    private function firstOrCreateQuietly(string $model, int $tenantId, array $row, array $extra = []): void
    {
        try {
            $model::firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'code'      => $row['code'],
                ],
                array_merge([
                    'name'       => $row['name'],
                    'sort_order' => $row['sort_order'],
                ], $extra)
            );
        } catch (QueryException) {
            // Concurrent first visit — unique (tenant_id, code) already inserted.
        }
    }
}
