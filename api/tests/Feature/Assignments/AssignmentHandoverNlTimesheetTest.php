<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\User;
use Tests\TestCase;

class AssignmentHandoverNlTimesheetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['access_control.endpoint_enforcement_mode' => 'off']);
    }

    private function seedAssignment(Tenant $tenant, User $creator, User $assignee, array $overrides = []): Assignment
    {
        return Assignment::create(array_merge([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'title' => 'Handover briefing',
            'description' => 'Prepare the outgoing pack',
            'due_date' => now()->addDays(2)->toDateString(),
            'start_date' => now()->toDateString(),
            'status' => 'active',
            'priority' => 'high',
            'estimated_hours' => 8,
            'is_template' => false,
        ], $overrides));
    }

    public function test_handover_pack_lists_open_work_without_rankings(): void
    {
        $tenant = Tenant::factory()->create();
        $from = $this->makeUser('HOD', $tenant);
        $to = $this->makeUser('staff', $tenant);
        $open = $this->seedAssignment($tenant, $from, $from);
        $this->seedAssignment($tenant, $from, $from, ['status' => 'closed', 'title' => 'Closed ignore']);

        $pack = $this->actingAs($from, 'sanctum')
            ->getJson('/api/v1/assignments/handover-pack?from_user_id='.$from->id.'&to_user_id='.$to->id)
            ->assertOk()
            ->json('data');

        $this->assertSame($from->id, $pack['from_user_id']);
        $this->assertSame($to->id, $pack['to_user_id']);
        $this->assertFalse($pack['surveillance_ranking']);
        $ids = collect($pack['open_assignments'])->pluck('id')->all();
        $this->assertContains($open->id, $ids);
        $this->assertCount(1, $pack['open_assignments']);
        $this->assertArrayNotHasKey('performance_score', $pack);
    }

    public function test_nl_search_suggests_filters_only(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/nl-search?q='.rawurlencode('overdue high mine'))
            ->assertOk()
            ->json('data');

        $this->assertTrue($payload['filter_suggest_only']);
        $this->assertSame('mine', $payload['suggested_filters']['scope'] ?? null);
        $this->assertTrue((bool) ($payload['suggested_filters']['overdue'] ?? false));
        $this->assertSame('high', $payload['suggested_filters']['priority'] ?? null);
        $this->assertNotEmpty($payload['apply_hrefs'] ?? []);
        $this->assertArrayNotHasKey('created_assignment_id', $payload);
    }

    public function test_handover_pack_docx_is_word_and_not_a_ranking(): void
    {
        $tenant = Tenant::factory()->create();
        $from = $this->makeUser('HOD', $tenant);
        $this->seedAssignment($tenant, $from, $from);

        $res = $this->actingAs($from, 'sanctum')
            ->get('/api/v1/assignments/handover-pack.docx?from_user_id='.$from->id)
            ->assertOk();

        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            (string) $res->headers->get('Content-Type')
        );

        $tmp = tempnam(sys_get_temp_dir(), 'hpack');
        file_put_contents($tmp, (string) $res->getContent());
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tmp));
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tmp);
        $this->assertStringContainsString('not a surveillance ranking', strtolower($xml));
        $this->assertStringContainsString('Handover briefing', $xml);
    }

    public function test_timesheet_coupling_sums_logged_hours(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $assignment = $this->seedAssignment($tenant, $user, $user, ['estimated_hours' => 10]);

        $sheet = Timesheet::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'week_start' => now()->startOfWeek()->toDateString(),
            'week_end' => now()->startOfWeek()->addDays(4)->toDateString(),
            'week_number' => (int) now()->startOfWeek()->isoWeek(),
            'total_hours' => 6,
            'status' => 'draft',
        ]);
        TimesheetEntry::create([
            'timesheet_id' => $sheet->id,
            'assignment_id' => $assignment->id,
            'work_date' => now()->toDateString(),
            'hours' => 6,
            'overtime_hours' => 0,
            'source_type' => 'manual',
            'description' => 'Briefing draft',
        ]);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/'.$assignment->id.'/timesheet-hours')
            ->assertOk()
            ->json('data');

        $this->assertEquals(6, (float) $payload['logged_hours']);
        $this->assertEquals(10, (float) $payload['estimated_hours']);
        $this->assertFalse($payload['auto_complete']);
    }

    public function test_workload_forecast_is_hours_not_surveillance(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeAdmin($tenant);
        $this->seedAssignment($tenant, $user, $user, [
            'estimated_hours' => 16,
            'department_id' => $user->department_id,
        ]);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/workload-forecast?weeks=4')
            ->assertOk()
            ->json('data');

        $this->assertSame(4, $payload['weeks']);
        $this->assertFalse($payload['surveillance_ranking']);
        $this->assertNotEmpty($payload['assignees']);
        $this->assertArrayNotHasKey('performance_score', $payload);
        $this->assertArrayNotHasKey('surveillance_ranking', $payload['assignees'][0] ?? []);
    }
}
