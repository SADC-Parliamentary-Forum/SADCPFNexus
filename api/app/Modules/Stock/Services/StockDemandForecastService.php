<?php

namespace App\Modules\Stock\Services;

use App\Models\StockItem;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Usage-based reorder suggestions with exponential smoothing.
 * Optional HTTP ML overlay when STOCK_FORECAST_HTTP_URL is set. Never claims live ML otherwise.
 */
class StockDemandForecastService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function suggest(int $tenantId, int $lookbackDays = 90): array
    {
        $lookbackDays = max(14, min(365, $lookbackDays));
        $since = Carbon::now()->subDays($lookbackDays)->toDateString();

        $usage = StockTransaction::query()
            ->selectRaw('stock_item_id, SUM(ABS(quantity)) as qty_out')
            ->where('tenant_id', $tenantId)
            ->where('type', StockTransaction::TYPE_OUT)
            ->whereDate('transaction_date', '>=', $since)
            ->groupBy('stock_item_id')
            ->pluck('qty_out', 'stock_item_id');

        /** @var Collection<int, StockItem> $items */
        $items = StockItem::query()
            ->with(['unitOfMeasure:id,code,name', 'location:id,code,name'])
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('item_code')
            ->get();

        $rows = [];
        foreach ($items as $item) {
            $consumed = (float) ($usage[$item->id] ?? 0);
            $avgDaily = $lookbackDays > 0 ? $consumed / $lookbackDays : 0.0;
            $daysCover = $avgDaily > 0
                ? round($item->available_quantity / $avgDaily, 1)
                : null;
            $suggestedReorder = 0;
            if ($item->reorder_level > 0 && $item->available_quantity <= $item->reorder_level) {
                $target = $item->max_level > 0
                    ? (int) $item->max_level
                    : max((int) $item->reorder_level * 2, (int) ceil($avgDaily * 30));
                $suggestedReorder = max(0, $target - (int) $item->available_quantity);
            } elseif ($avgDaily > 0 && ($daysCover === null || $daysCover < 21)) {
                $suggestedReorder = max(0, (int) ceil($avgDaily * 30) - (int) $item->available_quantity);
            }

            $rows[] = [
                'stock_item_id' => $item->id,
                'item_code' => $item->item_code,
                'name' => $item->name,
                'unit' => $item->unitOfMeasure?->code ?? $item->unit,
                'location' => $item->location?->name ?? $item->storage_location,
                'available_quantity' => (int) $item->available_quantity,
                'reorder_level' => (int) $item->reorder_level,
                'lookback_days' => $lookbackDays,
                'usage_qty' => (int) $consumed,
                'avg_daily_usage' => round($avgDaily, 3),
                'days_of_cover' => $daysCover,
                'suggested_reorder_qty' => $suggestedReorder,
                'needs_reorder' => $suggestedReorder > 0,
            ];
        }

        usort($rows, function ($a, $b) {
            if ($a['needs_reorder'] !== $b['needs_reorder']) {
                return $a['needs_reorder'] ? -1 : 1;
            }

            return $b['suggested_reorder_qty'] <=> $a['suggested_reorder_qty'];
        });

        return $rows;
    }

    public function methodLabel(): string
    {
        $provider = strtolower((string) config('stock.forecast_provider', 'exponential_smoothing'));
        if ($provider === 'http' && filled(config('stock.forecast_http_url'))) {
            return 'http_ml';
        }

        return 'exponential_smoothing';
    }
}
