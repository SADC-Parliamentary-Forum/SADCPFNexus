<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WeeklyReport;
use Tests\TestCase;

class WeeklyReportsReviewQueueTest extends TestCase
{
    /**
     * @return array{0: Tenant, 1: Department, 2: User, 3: User, 4: Department, 5: User, 6: User}
     */
    private function seedTwoTeams(): array
    {
        $tenant = Tenant::factory()->create();

        $deptA = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Corporate Services',
            'code' => 'CS-RQ',
        ]);
        $deptB = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Finance',
            'code' => 'FIN-RQ',
        ]);

        $staffA = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $deptA->id,
            'name' => 'Alice Staff',
        ]);
        $staffA->assignRole('staff');

        $hodA = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $deptA->id,
            'name' => 'Helen HOD',
        ]);
        $hodA->assignRole('HOD');
        $deptA->update(['supervisor_id' => $hodA->id]);

        $staffB = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $deptB->id,
            'name' => 'Bob Staff',
        ]);
        $staffB->assignRole('staff');

        $hodB = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $deptB->id,
            'name' => 'Frank HOD',
        ]);
        $hodB->assignRole('HOD');
        $deptB->update(['supervisor_id' => $hodB->id]);

        return [$tenant, $deptA, $staffA, $hodA, $deptB, $staffB, $hodB];
    }

    private function submitIndividual(User $employee): int
    {
        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Filed correspondence',
            ])->assertCreated();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertOk();

        return (int) $reportId;
    }

    public function test_plain_staff_are_forbidden_from_the_review_queue(): void
    {
        [, , $staffA] = $this->seedTwoTeams();
        $this->submitIndividual($staffA);

        $this->actingAs($staffA, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/review-queue')
            ->assertForbidden();
    }

    public function test_supervisor_sees_named_department_queue_not_ids_only(): void
    {
        [, $deptA, $staffA, $hodA, , $staffB] = $this->seedTwoTeams();
        $this->submitIndividual($staffA);
        $this->submitIndividual($staffB);

        $payload = $this->actingAs($hodA, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/review-queue')
            ->assertOk()
            ->json('data');

        $rows = collect($payload['team_pending_reports'] ?? []);
        $this->assertNotEmpty($rows);
        $this->assertTrue(
            $rows->every(fn ($row) => ($row['department']['name'] ?? $row['department_name'] ?? null) === $deptA->name)
        );
        $this->assertTrue($rows->contains(fn ($row) => ($row['employee_name'] ?? $row['employee']['name'] ?? null) === 'Alice Staff'));
        $this->assertFalse($rows->contains(fn ($row) => ($row['employee_name'] ?? $row['employee']['name'] ?? null) === 'Bob Staff'));
        $this->assertArrayHasKey('days_late', $rows->first());
    }

    public function test_secretary_general_sees_all_departments_by_name(): void
    {
        [$tenant, $deptA, $staffA, , $deptB, $staffB] = $this->seedTwoTeams();
        $this->submitIndividual($staffA);
        $this->submitIndividual($staffB);

        $sg = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Secretary General']);
        $sg->assignRole('Secretary General');

        $payload = $this->actingAs($sg, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/review-queue')
            ->assertOk()
            ->json('data');

        $rows = collect($payload['team_pending_reports'] ?? []);
        $names = $rows->map(fn ($row) => $row['department']['name'] ?? $row['department_name'] ?? null)->unique()->values();
        $this->assertContains($deptA->name, $names->all());
        $this->assertContains($deptB->name, $names->all());
        $this->assertGreaterThanOrEqual(2, $rows->count());
    }
}
