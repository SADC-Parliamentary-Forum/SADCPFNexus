<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class LeaveCalendarMedicalMaskingTest extends TestCase
{
    private function seedApprovedLeave(Tenant $tenant, User $owner, string $type = 'sick'): LeaveRequest
    {
        return LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'reference_number' => 'LV-CAL-' . uniqid(),
            'leave_type' => $type,
            'start_date' => now()->startOfMonth()->addDays(3)->toDateString(),
            'end_date' => now()->startOfMonth()->addDays(5)->toDateString(),
            'days_requested' => 3,
            'reason' => 'Confidential medical reason',
            'status' => 'approved',
        ]);
    }

    public function test_hod_sees_masked_medical_leave_on_team_calendar(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);
        $this->seedApprovedLeave($tenant, $owner, 'sick');
        LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'reference_number' => 'LV-CAL-ANN-' . uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->startOfMonth()->addDays(10)->toDateString(),
            'end_date' => now()->startOfMonth()->addDays(12)->toDateString(),
            'days_requested' => 3,
            'reason' => 'Holiday',
            'status' => 'approved',
        ]);

        $rows = $this->asUser($hod)
            ->getJson('/api/v1/leave/team-calendar?from=' . now()->startOfMonth()->toDateString() . '&to=' . now()->endOfMonth()->toDateString())
            ->assertOk()
            ->json('data');

        $sick = collect($rows)->firstWhere(fn ($r) => ($r['is_masked'] ?? false) === true);
        $annual = collect($rows)->firstWhere('leave_type', 'annual');

        $this->assertNotNull($sick);
        $this->assertSame('on_leave', $sick['leave_type']);
        $this->assertSame('On leave', $sick['display_label']);
        $this->assertTrue($sick['is_masked']);
        $this->assertArrayNotHasKey('reason', $sick);
        $this->assertNotSame('Confidential medical reason', $sick['display_label'] ?? '');

        $this->assertNotNull($annual);
        $this->assertFalse($annual['is_masked'] ?? true);
        $this->assertSame('Annual leave', $annual['display_label']);
    }

    public function test_hr_manager_sees_unmasked_sick_leave_type(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $hr = $this->makeHrManager($tenant);
        $this->seedApprovedLeave($tenant, $owner, 'sick');

        $rows = $this->asUser($hr)
            ->getJson('/api/v1/leave/team-calendar?from=' . now()->startOfMonth()->toDateString() . '&to=' . now()->endOfMonth()->toDateString())
            ->assertOk()
            ->json('data');

        $sick = collect($rows)->first();
        $this->assertSame('sick', $sick['leave_type']);
        $this->assertFalse($sick['is_masked']);
        $this->assertSame('Sick leave', $sick['display_label']);
        $this->assertSame('medical', $sick['category']);
    }

    public function test_my_calendar_returns_own_leave_with_rich_fields(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $this->seedApprovedLeave($tenant, $owner, 'annual');
        $this->seedApprovedLeave($tenant, $other, 'annual');

        $rows = $this->asUser($owner)
            ->getJson('/api/v1/leave/my-calendar?from=' . now()->startOfMonth()->toDateString() . '&to=' . now()->endOfMonth()->toDateString())
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame($owner->id, $rows[0]['requester']['id']);
        $this->assertArrayHasKey('display_label', $rows[0]);
        $this->assertArrayHasKey('category', $rows[0]);
        $this->assertArrayHasKey('color_key', $rows[0]);
    }
}
