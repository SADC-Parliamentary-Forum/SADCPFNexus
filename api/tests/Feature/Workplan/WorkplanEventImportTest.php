<?php

namespace Tests\Feature\Workplan;

use App\Models\MeetingType;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class WorkplanEventImportTest extends TestCase
{
    public function test_guest_cannot_download_workplan_import_template(): void
    {
        $this->getJson('/api/v1/workplan/events/import/template')->assertUnauthorized();
    }

    public function test_staff_can_download_csv_template_with_expected_headers(): void
    {
        [$http] = $this->asStaff();

        $res = $http->get('/api/v1/workplan/events/import/template')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $csv = (string) $res->getContent();
        $this->assertStringContainsString('title,type,date,end_date,description,meeting_type,responsible,responsible_emails', $csv);
        $this->assertStringContainsString('Plenary Session', $csv);
        $res->assertHeader('content-disposition', 'attachment; filename="workplan-events-template.csv"');
    }

    public function test_staff_can_import_csv_and_creates_events(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        MeetingType::query()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Plenary',
            'sort_order' => 1,
        ]);

        $csv = implode("\n", [
            'title,type,date,end_date,description,meeting_type,responsible,responsible_emails',
            'Plenary Session,meeting,2026-10-01,2026-10-03,Annual plenary,Plenary,Secretariat,',
            'Budget deadline,deadline,2026-11-30,,Finance close-out,,,',
        ]);
        $file = UploadedFile::fake()->createWithContent('workplan-events.csv', $csv);

        $http->post('/api/v1/workplan/events/import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created_count', 2)
            ->assertJsonPath('data.error_count', 0);

        $this->assertDatabaseHas('workplan_events', [
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Plenary Session',
            'type' => 'meeting',
            'description' => 'Annual plenary',
        ]);
        $this->assertDatabaseHas('workplan_events', [
            'tenant_id' => $tenant->id,
            'title' => 'Budget deadline',
            'type' => 'deadline',
        ]);
    }

    public function test_import_reports_row_errors_and_still_creates_valid_rows(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $csv = implode("\n", [
            'title,type,date,end_date,description,meeting_type,responsible,responsible_emails',
            'Valid workshop,meeting,2026-09-15,,Team planning,,,',
            ',meeting,2026-09-16,,,,,',
            'Missing date,deadline,,,,,',
        ]);
        $file = UploadedFile::fake()->createWithContent('workplan-events.csv', $csv);

        $http->post('/api/v1/workplan/events/import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.error_count', 2);

        $this->assertDatabaseHas('workplan_events', [
            'tenant_id' => $tenant->id,
            'title' => 'Valid workshop',
        ]);
        $this->assertDatabaseMissing('workplan_events', [
            'tenant_id' => $tenant->id,
            'title' => 'Missing date',
        ]);
    }

    public function test_import_skips_duplicate_title_and_date_for_the_same_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        WorkplanEvent::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Existing briefing',
            'type' => 'meeting',
            'date' => '2026-09-20',
        ]);

        $csv = implode("\n", [
            'title,type,date,end_date,description,meeting_type,responsible,responsible_emails',
            'Existing briefing,meeting,2026-09-20,,,,,',
        ]);
        $file = UploadedFile::fake()->createWithContent('workplan-events.csv', $csv);

        $http->post('/api/v1/workplan/events/import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created_count', 0)
            ->assertJsonPath('data.error_count', 1)
            ->assertJsonPath('data.errors.0.row', 2);

        $this->assertSame(1, WorkplanEvent::query()->where('tenant_id', $tenant->id)->where('title', 'Existing briefing')->count());
    }

    public function test_import_resolves_responsible_staff_by_email(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $owner = User::factory()->create([
            'tenant_id' => $tenant->id,
            'email' => 'amina.banda@sadcpf.org',
            'name' => 'Amina Banda',
        ]);

        $csv = implode("\n", [
            'title,type,date,end_date,description,meeting_type,responsible,responsible_emails',
            'Field visit,travel,2026-08-12,2026-08-14,,,Amina,amina.banda@sadcpf.org',
        ]);
        $file = UploadedFile::fake()->createWithContent('workplan-events.csv', $csv);

        $http->post('/api/v1/workplan/events/import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created_count', 1);

        $event = WorkplanEvent::query()->where('title', 'Field visit')->first();
        $this->assertNotNull($event);
        $this->assertTrue($event->responsibleUsers()->where('users.id', $owner->id)->exists());
    }

    public function test_import_rejects_empty_csv(): void
    {
        [$http] = $this->asStaff();
        $file = UploadedFile::fake()->createWithContent('empty.csv', '');

        $http->post('/api/v1/workplan/events/import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);
    }
}
