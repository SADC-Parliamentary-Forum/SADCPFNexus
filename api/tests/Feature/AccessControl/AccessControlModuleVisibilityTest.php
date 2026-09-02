<?php

namespace Tests\Feature\AccessControl;

use App\Models\HrIncident;
use App\Models\Tenant;
use App\Models\TravelMission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccessControlModuleVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_cannot_open_organisation_module_apis(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/finance/budgets')->assertForbidden();
        $http->getJson('/api/v1/finance/balance-register/dashboard')->assertForbidden();
        $http->getJson('/api/v1/budget/variance')->assertForbidden();
        $http->getJson('/api/v1/travel/toil')->assertForbidden();
        $http->getJson('/api/v1/travel/missions')->assertForbidden();
        $http->getJson('/api/v1/travel/fleet-vehicles')->assertForbidden();
        $http->getJson('/api/v1/assets')->assertForbidden();
        $http->getJson('/api/v1/hr/profile-requests')->assertForbidden();
    }

    public function test_staff_navigation_hides_organisation_hubs_they_do_not_hold(): void
    {
        [$http] = $this->asStaff();

        $labels = collect($http->getJson('/api/v1/access/navigation')->assertOk()->json('data.items'))
            ->pluck('label')
            ->all();

        $this->assertNotContains('Finance', $labels);
        $this->assertNotContains('HR', $labels);
        $this->assertNotContains('Assets', $labels);
        $this->assertNotContains('Fixed Assets', $labels);

        $items = $http->getJson('/api/v1/access/navigation')->json('data.items');

        $assertCreateOnly = function (array $item, string $createHref, array $hubHrefs): void {
            $this->assertFalse((bool) ($item['linkable'] ?? true));
            $this->assertNull($item['href']);
            $childHrefs = collect($item['children'] ?? [])->pluck('href')->all();
            $this->assertContains($createHref, $childHrefs);
            foreach ($hubHrefs as $href) {
                $this->assertNotContains($href, $childHrefs);
            }
        };

        $travel = collect($items)->firstWhere('label', 'Travel');
        $this->assertNotNull($travel);
        $assertCreateOnly($travel, '/travel/create', ['/travel', '/travel/missions', '/travel/register']);

        $procurement = collect($items)->firstWhere('label', 'Procurement');
        $this->assertNotNull($procurement);
        $assertCreateOnly($procurement, '/procurement/create', ['/procurement', '/procurement/vendors']);
    }

    public function test_finance_controller_can_open_travel_missions_and_budget_hubs(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $mission = TravelMission::create([
            'tenant_id' => $tenant->id,
            'title' => 'Windhoek briefing',
            'destination_country' => 'Namibia',
            'destination_city' => 'Windhoek',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(),
            'created_by' => $staff->id,
        ]);

        [$http] = $this->asFinanceController($tenant);
        $http->getJson('/api/v1/travel/missions')->assertOk();
        $http->getJson("/api/v1/travel/missions/{$mission->id}")->assertOk();
        $http->getJson('/api/v1/finance/budgets')->assertOk();
        $http->getJson('/api/v1/finance/balance-register/dashboard')->assertOk();
    }

    public function test_staff_cannot_list_other_employees_hr_incidents(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $staff] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);

        HrIncident::create([
            'tenant_id' => $tenant->id,
            'reported_by' => $other->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject' => 'Other person incident',
            'severity' => 'low',
            'status' => 'reported',
        ]);
        $own = HrIncident::create([
            'tenant_id' => $tenant->id,
            'reported_by' => $staff->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject' => 'My incident',
            'severity' => 'low',
            'status' => 'reported',
        ]);

        $response = $http->getJson('/api/v1/hr/incidents')->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($own->id, $ids);
        $this->assertNotContains(
            HrIncident::where('reported_by', $other->id)->value('id'),
            $ids
        );
    }
}
