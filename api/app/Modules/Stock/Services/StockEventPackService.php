<?php

namespace App\Modules\Stock\Services;

use App\Models\StockEventPack;
use App\Models\StockEventPackLine;
use App\Models\StockItem;
use App\Models\StockRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockEventPackService
{
    public function __construct(private readonly StockStoresWorkflowService $workflow) {}

    public function list(User $user): array
    {
        return StockEventPack::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['lines.item:id,item_code,name,barcode,unit,current_balance'])
            ->orderBy('name')
            ->get()
            ->all();
    }

    public function create(array $data, User $user): StockEventPack
    {
        if (empty($data['lines'])) {
            throw ValidationException::withMessages(['lines' => 'At least one line is required.']);
        }

        return DB::transaction(function () use ($data, $user) {
            $pack = StockEventPack::create([
                'tenant_id' => $user->tenant_id,
                'name' => $data['name'],
                'event_type' => $data['event_type'] ?? 'general',
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
            $this->syncLines($pack, $data['lines'], $user);

            return $pack->load(['lines.item:id,item_code,name,barcode,unit,current_balance']);
        });
    }

    public function instantiate(StockEventPack $pack, User $user, array $data = []): StockRequest
    {
        abort_unless((int) $pack->tenant_id === (int) $user->tenant_id, 404);
        $pack->load('lines');
        if ($pack->lines->isEmpty()) {
            throw ValidationException::withMessages(['lines' => 'Event pack has no lines.']);
        }

        $request = $this->workflow->createRequest([
            'purpose' => $data['purpose'] ?? ('Event pack: '.$pack->name),
            'notes' => 'Drafted from event pack '.$pack->name.'. Not issued automatically.',
            'department_id' => $data['department_id'] ?? $user->department_id,
            'submit' => false,
            'lines' => $pack->lines->map(fn (StockEventPackLine $line) => [
                'stock_item_id' => $line->stock_item_id,
                'quantity_requested' => (int) $line->quantity,
                'notes' => $line->notes,
            ])->all(),
        ], $user);

        return $request->load(['lines.item:id,item_code,name,barcode,unit']);
    }

    public function duplicate(StockEventPack $pack, User $user): StockEventPack
    {
        abort_unless((int) $pack->tenant_id === (int) $user->tenant_id, 404);
        $pack->load('lines');
        if ($pack->lines->isEmpty()) {
            throw ValidationException::withMessages(['lines' => 'Event pack has no lines to copy.']);
        }

        return $this->create([
            'name' => $pack->name.' (copy)',
            'event_type' => $pack->event_type,
            'notes' => $pack->notes,
            'lines' => $pack->lines->map(fn (StockEventPackLine $line) => [
                'stock_item_id' => $line->stock_item_id,
                'quantity' => (int) $line->quantity,
                'notes' => $line->notes,
            ])->all(),
        ], $user);
    }

    public function barcodeLookup(User $user, array $barcodes): array
    {
        $codes = collect($barcodes)
            ->map(fn ($c) => trim((string) $c))
            ->filter()
            ->unique()
            ->values();

        $matched = StockItem::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('barcode', $codes->all())
            ->with(['category:id,name,code', 'location:id,code,name'])
            ->get();

        $found = $matched->pluck('barcode')->all();
        $missing = $codes->reject(fn ($c) => in_array($c, $found, true))->values()->all();

        return [
            'matched' => $matched->values()->all(),
            'missing' => $missing,
        ];
    }

    /**
     * @param  array<int, array{stock_item_id: int, quantity: int, notes?: ?string}>  $lines
     */
    private function syncLines(StockEventPack $pack, array $lines, User $user): void
    {
        foreach ($lines as $line) {
            $item = StockItem::where('tenant_id', $user->tenant_id)->find($line['stock_item_id'] ?? null);
            if (! $item) {
                throw ValidationException::withMessages(['lines' => 'Stock item not found for event pack line.']);
            }
            $qty = (int) ($line['quantity'] ?? 0);
            if ($qty <= 0) {
                throw ValidationException::withMessages(['lines' => 'quantity must be positive.']);
            }
            StockEventPackLine::create([
                'stock_event_pack_id' => $pack->id,
                'stock_item_id' => $item->id,
                'quantity' => $qty,
                'notes' => $line['notes'] ?? null,
            ]);
        }
    }
}
