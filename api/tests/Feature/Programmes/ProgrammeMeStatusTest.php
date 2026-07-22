<?php

namespace Tests\Feature\Programmes;

use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeMeStatusTest extends TestCase
{
    private function approvedProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'ME Status Test',
            'status'           => 'approved',
            'approved_at'      => now(),
        ]);
    }

    public function test_me_status_is_not_yet_linked_when_no_report_exists(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $this->assertSame('not_yet_linked', $programme->me_status);
    }

    /** @dataProvider reviewStatusProvider */
    public function test_me_status_maps_each_review_status(string $reviewStatus, string $expected): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => $programme->id,
            'activity_title' => 'ME Status Test',
            'review_status'  => $reviewStatus,
            'created_by'     => $user->id,
        ]);

        $this->assertSame($expected, $programme->fresh()->me_status);
    }

    public static function reviewStatusProvider(): array
    {
        return [
            'not submitted' => [MeActivityReport::STATUS_NOT_SUBMITTED, 'report_pending'],
            'submitted'     => [MeActivityReport::STATUS_SUBMITTED, 'report_submitted'],
            'returned'      => [MeActivityReport::STATUS_RETURNED, 'returned_for_correction'],
            'reviewed'      => [MeActivityReport::STATUS_REVIEWED, 'me_reviewed'],
            'accepted'      => [MeActivityReport::STATUS_ACCEPTED, 'accepted'],
            'closed'        => [MeActivityReport::STATUS_CLOSED, 'closed'],
        ];
    }

    public function test_me_status_is_archived_when_linked_report_was_soft_deleted(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $report = MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => $programme->id,
            'activity_title' => 'ME Status Test',
            'review_status'  => MeActivityReport::STATUS_SUBMITTED,
            'created_by'     => $user->id,
        ]);
        $report->delete();

        $this->assertSame('linked_record_archived', $programme->fresh()->me_status);
    }

    /**
     * The 9th state ("link_unavailable") is the `default` branch of the match
     * expression in Programme::getMeStatusAttribute() — it fires only when a
     * linked MeActivityReport has a `review_status` value outside
     * MeActivityReport::STATUSES. In normal application flow this is
     * unreachable: every write path (form requests, service methods, the
     * MeActivityReport factory) constrains review_status to one of the six
     * STATUSES constants, and there is no enum/CHECK constraint at the DB
     * level enforcing that, so it's a defensive default rather than a
     * reachable business state. We force it here by bypassing normal
     * creation/validation and writing an unmapped value directly via
     * a mass update, simulating e.g. bad data from a future migration,
     * manual DB edit, or an application bug that lets an invalid value slip
     * through — exactly the scenario the accessor's default branch guards
     * against.
     */
    public function test_me_status_is_link_unavailable_for_an_unmapped_review_status(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $report = MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => $programme->id,
            'activity_title' => 'ME Status Test',
            'review_status'  => MeActivityReport::STATUS_NOT_SUBMITTED,
            'created_by'     => $user->id,
        ]);
        // Bypass the model/casts and write a value outside MeActivityReport::STATUSES
        // directly to the column, simulating corrupted/unexpected data.
        MeActivityReport::withoutEvents(function () use ($report) {
            $report->newQueryWithoutScopes()
                ->where('id', $report->id)
                ->update(['review_status' => 'unexpected_status']);
        });

        $this->assertSame('link_unavailable', $programme->fresh()->me_status);
    }

    public function test_me_status_is_included_in_the_show_response(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $http->getJson("/api/v1/programmes/{$programme->id}")
            ->assertOk()
            ->assertJsonPath('me_status', 'not_yet_linked');
    }
}
