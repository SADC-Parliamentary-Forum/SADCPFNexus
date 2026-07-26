<?php

namespace Tests\Feature\Travel;

use App\Models\Asset;
use App\Models\BudgetReservation;
use App\Models\Notification;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\TravelSponsoredDeductionRate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class TravelModuleFinishTest extends TestCase
{
    private function attachDoc(TravelRequest $travel, int $userId, string $type): void
    {
        $travel->attachments()->create([
            'tenant_id'         => $travel->tenant_id,
            'uploaded_by'       => $userId,
            'original_filename' => "{$type}.pdf",
            'storage_path'      => "travel/{$travel->id}/{$type}.pdf",
            'mime_type'         => 'application/pdf',
            'size_bytes'        => 100,
            'document_type'     => $type,
        ]);
    }

    public function test_sg_approve_creates_budget_reservation_and_cancel_releases_it(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $sg = $this->makeUser('Secretary General', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'submitted',
            'submitted_at' => now(),
            'estimated_dsa' => 1500,
            'finance_dsa_total' => 1200,
            'currency' => 'NAD',
        ]);
        $travel->fundingLines()->create([
            'item' => 'Per Diems',
            'forum_amount' => 1200,
            'budget_line' => 'TRAVEL-2026-01',
            'sort_order' => 1,
            'payor_sadc_pf' => true,
        ]);

        $this->asUser($sg)->postJson("/api/v1/travel/requests/{$travel->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('budget_reservations', [
            'travel_request_id' => $travel->id,
            'budget_line' => 'TRAVEL-2026-01',
            'released_at' => null,
        ]);

        $reservation = BudgetReservation::where('travel_request_id', $travel->id)->first();
        $this->assertNotNull($reservation);
        $this->assertNull($reservation->released_at);
        $this->assertGreaterThan(0, (float) $reservation->reserved_amount);

        $this->asUser($sg)->postJson("/api/v1/travel/requests/{$travel->id}/cancel", [
            'reason' => 'Mission postponed by host',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $reservation->refresh();
        $this->assertNotNull($reservation->released_at);
    }

    public function test_sponsored_deduction_rates_apply_in_finance_dsa_defaults(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeFinanceController($tenant);

        TravelSponsoredDeductionRate::create([
            'tenant_id' => $tenant->id,
            'name' => 'Host meals provided',
            'code' => 'host_meals',
            'meal_deduction_percent' => 40,
            'accommodation_deduction_percent' => 0,
            'is_active' => true,
        ]);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => Carbon::now()->addDays(5)->toDateString(),
            'return_date' => Carbon::now()->addDays(7)->toDateString(),
            'destination_country' => 'Namibia',
            'sponsored_deduction_rate_id' => TravelSponsoredDeductionRate::first()->id,
        ]);

        // Seed a DSA rate so default lines have a daily rate
        \App\Models\DsaRate::create([
            'tenant_id' => $tenant->id,
            'country' => 'Namibia',
            'rate_type' => 1,
            'rate_per_day' => 100,
            'currency' => 'USD',
            'meal_component' => 40,
            'accommodation_component' => 50,
            'incidentals_component' => 10,
            'is_active' => true,
            'version' => 1,
        ]);

        $res = $this->asUser($finance)->postJson("/api/v1/travel/requests/{$travel->id}/dsa", [
            'rate_type' => 1,
        ])->assertOk();

        $lines = $res->json('data.dsa_lines') ?? $res->json('data.dsaLines');
        $this->assertNotEmpty($lines);
        $official = collect($lines)->firstWhere('is_personal', false) ?? $lines[0];
        // 40% of meal_component 40 = 16
        $this->assertEquals(16.0, (float) ($official['meal_deduction'] ?? 0));
    }

    public function test_sponsored_deduction_rate_crud_in_settings(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);

        $create = $this->asUser($finance)->postJson('/api/v1/travel/sponsored-deduction-rates', [
            'name' => 'Donor accommodation top-up',
            'code' => 'donor_accom',
            'meal_deduction_percent' => 0,
            'accommodation_deduction_percent' => 100,
            'is_active' => true,
        ])->assertCreated();

        $id = $create->json('data.id');
        $this->assertNotNull($id);

        $this->asUser($finance)->getJson('/api/v1/travel/sponsored-deduction-rates')
            ->assertOk()
            ->assertJsonFragment(['code' => 'donor_accom']);
    }

    public function test_admin_vehicle_assign_warns_on_conflict(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        $vehicle = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'VH-TEST-001',
            'name' => 'Toyota Hilux',
            'category' => 'fleet',
            'status' => 'active',
            'value' => 100000,
        ]);

        $other = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => Carbon::now()->addDays(10)->toDateString(),
            'return_date' => Carbon::now()->addDays(14)->toDateString(),
            'vehicle_asset_id' => $vehicle->id,
            'vehicle_type' => 'sadcpf',
        ]);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => Carbon::now()->addDays(12)->toDateString(),
            'return_date' => Carbon::now()->addDays(16)->toDateString(),
            'vehicle_type' => 'sadcpf',
        ]);

        $res = $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/assign-vehicle", [
            'vehicle_asset_id' => $vehicle->id,
            'acknowledge_conflicts' => false,
        ]);
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['vehicle_conflicts']);

        $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/assign-vehicle", [
            'vehicle_asset_id' => $vehicle->id,
            'acknowledge_conflicts' => true,
            'conflict_resolution_note' => 'Shared convoy — Admin OK',
        ])->assertOk()
            ->assertJsonPath('data.vehicle_asset_id', $vehicle->id);

        $this->assertSame($other->id, TravelRequest::find($other->id)->id);
    }

    public function test_travellers_list_available_for_prepare_for_others(): void
    {
        $tenant = Tenant::factory()->create();
        $preparer = $this->makeUser('staff', $tenant);
        $preparer->givePermissionTo('travel.prepare-for-others');
        $other = $this->makeUser('staff', $tenant);

        $res = $this->asUser($preparer)->getJson('/api/v1/travel/travellers')
            ->assertOk();

        $ids = collect($res->json('data'))->pluck('id')->all();
        $this->assertContains($other->id, $ids);
    }

    public function test_overdue_retirement_command_marks_and_notifies(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->makeFinanceController($tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'returned_at' => now()->subDays(10),
            'retirement_status' => 'pending',
            'retirement_due_at' => Carbon::yesterday()->toDateString(),
        ]);

        Artisan::call('travel:mark-overdue-retirements');

        $travel->refresh();
        $this->assertSame('overdue', $travel->retirement_status);

        $this->assertTrue(
            Notification::where('user_id', $staff->id)
                ->where('trigger', 'travel.retirement_overdue')
                ->exists()
        );
    }

    public function test_reports_pack_includes_section76_slices_and_csv_export(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('Administration Officer', $tenant);
        $admin->givePermissionTo('travel.export');

        TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $admin->id,
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $pack = $this->asUser($admin)->getJson('/api/v1/travel/reports/pack')->assertOk()->json('data');
        foreach ([
            'travel_register', 'upcoming_travel', 'by_department', 'by_programme', 'by_donor',
            'dsa_summary', 'cancellations', 'amendments', 'outstanding_retirement',
            'toil_candidates', 'visa_status',
        ] as $key) {
            $this->assertArrayHasKey($key, $pack, "Missing pack key {$key}");
        }

        $csv = $this->asUser($admin)->get('/api/v1/travel/reports/pack/export?slice=travel_register&format=csv');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
    }

    public function test_personal_days_can_be_updated_on_detail(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $dep = Carbon::now()->addDays(20)->toDateString();
        $ret = Carbon::now()->addDays(24)->toDateString();
        $personal = Carbon::now()->addDays(22)->toDateString();

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'departure_date' => $dep,
            'return_date' => $ret,
        ]);

        $this->asUser($staff)->patchJson("/api/v1/travel/requests/{$travel->id}/personal-days", [
            'days' => [
                ['date' => $dep, 'type' => 'official'],
                ['date' => $personal, 'type' => 'personal'],
                ['date' => $ret, 'type' => 'official'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.official_personal_days.1.type', 'personal');
    }

    public function test_link_imprest_from_travel_creates_draft_with_travel_id(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'returned_at' => now(),
            'retirement_status' => 'pending',
            'finance_dsa_total' => 800,
            'currency' => 'NAD',
        ]);

        $res = $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/link-imprest", [
            'amount_requested' => 800,
            'purpose' => 'Travel retirement imprest',
        ])->assertCreated();

        $this->assertSame($travel->id, $res->json('data.travel_request_id'));
        $this->assertDatabaseHas('imprest_requests', [
            'travel_request_id' => $travel->id,
            'requester_id' => $staff->id,
        ]);
    }

    public function test_mark_returned_notifies_toil_candidate_when_weekend_travel(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        // Saturday–Sunday window
        $sat = Carbon::now()->next(Carbon::SATURDAY)->toDateString();
        $sun = Carbon::parse($sat)->addDay()->toDateString();

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $sat,
            'return_date' => $sun,
        ]);
        $this->attachDoc($travel, $staff->id, 'mission_report');

        $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned")
            ->assertOk();

        $this->assertTrue(
            Notification::where('user_id', $staff->id)
                ->where('trigger', 'travel.toil_candidate')
                ->exists()
        );
    }
}
