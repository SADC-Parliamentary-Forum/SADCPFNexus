<?php

namespace Tests\Feature\Notifications;

use App\Mail\ModuleNotificationMail;
use App\Models\Notification;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationOutbox;
use App\Models\Notifications\NotificationPreference;
use App\Models\Notifications\NotificationRecipient;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\NotificationDispatchService;
use App\Modules\Notifications\Services\PolicyService;
use App\Modules\Notifications\Services\RecipientResolutionService;
use App\Modules\Notifications\Services\SecureLinkService;
use App\Modules\Notifications\Services\TemplateService;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class NotificationsPhase1Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
    }

    public function test_outbox_commits_with_business_transaction_and_consumes_idempotently(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $dispatch = app(NotificationDispatchService::class);

        DB::transaction(function () use ($dispatch, $user, $tenant) {
            $outbox = $dispatch->publishEvent([
                'tenant_id' => $tenant->id,
                'event_type' => 'workflow.approval_required',
                'source_module' => 'workflow',
                'source_id' => 99,
                'idempotency_key' => 'test-outbox-1',
                'payload' => [
                    'trigger_key' => 'workflow.approval_required',
                    'vars' => ['module_label' => 'Leave', 'reference' => 'LV-1', 'requester' => 'A', 'summary' => 'x'],
                    'meta' => ['module' => 'leave', 'record_id' => 99, 'url' => '/approvals'],
                    'recipient_instruction' => ['user_ids' => [$user->id]],
                    'send_email' => true,
                    'send_push' => false,
                ],
            ], true);
            $this->assertSame('pending', $outbox->status);
        });

        $this->assertDatabaseHas('notification_outbox', [
            'idempotency_key' => 'test-outbox-1',
            'status' => 'published',
        ]);

        $this->assertSame(1, Notification::where('user_id', $user->id)->where('trigger', 'workflow.approval_required')->count());

        // Re-consume same idempotency key — no duplicate logical send
        $dispatch->publishEvent([
            'tenant_id' => $tenant->id,
            'event_type' => 'workflow.approval_required',
            'source_module' => 'workflow',
            'source_id' => 99,
            'idempotency_key' => 'test-outbox-1',
            'payload' => [
                'trigger_key' => 'workflow.approval_required',
                'vars' => ['module_label' => 'Leave', 'reference' => 'LV-1', 'requester' => 'A', 'summary' => 'x'],
                'meta' => ['module' => 'leave', 'record_id' => 99, 'url' => '/approvals'],
                'recipient_instruction' => ['user_ids' => [$user->id]],
            ],
        ], true);

        $this->assertSame(1, Notification::where('user_id', $user->id)->where('trigger', 'workflow.approval_required')->count());
        $this->assertSame(1, NotificationRecipient::where('user_id', $user->id)->count());
    }

    public function test_recipient_resolution_returns_explicit_user(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $resolved = app(RecipientResolutionService::class)->resolve($tenant->id, [
            'user_ids' => [$user->id],
            'include_acting' => true,
            'include_delegates' => true,
        ]);

        $this->assertCount(1, $resolved);
        $this->assertSame($user->id, $resolved[0]['user']->id);
        $this->assertSame('explicit_recipient', $resolved[0]['reason']);
    }

    public function test_mandatory_override_ignores_email_preference_off(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        NotificationPreference::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'category' => 'workflow',
            'in_app_enabled' => false,
            'email_enabled' => false,
            'push_enabled' => false,
            'digest_mode' => 'off',
        ]);

        $policy = app(PolicyService::class)->resolvePolicy($tenant->id, 'workflow.approval_required');
        $this->assertTrue($policy['mandatory']);

        $decisions = app(PolicyService::class)->channelDecisions($user, $policy);
        $this->assertTrue($decisions['in_app']);
        $this->assertTrue($decisions['email']);
        $this->assertFalse($decisions['digest']);
    }

    public function test_privacy_safe_subject_for_confidential_content(): void
    {
        $tpl = app(TemplateService::class);
        $resolved = $tpl->resolve(1, 'audit.finding_issued', 'en');
        $rendered = $tpl->render($resolved, ['name' => 'Ada'], 'confidential');

        $this->assertStringContainsString('sign in', strtolower($rendered['subject']));
        $this->assertStringNotContainsString('finding detail', strtolower($rendered['subject']));
    }

    public function test_no_unauthenticated_approve_urls_in_mail(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        app(NotificationService::class)->dispatch(
            $user,
            'workflow.approval_required',
            [
                'module_label' => 'Travel',
                'reference' => 'TR-1',
                'requester' => 'Bob',
                'summary' => 'Trip',
            ],
            [
                'module' => 'travel',
                'record_id' => 1,
                'url' => '/approvals',
                'approve_url' => 'https://evil.example/approval?token=abc',
                'reject_url' => 'https://evil.example/approval?token=xyz',
                'idempotency_key' => 'no-unauth-approve-1',
            ]
        );

        $row = Notification::where('user_id', $user->id)->latest('id')->first();
        $this->assertNotNull($row);
        $this->assertArrayNotHasKey('approve_url', $row->meta ?? []);
        $this->assertArrayNotHasKey('reject_url', $row->meta ?? []);

        Mail::assertQueued(ModuleNotificationMail::class, function (ModuleNotificationMail $mail) {
            return $mail->approveUrl === null && $mail->rejectUrl === null && $mail->openUrl !== null;
        });
    }

    public function test_digest_enqueue_and_send(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        NotificationPreference::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'category' => 'operational',
            'in_app_enabled' => true,
            'email_enabled' => true,
            'push_enabled' => false,
            'digest_mode' => 'daily',
        ]);

        app(NotificationService::class)->dispatch(
            $user,
            'stock.low_stock',
            [
                'item_code' => 'PENS',
                'item_name' => 'Pens',
                'balance' => 2,
                'reorder_level' => 5,
                'actor' => 'System',
            ],
            [
                'module' => 'stock',
                'record_id' => 7,
                'url' => '/stock',
                'idempotency_key' => 'digest-stock-1',
            ]
        );

        $this->assertDatabaseHas('notification_channel_deliveries', [
            'channel' => 'email',
            'status' => 'digest_pending',
        ]);

        $sent = app(ChannelDeliveryService::class)->sendPendingDigests('daily');
        $this->assertGreaterThanOrEqual(1, $sent);
        Mail::assertQueued(ModuleNotificationMail::class);
    }

    public function test_retry_and_dead_letter_on_permanent_failure(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->email = 'not-an-email';
        $user->save();

        app(NotificationService::class)->dispatch(
            $user,
            'workflow.returned',
            [
                'module_label' => 'Leave',
                'reference' => 'LV-2',
                'comment' => 'fix',
            ],
            [
                'module' => 'leave',
                'record_id' => 2,
                'url' => '/leave/2',
                'idempotency_key' => 'dead-letter-1',
            ]
        );

        $this->assertDatabaseHas('notification_channel_deliveries', [
            'channel' => 'email',
            'status' => 'failed',
            'failure_code' => 'invalid_email',
        ]);
        $this->assertGreaterThanOrEqual(1, NotificationDeadLetter::where('tenant_id', $tenant->id)->count());
    }

    public function test_pif_regression_dispatch_creates_in_app_notification(): void
    {
        $tenant = Tenant::factory()->create();
        $officer = $this->makeUser('staff', $tenant);

        app(NotificationService::class)->dispatch(
            $officer,
            'programme.approved_for_me',
            ['reference' => 'PIF-1', 'title' => 'Workshop'],
            [
                'module' => 'programme',
                'record_id' => 55,
                'url' => '/pif/55',
                'idempotency_key' => 'pif-reg-1',
            ]
        );

        $this->assertDatabaseHas('notifications', [
            'user_id' => $officer->id,
            'trigger' => 'programme.approved_for_me',
        ]);
        $this->assertDatabaseHas('notification_outbox', [
            'idempotency_key' => 'pif-reg-1',
            'status' => 'published',
        ]);
    }

    public function test_workflow_task_assigned_path_uses_secure_route(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        app(WorkflowService::class)->initiate($leave, 'leave', $staff, 'notif-wf-1');

        $row = Notification::query()
            ->where('user_id', $manager->id)
            ->where('trigger', 'workflow.approval_required')
            ->latest('id')
            ->first();

        $this->assertNotNull($row);
        $this->assertSame('/approvals', $row->secure_route ?? ($row->meta['url'] ?? null));
        $this->assertArrayNotHasKey('approve_url', $row->meta ?? []);
    }

    public function test_secure_link_service_blocks_token_urls(): void
    {
        $svc = app(SecureLinkService::class);
        $this->assertSame('/approvals', $svc->normalizeRoute('/approval?token=abc'));
        $this->assertSame('/approvals', $svc->normalizeRoute('https://evil.test/approval?action=approve&token=x'));
        $this->assertSame('/pif/1', $svc->normalizeRoute('/pif/1'));
    }

    public function test_inbox_action_required_filter(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        Notification::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'type' => 'App\\Notifications\\ModuleNotification',
            'trigger' => 'workflow.approval_required',
            'action_required' => true,
            'subject' => 'Action',
            'body' => 'Body',
            'is_read' => false,
        ]);

        $http->getJson('/api/v1/notifications?filter=action_required')
            ->assertOk()
            ->assertJsonPath('data.0.action_required', true);
    }

    private function makeLeave(Tenant $tenant, $staff): \App\Models\LeaveRequest
    {
        return \App\Models\LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'reference_number' => 'LV-NOTIF-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'days_requested' => 2,
            'reason' => 'Notifications phase1 test',
            'status' => 'draft',
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $steps
     */
    private function seedWorkflow(Tenant $tenant, string $module, array $steps): \App\Models\ApprovalWorkflow
    {
        $wf = \App\Models\ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => "Notif Test {$module}"],
            ['module_type' => $module, 'is_active' => true, 'definition_status' => 'published']
        );
        $wf->steps()->delete();
        foreach ($steps as $i => $step) {
            $payload = $step;
            $payload['step_order'] = $payload['step_order'] ?? $i;
            $payload['actor_selector'] = $payload['actor_selector'] ?? $payload['approver_type'];
            $wf->steps()->create($payload);
        }

        return $wf->fresh('steps');
    }
}
