<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\MeSetting;
use App\Models\Programme;
use App\Models\Tenant;
use App\Modules\MAndE\Services\MeIntakeService;
use App\Modules\Programmes\Services\ProgrammeService;
use Tests\TestCase;

class MeIntakeIdempotencyTest extends TestCase
{
    public function test_ensure_for_programme_is_idempotent(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeAdmin($tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Intake Idempotent',
            'status'           => 'approved',
            'approved_at'      => now(),
            'start_date'       => now()->subDays(2)->toDateString(),
            'end_date'         => now()->subDay()->toDateString(),
        ]);

        $service = app(MeIntakeService::class);
        $first = $service->ensureForProgramme($programme, $user);
        $second = $service->ensureForProgramme($programme, $user);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, MeActivityReport::where('programme_id', $programme->id)->count());
    }

    public function test_approve_creates_shell_when_auto_intake_on(): void
    {
        $tenant = Tenant::factory()->create();
        $creator = $this->makeUser('staff', $tenant);
        $approver = $this->makeSG($tenant);

        MeSetting::create([
            'tenant_id'                => $tenant->id,
            'auto_intake'             => true,
            'report_due_days'          => 14,
            'programme_manager_review' => false,
        ]);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $creator->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Auto Intake On',
            'status'           => 'submitted',
            'submitted_at'     => now(),
            'start_date'       => now()->toDateString(),
            'end_date'         => now()->addDays(3)->toDateString(),
        ]);

        app(ProgrammeService::class)->approve($programme, $approver);

        $this->assertSame(1, MeActivityReport::where('programme_id', $programme->id)->count());
        $this->assertSame('intake_pending', $programme->fresh()->me_status);
    }

    public function test_approve_skips_create_when_auto_intake_off(): void
    {
        $tenant = Tenant::factory()->create();
        $creator = $this->makeUser('staff', $tenant);
        $approver = $this->makeSG($tenant);

        MeSetting::create([
            'tenant_id'                => $tenant->id,
            'auto_intake'             => false,
            'report_due_days'          => 14,
            'programme_manager_review' => false,
        ]);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $creator->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Auto Intake Off',
            'status'           => 'submitted',
            'submitted_at'     => now(),
        ]);

        app(ProgrammeService::class)->approve($programme, $approver);

        $this->assertSame(0, MeActivityReport::where('programme_id', $programme->id)->count());
        $this->assertSame('not_yet_linked', $programme->fresh()->me_status);
    }
}
