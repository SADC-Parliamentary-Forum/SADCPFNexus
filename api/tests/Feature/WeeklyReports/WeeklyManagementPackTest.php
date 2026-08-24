<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Department;
use App\Models\Tenant;
use Tests\TestCase;

class WeeklyManagementPackTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['access_control.endpoint_enforcement_mode' => 'off']);
    }

    public function test_management_pack_is_richer_word_and_does_not_auto_send(): void
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create(['tenant_id' => $tenant->id, 'name' => 'Ops', 'code' => 'OPS-MP']);
        $employee = $this->makeAdmin($tenant);
        $employee->department_id = $dept->id;
        $employee->save();

        $report = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/'.$report['id'].'/items', [
                'section_type' => 'achievement',
                'title' => 'Filed plenary pack',
                'narrative' => 'Minutes circulated to HODs.',
            ])->assertCreated();

        $res = $this->actingAs($employee, 'sanctum')
            ->get('/api/v1/weekly-summaries/'.$report['id'].'/export/management-pack')
            ->assertOk();

        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            (string) $res->headers->get('Content-Type')
        );
        $this->assertStringContainsString('attachment', (string) $res->headers->get('Content-Disposition'));
        $this->assertGreaterThan(100, strlen((string) $res->getContent()));
        $this->assertNull($res->headers->get('X-Auto-Send'));

        $tmp = tempnam(sys_get_temp_dir(), 'mpack');
        file_put_contents($tmp, (string) $res->getContent());
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tmp));
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tmp);
        $this->assertStringContainsString('Assignment feed', $xml);
        $this->assertStringContainsString('not auto-sent', $xml);
        $this->assertStringContainsString('Emerging risks', $xml);
    }
}
