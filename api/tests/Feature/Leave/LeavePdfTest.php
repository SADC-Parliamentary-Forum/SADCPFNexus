<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveLedgerEntry;
use App\Models\Tenant;
use Carbon\Carbon;
use Tests\TestCase;

class LeavePdfTest extends TestCase
{
    private function openingBalance(int $tenantId, int $userId, string $type, float $amount): void
    {
        LeaveLedgerEntry::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'leave_type' => $type,
            'transaction_type' => LeaveLedgerEntry::OPENING_BALANCE,
            'amount' => $amount,
            'unit' => 'days',
            'effective_date' => now()->startOfYear()->toDateString(),
            'reason' => 'Test opening balance',
        ]);
    }

    public function test_form005_pdf_can_be_downloaded_by_owner(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $staff] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $staff->id, 'annual', 10);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'FORM-005 download test',
        ])->assertCreated();

        $response = $this->asUser($staff)
            ->get('/api/v1/leave/requests/' . $created->json('data.id') . '/pdf')
            ->assertOk();

        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_peer_cannot_download_another_users_form005_pdf(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $staff] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $staff->id, 'annual', 10);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'FORM-005 peer access test',
        ])->assertCreated();

        $peer = $this->makeUser('staff', $tenant);

        $this->asUser($peer)
            ->get('/api/v1/leave/requests/' . $created->json('data.id') . '/pdf')
            ->assertForbidden();
    }
}
