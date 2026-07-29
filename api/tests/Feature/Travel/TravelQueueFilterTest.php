<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use Tests\TestCase;

class TravelQueueFilterTest extends TestCase
{
    public function test_queue_list_filters_by_requester_and_date_range(): void
    {
        $tenant = Tenant::factory()->create();
        $alice = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Alice Traveller']);
        $alice->assignRole('staff');
        $bob = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Bob Traveller']);
        $bob->assignRole('staff');
        $approver = User::factory()->create(['tenant_id' => $tenant->id]);
        $approver->assignRole('Director');

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $alice->id,
            'status' => 'submitted',
            'purpose' => 'Alice early trip',
            'departure_date' => now()->addDays(5)->toDateString(),
            'return_date' => now()->addDays(8)->toDateString(),
            'destination_country' => 'Zambia',
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $bob->id,
            'status' => 'submitted',
            'purpose' => 'Bob later trip',
            'departure_date' => now()->addDays(20)->toDateString(),
            'return_date' => now()->addDays(24)->toDateString(),
            'destination_country' => 'Malawi',
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $alice->id,
            'status' => 'submitted',
            'purpose' => 'Alice far trip',
            'departure_date' => now()->addDays(40)->toDateString(),
            'return_date' => now()->addDays(45)->toDateString(),
            'destination_country' => 'Botswana',
        ]);

        $byRequester = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?queue=approval&requester_id='.$alice->id.'&per_page=100')
            ->assertOk()
            ->json('data');

        $purposes = collect($byRequester)->pluck('purpose')->all();
        $this->assertContains('Alice early trip', $purposes);
        $this->assertContains('Alice far trip', $purposes);
        $this->assertNotContains('Bob later trip', $purposes);

        $dateFrom = now()->addDays(3)->toDateString();
        $dateTo = now()->addDays(12)->toDateString();

        $byDates = $this->actingAs($approver, 'sanctum')
            ->getJson("/api/v1/travel/requests?queue=approval&date_from={$dateFrom}&date_to={$dateTo}&per_page=100")
            ->assertOk()
            ->json('data');

        $datePurposes = collect($byDates)->pluck('purpose')->all();
        $this->assertContains('Alice early trip', $datePurposes);
        $this->assertNotContains('Bob later trip', $datePurposes);
        $this->assertNotContains('Alice far trip', $datePurposes);
    }

    public function test_queue_list_filters_by_stage_status_and_sorts(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = User::factory()->create(['tenant_id' => $tenant->id]);
        $staff->assignRole('staff');
        $approver = User::factory()->create(['tenant_id' => $tenant->id]);
        $approver->assignRole('Director');

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'submitted',
            'purpose' => 'Submitted stage item',
            'departure_date' => now()->addDays(10)->toDateString(),
            'return_date' => now()->addDays(12)->toDateString(),
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'resubmitted',
            'purpose' => 'Resubmitted stage item',
            'departure_date' => now()->addDays(3)->toDateString(),
            'return_date' => now()->addDays(5)->toDateString(),
        ]);

        // Backward compat: raw status keys still filter the queue.
        $submittedOnly = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?queue=approval&stage=submitted&per_page=100')
            ->assertOk()
            ->json('data');

        $this->assertTrue(collect($submittedOnly)->every(fn ($r) => $r['status'] === 'submitted'));
        $this->assertTrue(collect($submittedOnly)->contains(fn ($r) => $r['purpose'] === 'Submitted stage item'));
        $this->assertFalse(collect($submittedOnly)->contains(fn ($r) => $r['purpose'] === 'Resubmitted stage item'));

        $sorted = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?queue=approval&sort=departure_date&sort_dir=asc&per_page=100')
            ->assertOk()
            ->json('data');

        $dates = collect($sorted)->pluck('departure_date')->map(fn ($d) => substr((string) $d, 0, 10))->values()->all();
        $sortedDates = $dates;
        sort($sortedDates);
        $this->assertSame($sortedDates, $dates);
    }

    public function test_queue_list_filters_by_computed_workflow_stage_label(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = User::factory()->create(['tenant_id' => $tenant->id]);
        $staff->assignRole('staff');
        $approver = User::factory()->create(['tenant_id' => $tenant->id]);
        $approver->assignRole('Director');

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'submitted',
            'purpose' => 'Label Submitted trip',
            'departure_date' => now()->addDays(7)->toDateString(),
            'return_date' => now()->addDays(9)->toDateString(),
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'resubmitted',
            'purpose' => 'Label Resubmitted trip',
            'departure_date' => now()->addDays(11)->toDateString(),
            'return_date' => now()->addDays(13)->toDateString(),
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'returned_for_correction',
            'purpose' => 'Label Returned trip',
            'departure_date' => now()->addDays(15)->toDateString(),
            'return_date' => now()->addDays(17)->toDateString(),
        ]);

        // Without an approvalRequest, Stage column uses status-derived labels.
        $byLabel = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?queue=approval&stage='.urlencode('Submitted').'&per_page=100')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($byLabel);
        $this->assertTrue(collect($byLabel)->every(fn ($r) => ($r['workflow_stage'] ?? null) === 'Submitted'));
        $this->assertTrue(collect($byLabel)->contains(fn ($r) => $r['purpose'] === 'Label Submitted trip'));
        $this->assertFalse(collect($byLabel)->contains(fn ($r) => $r['purpose'] === 'Label Resubmitted trip'));

        $resubmitted = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?queue=approval&stage='.urlencode('Resubmitted').'&per_page=100')
            ->assertOk()
            ->json('data');

        $this->assertTrue(collect($resubmitted)->every(fn ($r) => ($r['workflow_stage'] ?? null) === 'Resubmitted'));
        $this->assertTrue(collect($resubmitted)->contains(fn ($r) => $r['purpose'] === 'Label Resubmitted trip'));

        // Approval queue excludes returned_for_correction — label filter on full list via status scope.
        $returned = $this->actingAs($approver, 'sanctum')
            ->getJson('/api/v1/travel/requests?stage='.urlencode('Returned for correction').'&per_page=100')
            ->assertOk()
            ->json('data');

        $this->assertTrue(collect($returned)->contains(fn ($r) => $r['purpose'] === 'Label Returned trip'));
        $this->assertTrue(collect($returned)->every(
            fn ($r) => ($r['workflow_stage'] ?? null) === 'Returned for correction'
                || $r['purpose'] !== 'Label Returned trip'
        ));
        $this->assertTrue(
            collect($returned)->firstWhere('purpose', 'Label Returned trip')['workflow_stage'] === 'Returned for correction'
        );
    }
}
