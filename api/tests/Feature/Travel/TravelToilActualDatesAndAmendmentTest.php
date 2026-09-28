<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TravelToilActualDatesAndAmendmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_actual_return_later_than_planned_generates_delta_candidates_idempotently(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $fri = now()->next(Carbon::FRIDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $fri->toDateString(),
            'return_date' => $fri->copy()->addDay()->toDateString(), // planned: Fri -> Sat (1 weekend day)
        ]);

        $actualReturn = $fri->copy()->addDays(3)->toDateString(); // actual: Fri -> Mon (adds Sun)

        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned", [
            'actual_return_date' => $actualReturn,
        ])->assertOk();

        $candidates = TravelToilCandidate::where('travel_request_id', $travel->id)->get();
        $this->assertSame($actualReturn, $travel->fresh()->actual_return_date->toDateString());
        // Saturday and Sunday both fall in range now — planned range only had Saturday.
        $this->assertGreaterThanOrEqual(2, $candidates->count());

        // Re-marking returned with the same actual date must not duplicate candidate rows.
        $countBefore = TravelToilCandidate::count();
        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned", [
            'actual_return_date' => $actualReturn,
        ])->assertOk();
        $this->assertSame($countBefore, TravelToilCandidate::count());
    }

    public function test_amendment_before_confirmation_regenerates_candidates_for_new_range(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $approver = $this->makeUser('Director', $tenant);

        $sat = now()->next(Carbon::SATURDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $sat->toDateString(),
            'return_date' => $sat->copy()->addDay()->toDateString(),
        ]);
        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned")->assertOk();

        $originalCandidate = TravelToilCandidate::where('travel_request_id', $travel->id)->first();
        $this->assertNotNull($originalCandidate);

        $newReturn = $sat->copy()->subDays(2)->toDateString(); // shorten mission before the weekend entirely
        $amendment = $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/amendments", [
            'changes' => ['return_date' => $newReturn],
        ])->assertCreated()->json('data');

        $this->asUser($approver)->postJson("/api/v1/travel/amendments/{$amendment['id']}/approve")
            ->assertOk();

        // The stale, never-credited candidate for the removed weekend date is gone.
        $this->assertNull(TravelToilCandidate::find($originalCandidate->id));
    }

    public function test_amendment_after_credit_flags_for_hr_review_and_leaves_credit_untouched(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);
        $approver = $this->makeUser('Director', $tenant);

        $sat = now()->next(Carbon::SATURDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $sat->toDateString(),
            'return_date' => $sat->toDateString(),
        ]);

        $candidate = TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $staff->id,
            'candidate_date' => $sat->toDateString(),
            'hours' => 8,
            'reason' => 'weekend',
            'status' => TravelToilCandidate::STATUS_CREDITED,
            'credited_at' => now(),
            'expires_at' => now()->addDays(30)->toDateString(),
        ]);
        $travel->update(['returned_at' => now()]);

        $amendment = $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/amendments", [
            'changes' => ['return_date' => $sat->copy()->addDay()->toDateString()],
        ])->assertCreated()->json('data');

        $this->asUser($approver)->postJson("/api/v1/travel/amendments/{$amendment['id']}/approve")
            ->assertOk();

        $fresh = $candidate->fresh();
        $this->assertSame(TravelToilCandidate::STATUS_AMENDMENT_REVIEW, $fresh->status);
        $this->assertNotNull($fresh->amendment_review_reason);
        // The original credit is never rewritten.
        $this->assertNotNull($fresh->credited_at);
    }

    public function test_tenant_expiry_policy_overrides_global_default(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);

        TenantSetting::setForTenant($tenant->id, 'toil_expiry_days', 90);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);
        $candidate = TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $staff->id,
            'candidate_date' => now()->toDateString(),
            'hours' => 8,
            'reason' => 'weekend',
            'status' => TravelToilCandidate::STATUS_PENDING_HR,
        ]);

        $res = $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")->assertOk();

        $expected = now()->addDays(90)->toDateString();
        $this->assertSame($expected, Carbon::parse($res->json('data.expires_at'))->toDateString());
    }
}
