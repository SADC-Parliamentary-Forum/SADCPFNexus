<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\Notifications\NotificationOutbox;
use App\Models\Tenant;
use App\Modules\Contracts\Services\ContractReminderService;
use Tests\TestCase;

/**
 * Contract reminder & escalation engine (PRD §64–§66).
 */
class ContractReminderTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(array $overrides = []): Contract
    {
        $owner = $this->makeUser('staff', $this->tenant);
        $po = $this->makeProcurementOfficer($this->tenant);

        return Contract::create(array_merge([
            'tenant_id' => $this->tenant->id, 'created_by' => $po->id,
            'contract_owner_id' => $owner->id, 'procurement_officer_id' => $po->id,
            'counterparty_type' => 'organisation', 'title' => 'Interpretation', 'currency' => 'USD',
            'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addDays(30)->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000,
            'contract_status' => 'ACTIVE', 'status' => 'active',
        ], $overrides));
    }

    private function outboxCount(string $event): int
    {
        return NotificationOutbox::where('tenant_id', $this->tenant->id)->where('event_type', $event)->count();
    }

    public function test_expiry_window_notifies_owner_and_procurement_once(): void
    {
        $this->contract(['end_date' => now()->addDays(30)->toDateString()]);

        $svc = app(ContractReminderService::class);
        $sent = $svc->run($this->tenant->id);

        $this->assertSame(2, $sent); // owner + procurement officer
        $this->assertSame(2, $this->outboxCount('contract.expiry_reminder'));

        // Idempotent: a second run creates no new outbox rows for the same window.
        $svc->run($this->tenant->id);
        $this->assertSame(2, $this->outboxCount('contract.expiry_reminder'));
    }

    public function test_outside_windows_no_reminder(): void
    {
        $this->contract(['end_date' => now()->addDays(45)->toDateString()]);

        app(ContractReminderService::class)->run($this->tenant->id);
        $this->assertSame(0, $this->outboxCount('contract.expiry_reminder'));
    }

    public function test_deliverable_due_window_notifies(): void
    {
        $c = $this->contract(['end_date' => now()->addDays(200)->toDateString()]);
        ContractDeliverable::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $c->id, 'number' => 1, 'name' => 'Draft report',
            'status' => 'in_progress', 'due_date' => now()->addDays(3)->toDateString(),
        ]);

        app(ContractReminderService::class)->run($this->tenant->id);
        $this->assertGreaterThanOrEqual(1, $this->outboxCount('contract.deliverable_reminder'));
    }

    public function test_overdue_signature_escalates(): void
    {
        $this->contract([
            'end_date' => now()->addDays(200)->toDateString(),
            'contract_status' => 'SENT_FOR_SIGNATURE', 'status' => 'draft',
            'signature_deadline' => now()->subDays(3)->toDateString(),
        ]);

        app(ContractReminderService::class)->run($this->tenant->id);
        $this->assertGreaterThanOrEqual(1, $this->outboxCount('contract.escalation'));
    }
}
