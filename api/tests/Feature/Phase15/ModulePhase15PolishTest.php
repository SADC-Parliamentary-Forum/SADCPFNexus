<?php

namespace Tests\Feature\Phase15;

use App\Models\Assignment;
use App\Models\Correspondence;
use App\Models\Department;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\Notification;
use App\Models\OvertimeAccrual;
use App\Models\OvertimeRatePolicy;
use App\Models\OvertimeSettlement;
use App\Models\Tenant;
use App\Models\ToilCredit;
use App\Models\User;
use App\Modules\Leave\Services\LeaveToilCreditService;
use App\Modules\Timesheets\Services\OvertimeService;
use Carbon\Carbon;
use Tests\TestCase;

class ModulePhase15PolishTest extends TestCase
{
    private function seedActor(): array
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Corporate Affairs',
            'code' => 'CA',
        ]);
        $creator = User::factory()->create(['tenant_id' => $tenant->id, 'department_id' => $dept->id]);
        $creator->assignRole('staff');
        $creator->givePermissionTo([
            'correspondence.view',
            'correspondence.create',
            'correspondence.registry',
        ]);
        $assignee = User::factory()->create(['tenant_id' => $tenant->id, 'department_id' => $dept->id]);
        $assignee->assignRole('staff');

        return compact('tenant', 'dept', 'creator', 'assignee');
    }

    public function test_correspondence_link_assignment_uses_from_source_idempotently(): void
    {
        extract($this->seedActor());

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'title' => 'Donor letter',
            'subject' => 'Funding follow-up',
            'body' => 'Please respond',
            'type' => 'external',
            'priority' => 'high',
            'language' => 'en',
            'status' => 'routed',
            'direction' => 'incoming',
            'primary_owner_id' => $assignee->id,
            'department_id' => $dept->id,
            'final_deadline' => now()->addDays(5)->toDateString(),
            'confidentiality' => 'internal',
        ]);

        $payload = [
            'create' => [
                'title' => 'Respond to donor letter',
                'description' => 'Draft response and clear with SG',
                'assigned_to' => $assignee->id,
                'due_date' => now()->addDays(5)->toDateString(),
            ],
        ];

        $linkId = $this->actingAs($creator, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/assignments", $payload)
            ->assertCreated()
            ->json('data.assignment_id');

        $this->assertNotNull($linkId);

        $this->actingAs($creator, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/assignments", $payload)
            ->assertCreated();

        $this->assertSame(
            1,
            Assignment::where('source_type', 'correspondence')
                ->where('source_id', $letter->id)
                ->where('source_purpose', 'action')
                ->count()
        );

        $assignment = Assignment::findOrFail($linkId);
        $this->assertSame('correspondence', $assignment->source_type);
        $this->assertSame($letter->id, (int) $assignment->source_id);
    }

    public function test_meeting_action_item_assign_uses_from_source(): void
    {
        extract($this->seedActor());

        $minutes = MeetingMinutes::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'title' => 'Management meeting',
            'meeting_date' => now()->toDateString(),
            'meeting_type' => 'management',
            'status' => 'draft',
            'chairperson' => $creator->name,
        ]);

        $item = MeetingActionItem::create([
            'meeting_minutes_id' => $minutes->id,
            'description' => 'Prepare Q3 briefing pack',
            'responsible_id' => $assignee->id,
            'deadline' => now()->addDays(7)->toDateString(),
            'status' => 'open',
        ]);

        $this->actingAs($creator, 'sanctum')
            ->postJson("/api/v1/governance/minutes/{$minutes->id}/action-items/{$item->id}/assign", [
                'assigned_to' => $assignee->id,
                'due_date' => now()->addDays(7)->toDateString(),
                'priority' => 'high',
            ])
            ->assertSuccessful();

        $assignment = Assignment::where('source_type', 'meeting_action_item')
            ->where('source_id', $item->id)
            ->first();

        $this->assertNotNull($assignment);
        $this->assertSame('Prepare Q3 briefing pack', $assignment->title);
        $this->assertNotSame('draft', $assignment->status);

        $this->actingAs($creator, 'sanctum')
            ->postJson("/api/v1/governance/minutes/{$minutes->id}/action-items/{$item->id}/assign", [
                'assigned_to' => $assignee->id,
                'due_date' => now()->addDays(7)->toDateString(),
            ])
            ->assertSuccessful();

        $this->assertSame(
            1,
            Assignment::where('source_type', 'meeting_action_item')->where('source_id', $item->id)->count()
        );
    }

    public function test_pif_from_source_endpoint_wires_for_ui(): void
    {
        extract($this->seedActor());

        $payload = [
            'title' => 'PIF M&E follow-up',
            'description' => 'Complete annex and evidence pack',
            'due_date' => now()->addDays(10)->toDateString(),
            'assigned_to' => $assignee->id,
            'source_type' => 'pif',
            'source_id' => 501,
            'source_purpose' => 'me_follow_up',
        ];

        $id = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', $payload)
            ->assertCreated()
            ->json('data.id');

        $again = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', $payload)
            ->assertCreated()
            ->json('data.id');

        $this->assertSame($id, $again);
    }

    public function test_correspondence_deadline_escalation_notifies_owner(): void
    {
        extract($this->seedActor());

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'title' => 'Overdue letter',
            'subject' => 'Needs reply',
            'body' => 'Body',
            'type' => 'external',
            'priority' => 'urgent',
            'language' => 'en',
            'status' => 'in_progress',
            'direction' => 'incoming',
            'primary_owner_id' => $assignee->id,
            'department_id' => $dept->id,
            'final_deadline' => now()->subDays(1)->toDateString(),
            'confidentiality' => 'internal',
        ]);

        $this->artisan('correspondence:escalate-deadlines')->assertSuccessful();

        $this->assertTrue(
            Notification::query()
                ->where('user_id', $assignee->id)
                ->where('trigger', 'correspondence.deadline_overdue')
                ->where('meta->record_id', $letter->id)
                ->exists()
        );

        $this->artisan('correspondence:escalate-deadlines')->assertSuccessful();
        $this->assertSame(
            1,
            Notification::query()
                ->where('user_id', $assignee->id)
                ->where('trigger', 'correspondence.deadline_overdue')
                ->where('meta->record_id', $letter->id)
                ->count()
        );
    }

    public function test_timesheet_toil_settlement_bridges_leave_toil_credit_idempotently(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');
        $supervisor = User::factory()->create(['tenant_id' => $tenant->id]);
        $supervisor->assignRole('HOD');
        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);
        $ot->ensureDefaultRatePolicy((int) $tenant->id);

        $monday = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
        $req = $ot->createRequisition($employee, [
            'work_date' => $monday,
            'planned_hours' => 2,
            'reason' => 'Phase15 TOIL bridge',
            'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
        ]);
        $ot->submitRequisition($req, $employee);
        $ot->approveRequisition($req->fresh(), $supervisor);
        $actual = $ot->recordActual($req->fresh(), $employee, ['actual_hours' => 2]);
        $actual = $ot->hrValidate($actual, $hr);

        $settlement = $ot->settle($actual->fresh(), $hr, OvertimeSettlement::TYPE_TOIL, 'phase15-toil-1');
        $this->assertNotNull($settlement->overtime_accrual_id);

        $accrual = OvertimeAccrual::findOrFail($settlement->overtime_accrual_id);
        $this->assertTrue((bool) $accrual->is_linked);
        $this->assertSame(1, ToilCredit::where('source_type', OvertimeAccrual::class)->where('source_id', $accrual->id)->count());

        app(LeaveToilCreditService::class)->ensureCreditFromOvertimeAccrual($accrual->fresh(['user']), $hr);
        $this->assertSame(1, ToilCredit::where('source_type', OvertimeAccrual::class)->where('source_id', $accrual->id)->count());
        $this->assertSame(1, OvertimeAccrual::where('code', 'OT-TOIL-'.$actual->id)->count());
    }
}
