<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use App\Models\Vendor;
use App\Models\VendorPerformanceEvaluation;
use Tests\TestCase;

class VendorPerformanceStarsTest extends TestCase
{
    private function makeVendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Rated Supplier Ltd',
            'is_approved' => true,
            'is_active'   => true,
        ]);
    }

    private function evaluationScores(int $score): array
    {
        return [
            'delivery_score'      => $score,
            'quality_score'       => $score,
            'price_score'         => $score,
            'compliance_score'    => $score,
            'communication_score' => $score,
        ];
    }

    public function test_derived_stars_from_evaluation_overall_score(): void
    {
        $tenant = Tenant::factory()->create();
        $actor  = $this->makeProcurementOfficer($tenant);
        $vendor = $this->makeVendor($tenant);

        foreach ([5 => 5, 4 => 4, 3 => 3, 2 => 2, 1 => 1] as $score => $expectedStars) {
            VendorPerformanceEvaluation::where('vendor_id', $vendor->id)->delete();

            VendorPerformanceEvaluation::create(array_merge([
                'tenant_id'    => $tenant->id,
                'vendor_id'    => $vendor->id,
                'evaluated_by' => $actor->id,
            ], $this->evaluationScores($score)));

            $vendor->refresh();
            $this->assertSame($expectedStars, $vendor->derived_star_rating, "Score {$score} should map to {$expectedStars} stars");
        }
    }

    public function test_derived_stars_null_when_no_evaluations(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makeVendor($tenant);

        $this->assertNull($vendor->derived_star_rating);
    }

    public function test_derived_stars_mean_of_all_evaluations(): void
    {
        $tenant = Tenant::factory()->create();
        $actor  = $this->makeProcurementOfficer($tenant);
        $vendor = $this->makeVendor($tenant);

        foreach ([5, 3] as $score) {
            VendorPerformanceEvaluation::create(array_merge([
                'tenant_id'    => $tenant->id,
                'vendor_id'    => $vendor->id,
                'evaluated_by' => $actor->id,
            ], $this->evaluationScores($score)));
        }

        // Mean overall = (5 + 3) / 2 = 4 → 80% → 4 stars
        $vendor->refresh();
        $this->assertSame(4, $vendor->derived_star_rating);
    }

    public function test_vendor_show_includes_derived_star_rating(): void
    {
        $tenant = Tenant::factory()->create();
        $actor  = $this->makeProcurementOfficer($tenant);
        $vendor = $this->makeVendor($tenant);

        VendorPerformanceEvaluation::create(array_merge([
            'tenant_id'    => $tenant->id,
            'vendor_id'    => $vendor->id,
            'evaluated_by' => $actor->id,
        ], $this->evaluationScores(5)));

        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson("/api/v1/procurement/vendors/{$vendor->id}")
            ->assertOk()
            ->assertJsonPath('data.derived_star_rating', 5);
    }

    public function test_free_form_vendor_rating_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makeVendor($tenant);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/ratings", [
            'rating' => 5,
            'review' => 'Great supplier',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['rating']);
    }

    public function test_performance_evaluation_create_still_works(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makeVendor($tenant);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/vendors/{$vendor->id}/evaluations", [
            'delivery_score'      => 5,
            'quality_score'       => 5,
            'price_score'         => 4,
            'compliance_score'    => 5,
            'communication_score' => 4,
            'notes'               => 'Reliable deliveries.',
        ])->assertCreated();

        $this->assertDatabaseHas('vendor_performance_evaluations', [
            'vendor_id' => $vendor->id,
        ]);
    }
}
