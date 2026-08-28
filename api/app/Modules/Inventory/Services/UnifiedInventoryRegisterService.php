<?php

namespace App\Modules\Inventory\Services;

use App\Models\Asset;
use App\Models\InventoryRegisterEntry;
use App\Models\StockItem;
use App\Models\User;

class UnifiedInventoryRegisterService
{
    public function list(User $actor, int $perPage = 50)
    {
        return InventoryRegisterEntry::query()
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('id')
            ->paginate(min(100, max(1, $perPage)));
    }

    public function linkSplit(
        int $tenantId,
        ?int $grnId,
        ?int $grnItemId,
        ?Asset $asset,
        ?StockItem $stock,
        string $label,
        string $source = 'grn_split',
    ): InventoryRegisterEntry {
        return InventoryRegisterEntry::query()->create([
            'tenant_id' => $tenantId,
            'goods_receipt_note_id' => $grnId,
            'goods_receipt_item_id' => $grnItemId,
            'asset_id' => $asset?->id,
            'stock_item_id' => $stock?->id,
            'source' => $source,
            'label' => $label,
        ]);
    }
}
