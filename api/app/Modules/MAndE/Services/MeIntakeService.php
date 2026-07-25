<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MeIntakeService
{
    public function __construct(private readonly MeSettingsService $settings) {}

    /**
     * Ensure a single M&E activity report shell exists for an approved/amended PIF.
     * Idempotent: returns the existing non-deleted report when already linked.
     */
    public function ensureForProgramme(Programme $programme, ?User $actor = null): MeActivityReport
    {
        if (! $programme->isApprovedOrAmended()) {
            throw ValidationException::withMessages([
                'programme_id' => 'Activity reports can only be linked to an approved PIF.',
            ]);
        }

        $existing = MeActivityReport::query()
            ->where('tenant_id', $programme->tenant_id)
            ->where('programme_id', $programme->id)
            ->first();

        if ($existing) {
            return $existing;
        }

        $settings = $this->settings->forTenant((int) $programme->tenant_id);
        $endDate = $programme->end_date ?? $programme->start_date;
        $dueAt = $endDate
            ? $endDate->copy()->addDays((int) $settings->report_due_days)
            : now()->addDays((int) $settings->report_due_days);

        $officerId = $programme->responsible_officer_id
            ?? $programme->created_by
            ?? $actor?->id;

        return DB::transaction(function () use ($programme, $actor, $officerId, $dueAt, $endDate) {
            $report = MeActivityReport::create([
                'tenant_id'              => $programme->tenant_id,
                'programme_id'           => $programme->id,
                'activity_title'         => $programme->title,
                'responsible_officer_id' => $officerId,
                'start_date'             => $programme->start_date,
                'end_date'               => $endDate,
                'planned_participants'   => is_numeric($programme->proposed_participants ?? null)
                    ? (int) $programme->proposed_participants
                    : (is_numeric($programme->budgeted_participants ?? null)
                        ? (int) $programme->budgeted_participants
                        : null),
                'planned_output'         => is_string($programme->expected_outputs ?? null)
                    ? $programme->expected_outputs
                    : (is_string($programme->overall_objective ?? null) ? $programme->overall_objective : null),
                'review_status'          => MeActivityReport::STATUS_NOT_SUBMITTED,
                'created_by'             => $actor?->id ?? $officerId,
                'report_due_at'          => $dueAt,
                'intake_confirmed_at'    => null,
            ]);

            AuditLog::record('mande.intake_created', [
                'auditable_type' => MeActivityReport::class,
                'auditable_id'   => $report->id,
                'new_values'     => [
                    'programme_id'     => $programme->id,
                    'reference_number' => $report->reference_number,
                ],
                'tags'           => 'mande',
            ]);

            return $report;
        });
    }

    public function markNotReportable(Programme $programme, User $actor, string $reason): MeActivityReport
    {
        $report = $this->ensureForProgramme($programme, $actor);
        $report->update([
            'review_status'         => MeActivityReport::STATUS_NOT_REPORTABLE,
            'not_reportable_reason' => $reason,
            'not_reportable_by'     => $actor->id,
            'not_reportable_at'     => now(),
            'intake_confirmed_at'   => now(),
        ]);

        AuditLog::record('mande.marked_not_reportable', [
            'auditable_type' => MeActivityReport::class,
            'auditable_id'   => $report->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'mande',
        ]);

        return $report->fresh();
    }
}
