<?php

namespace Tests\Feature\Stock;

use App\Models\StockBatch;
use App\Models\StockIssueLine;
use App\Models\StockItem;
use App\Models\Tenant;
use Carbon\Carbon;
use Tests\TestCase;

class StockFefoPickTest extends TestCase
{
    public function test_issue_auto_picks_earliest_expiry_batch_when_tracks_batches(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);

        $item = StockItem::create([
            'tenant_id' => $tenant->id,
            'item_code' => 'FEFO-'.substr(uniqid(), -4),
            'name' => 'Expiry Tracked Item',
            'unit' => 'box',
            'current_balance' => 100,
            'quantity_reserved' => 0,
            'quantity_quarantined' => 0,
            'reorder_level' => 5,
            'tracks_batches' => true,
            'status' => 'active',
        ]);

        $later = StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'B-LATE',
            'expiry_date' => '2026-12-01',
            'quantity' => 40,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);
        $earlier = StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'B-EARLY',
            'expiry_date' => '2026-09-01',
            'quantity' => 50,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);

        $response = $this->asUser($admin)
            ->postJson('/api/v1/stock/issues', [
                'issued_to_user_id' => $admin->id,
                'issue_date' => now()->toDateString(),
                'lines' => [
                    ['stock_item_id' => $item->id, 'quantity' => 20],
                ],
            ])
            ->assertCreated();

        $issueId = (int) $response->json('data.id');
        $line = StockIssueLine::where('stock_issue_id', $issueId)->first();
        $this->assertNotNull($line);
        $this->assertSame($earlier->id, (int) $line->stock_batch_id);

        $this->assertSame(30, (int) $earlier->fresh()->quantity);
        $this->assertSame(40, (int) $later->fresh()->quantity);
    }

    public function test_fefo_splits_across_batches_when_quantity_exceeds_first(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);

        $item = StockItem::create([
            'tenant_id' => $tenant->id,
            'item_code' => 'FEFO2-'.substr(uniqid(), -4),
            'name' => 'Split FEFO Item',
            'unit' => 'unit',
            'current_balance' => 30,
            'tracks_batches' => true,
            'status' => 'active',
        ]);

        $first = StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'S1',
            'expiry_date' => '2026-08-01',
            'quantity' => 10,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);
        $second = StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'S2',
            'expiry_date' => '2026-10-01',
            'quantity' => 20,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);

        $issueId = (int) $this->asUser($admin)
            ->postJson('/api/v1/stock/issues', [
                'issued_to_user_id' => $admin->id,
                'issue_date' => now()->toDateString(),
                'lines' => [
                    ['stock_item_id' => $item->id, 'quantity' => 15],
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        $lines = StockIssueLine::where('stock_issue_id', $issueId)->orderBy('id')->get();
        $this->assertCount(2, $lines);
        $this->assertSame($first->id, (int) $lines[0]->stock_batch_id);
        $this->assertSame(10, (int) $lines[0]->quantity);
        $this->assertSame($second->id, (int) $lines[1]->stock_batch_id);
        $this->assertSame(5, (int) $lines[1]->quantity);
        $this->assertSame(0, (int) $first->fresh()->quantity);
        $this->assertSame(StockBatch::STATUS_EXHAUSTED, $first->fresh()->status);
        $this->assertSame(15, (int) $second->fresh()->quantity);
    }

    public function test_explicit_batch_id_skips_fefo_and_still_decrements(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);

        $item = StockItem::create([
            'tenant_id' => $tenant->id,
            'item_code' => 'FEFO3-'.substr(uniqid(), -4),
            'name' => 'Manual Batch',
            'unit' => 'unit',
            'current_balance' => 50,
            'tracks_batches' => true,
            'status' => 'active',
        ]);

        $chosen = StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'MANUAL',
            'expiry_date' => '2026-12-01',
            'quantity' => 30,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);
        StockBatch::create([
            'tenant_id' => $tenant->id,
            'stock_item_id' => $item->id,
            'batch_number' => 'EARLIER',
            'expiry_date' => '2026-08-01',
            'quantity' => 20,
            'status' => StockBatch::STATUS_ACTIVE,
        ]);

        $line = StockIssueLine::where(
            'stock_issue_id',
            (int) $this->asUser($admin)
                ->postJson('/api/v1/stock/issues', [
                    'issued_to_user_id' => $admin->id,
                    'issue_date' => now()->toDateString(),
                    'lines' => [
                        [
                            'stock_item_id' => $item->id,
                            'quantity' => 5,
                            'stock_batch_id' => $chosen->id,
                        ],
                    ],
                ])
                ->assertCreated()
                ->json('data.id')
        )->first();

        $this->assertSame($chosen->id, (int) $line->stock_batch_id);
        $this->assertSame(25, (int) $chosen->fresh()->quantity);
    }
}
