<?php

use App\Models\Tenant;
use App\Modules\Stock\Services\StockCatalogueService;
use Illuminate\Database\Migrations\Migration;

/**
 * Seed default stock categories and units of measure for existing tenants.
 * New tenants receive the same catalogue on first GET of /stock/units or /stock/categories.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! class_exists(StockCatalogueService::class)) {
            return;
        }

        $service = app(StockCatalogueService::class);
        Tenant::query()->orderBy('id')->pluck('id')->each(function ($id) use ($service) {
            $service->ensureDefaults((int) $id);
        });
    }

    public function down(): void
    {
        // Defaults may already be in use by stock items; do not delete.
    }
};
