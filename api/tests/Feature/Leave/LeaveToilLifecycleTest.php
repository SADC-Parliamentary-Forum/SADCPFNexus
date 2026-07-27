<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\Tenant;
use App\Models\ToilCredit;
use App\Models\ToilExtension;
use App\Modules\Leave\Services\LeaveService;
use Carbon\Carbon;
use Tests\TestCase;

class LeaveToilLifecycleTest extends TestCase
{
    private function toilCredit(Tenant $tenant, int $userId, string $reference, string $expiryDate, float $days, string $status = ToilCredit::AVAILABLE): ToilCredit
    {
        $credit = ToilCredit::create([
            'tenant_id' => $tenant->id,
            'user_id' => $userId,
            'credit_reference' => $reference,
            'source_type' => 'test',
            'source_id' => random_int(1000, 9999),
            'duty_date' => now()->subDays(5)->toDateString(),
            'earned_amount' => $days * 8,
            'unit' => 'hours',
            'credited_days' => $days,
            'accrual_date' => now()->subDays(5)->toDateString(),
            'expiry_date' => $expiryDate,
            'original_balance' => $days,
            'used_balance' => 0,
            'remaining_balance' => $days,
            'status' => $status,
        ]);

        LeaveLedgerEntry::create([
            'tenant_id' => $tenant->id,
            'user_id' => $userId,
            'leave_type' => 'lil',
            'transaction_type' => LeaveLedgerEntry::TOIL_CREDIT,
            'amount' => $days,
            'unit' => 'days',
            'effective_date' => now()->subDays(5)->toDateString(),
            'source_type' => ToilCredit::class,
            'source_id' => $credit->id,
            'reference' => $reference,
            'reason' => 'Test TOIL credit',
        ]);

        return $credit;
    }

    public function test_approved_leave_in_lieu_consumes_earliest_expiring_toil_first(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $approver = $this->makeHrManager($tenant);

        $early = $this->toilCredit($tenant, $staff->id, 'TOIL-EARLY', now()->addDays(5)->toDateString(), 1);
        $later = $this->toilCredit($tenant, $staff->id, 'TOIL-LATER', now()->addDays(20)->toDateString(), 1);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $this->asUser($staff)->postJson('/api/v1/leave/requests', [
            'reason' => 'Use TOIL',
            'segments' => [[
                'leave_type' => 'lil',
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'amount_requested' => 1.5,
            ]],
        ])->assertCreated();

        $this->asUser($staff)
            ->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertOk();

        $leave = LeaveRequest::with('segments')->findOrFail($created->json('data.id'));
        app(LeaveService::class)->onWorkflowApproved($leave, $approver);

        $this->assertSame(ToilCredit::USED, $early->fresh()->status);
        $this->assertSame('0.00', (string) $early->fresh()->remaining_balance);
        $this->assertSame(ToilCredit::PARTIALLY_USED, $later->fresh()->status);
        $this->assertSame('0.50', (string) $later->fresh()->remaining_balance);
        $this->assertSame(2, LeaveLedgerEntry::where('transaction_type', LeaveLedgerEntry::TOIL_USAGE)->count());
    }

    public function test_manage_toil_expiry_sends_alerts_and_expires_overdue_credit_once(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $today = $this->toilCredit($tenant, $staff->id, 'TOIL-ALERT', now()->toDateString(), 1);
        $expired = $this->toilCredit($tenant, $staff->id, 'TOIL-OLD', now()->subDay()->toDateString(), 1);

        $this->artisan('leave:manage-toil-expiry', ['--tenant' => $tenant->id])
            ->assertExitCode(0);

        $this->assertSame(ToilCredit::EXPIRED, $expired->fresh()->status);
        $this->assertSame(ToilCredit::AVAILABLE, $today->fresh()->status);
        $this->assertDatabaseHas('leave_ledger_entries', [
            'source_type' => ToilCredit::class,
            'source_id' => $expired->id,
            'transaction_type' => LeaveLedgerEntry::TOIL_EXPIRY,
            'amount' => '-1.00',
        ]);
        $this->assertSame(1, Notification::where('trigger', 'leave.toil_expiry_alert')->where('user_id', $staff->id)->count());

        $this->artisan('leave:manage-toil-expiry', ['--tenant' => $tenant->id])
            ->assertExitCode(0);

        $this->assertSame(1, Notification::where('trigger', 'leave.toil_expiry_alert')->where('user_id', $staff->id)->count());
        $this->assertSame(1, LeaveLedgerEntry::where('source_type', ToilCredit::class)
            ->where('source_id', $expired->id)
            ->where('transaction_type', LeaveLedgerEntry::TOIL_EXPIRY)
            ->count());
    }

    public function test_secretary_general_can_extend_expired_toil_credit_and_restore_ledger_balance(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $sg = $this->makeUser('Secretary General', $tenant);
        $credit = $this->toilCredit($tenant, $staff->id, 'TOIL-EXTEND', now()->subDay()->toDateString(), 1, ToilCredit::EXPIRED);

        LeaveLedgerEntry::create([
            'tenant_id' => $tenant->id,
            'user_id' => $staff->id,
            'leave_type' => 'lil',
            'transaction_type' => LeaveLedgerEntry::TOIL_EXPIRY,
            'amount' => -1,
            'unit' => 'days',
            'effective_date' => now()->subDay()->toDateString(),
            'source_type' => ToilCredit::class,
            'source_id' => $credit->id,
            'reference' => $credit->credit_reference,
            'reason' => 'Expired before extension',
        ]);

        $newExpiry = now()->addDays(10)->toDateString();
        $this->asUser($sg)->postJson("/api/v1/leave/toil/{$credit->id}/extend", [
            'requested_expiry_date' => $newExpiry,
            'reason' => 'Operational pressure prevented use',
        ])->assertOk()
            ->assertJsonPath('data.extension.status', 'approved')
            ->assertJsonPath('data.credit.status', ToilCredit::EXTENDED)
            ->assertJsonPath('data.credit.expiry_date', $newExpiry);

        $this->assertDatabaseHas('toil_extensions', [
            'toil_credit_id' => $credit->id,
            'status' => 'approved',
            'approved_expiry_date' => $newExpiry,
            'decided_by' => $sg->id,
        ]);
        $this->assertSame(1, ToilExtension::where('toil_credit_id', $credit->id)->count());
        $this->assertDatabaseHas('leave_ledger_entries', [
            'source_type' => ToilExtension::class,
            'transaction_type' => LeaveLedgerEntry::ADJUSTMENT,
            'amount' => '1.00',
        ]);
    }
}
