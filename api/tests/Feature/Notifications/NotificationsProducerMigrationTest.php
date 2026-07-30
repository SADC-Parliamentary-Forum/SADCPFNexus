<?php

namespace Tests\Feature\Notifications;

use App\Mail\ModuleNotificationMail;
use App\Mail\WeeklySummaryMail;
use App\Models\Notification;
use App\Models\Notifications\NotificationOutbox;
use App\Models\Notifications\NotificationRecipient;
use App\Models\Tenant;
use App\Models\WeeklySummaryReport;
use App\Models\WeeklySummaryRun;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Residual producer migration — Leave/Travel/Procurement/Weekly/etc. must publish via outbox,
 * never via direct Mail:: from business modules.
 */
class NotificationsProducerMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
    }

    public function test_leave_and_travel_triggers_publish_through_outbox(): void
    {
        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $approver = $this->makeHrManager($tenant);
        $notifications = app(NotificationService::class);

        $notifications->dispatch(
            $approver,
            'leave.submitted',
            [
                'name' => $approver->name,
                'reference' => 'LV-MIG-1',
                'requester' => $requester->name,
                'leave_type' => 'Annual',
                'start_date' => '2026-08-01',
                'end_date' => '2026-08-05',
            ],
            [
                'module' => 'leave',
                'record_id' => 101,
                'url' => '/leave',
                'idempotency_key' => 'leave.submitted:101:'.$approver->id,
            ]
        );

        $notifications->dispatch(
            $requester,
            'travel.approved',
            [
                'name' => $requester->name,
                'reference' => 'TR-MIG-1',
                'destination' => 'Lusaka',
                'date' => '2026-09-01',
            ],
            [
                'module' => 'travel',
                'record_id' => 202,
                'url' => '/travel',
                'idempotency_key' => 'travel.approved:202:'.$requester->id,
            ]
        );

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'leave.submitted',
            'source_module' => 'leave',
            'status' => 'published',
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'travel.approved',
            'source_module' => 'travel',
            'status' => 'published',
        ]);
        $this->assertSame(1, Notification::where('user_id', $approver->id)->where('trigger', 'leave.submitted')->count());
        $this->assertSame(1, Notification::where('user_id', $requester->id)->where('trigger', 'travel.approved')->count());
        $this->assertDatabaseHas('notification_channel_deliveries', [
            'channel' => 'email',
        ]);
    }

    public function test_external_procurement_invite_uses_outbox_not_naked_mail(): void
    {
        $tenant = Tenant::factory()->create();

        app(NotificationService::class)->dispatchExternal(
            $tenant->id,
            'vendor@example.test',
            'Vendor Co',
            'procurement.rfq_external_invite',
            [
                'name' => 'Vendor Co',
                'reference' => 'PRQ-1',
                'title' => 'Laptops',
                'register_url' => 'https://app.test/supplier/register',
                'quote_url' => 'https://app.test/external-rfq/token',
            ],
            [
                'module' => 'procurement',
                'record_id' => 55,
                'idempotency_key' => 'procurement.rfq_external:55:vendor@example.test',
            ]
        );

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'procurement.rfq_external_invite',
            'status' => 'published',
        ]);
        $this->assertDatabaseHas('notification_recipients', [
            'external_email' => 'vendor@example.test',
            'external_name' => 'Vendor Co',
        ]);
        $this->assertTrue(
            NotificationRecipient::query()->where('external_email', 'vendor@example.test')->whereNull('user_id')->exists()
        );
        Mail::assertQueued(ModuleNotificationMail::class, function (ModuleNotificationMail $mail) {
            return $mail->hasTo('vendor@example.test')
                && str_contains($mail->notifBody, '/supplier/register');
        });
    }

    public function test_tracked_mailable_weekly_summary_records_outbox_delivery(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        $run = WeeklySummaryRun::create([
            'tenant_id' => $tenant->id,
            'period_start' => now()->startOfWeek()->toDateString(),
            'period_end' => now()->endOfWeek()->toDateString(),
            'scheduled_for' => now(),
            'status' => 'running',
            'total_users' => 1,
            'total_generated' => 0,
            'total_sent' => 0,
            'total_failed' => 0,
        ]);

        $payload = ['sections' => []];
        $report = WeeklySummaryReport::create([
            'tenant_id' => $tenant->id,
            'run_id' => $run->id,
            'user_id' => $user->id,
            'scope_type' => 'personal',
            'period_start' => $run->period_start,
            'period_end' => $run->period_end,
            'status' => 'generated',
            'payload' => $payload,
            'payload_hash' => hash('sha256', json_encode($payload)),
        ]);

        app(NotificationService::class)->dispatchTrackedMailable(
            $tenant->id,
            'weekly_summary.generated',
            $user->email,
            $user->name,
            new WeeklySummaryMail($report),
            [
                'module' => 'weekly_summary',
                'record_id' => $report->id,
                'idempotency_key' => 'weekly_summary.generated:'.$report->id,
            ],
            $user,
            null,
            'SADCPFNexus Weekly Summary – test',
        );

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'weekly_summary.generated',
            'status' => 'published',
        ]);
        $this->assertDatabaseHas('notification_channel_deliveries', [
            'destination_snapshot' => $user->email,
            'channel' => 'email',
            'status' => 'sent',
        ]);
        Mail::assertQueued(WeeklySummaryMail::class);
    }

    public function test_notify_user_alias_routes_through_outbox(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeHrManager($tenant);

        app(NotificationService::class)->notifyUser(
            $user,
            'risk.submitted',
            [
                'message' => 'Privacy-safe notice',
                'module' => 'people-authority',
                'risk_code' => 'R-1',
                'title' => 'Test',
                'category' => 'ops',
                'level' => 'medium',
                'submitter' => 'Ada',
            ]
        );

        $this->assertTrue(
            NotificationOutbox::query()->where('event_type', 'risk.submitted')->where('status', 'published')->exists()
        );
        $this->assertSame(1, Notification::where('user_id', $user->id)->where('trigger', 'risk.submitted')->count());
    }

    public function test_salary_advance_audit_budget_stock_triggers_use_outbox(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $svc = app(NotificationService::class);

        foreach ([
            ['salary_advance.submitted', 'salary_advance'],
            ['audit.finding_issued', 'audit'],
            ['budget.warning', 'budget'],
            ['stock.low_stock', 'stock'],
            ['risk.kri_breached', 'risk'],
        ] as [$trigger, $module]) {
            $svc->dispatch(
                $user,
                $trigger,
                [
                    'name' => $user->name,
                    'reference' => 'X-1',
                    'amount' => '100',
                    'description' => 'line',
                    'item_code' => 'A',
                    'item_name' => 'Item',
                    'balance' => 1,
                    'reorder_level' => 2,
                    'actor' => 'Sys',
                    'kri_code' => 'K1',
                    'kri_name' => 'KRI',
                    'value' => 9,
                    'unit' => 'x',
                    'threshold' => 5,
                    'requester' => 'Ada',
                ],
                [
                    'module' => $module,
                    'record_id' => crc32($trigger),
                    'idempotency_key' => $trigger.':mig:'.$user->id,
                ]
            );
            $this->assertDatabaseHas('notification_outbox', [
                'event_type' => $trigger,
                'status' => 'published',
            ]);
        }
    }
}
