<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\Indicator;
use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MeActivityReportService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return MeActivityReport::query()
            ->where('tenant_id', $user->tenant_id)
            ->when(!empty($filters['review_status']), fn ($q) => $q->where('review_status', $filters['review_status']))
            ->when(!empty($filters['programme_id']), fn ($q) => $q->where('programme_id', $filters['programme_id']))
            ->when(!empty($filters['thematic_area_id']), fn ($q) => $q->where('thematic_area_id', $filters['thematic_area_id']))
            ->when(!empty($filters['strategic_goal_id']), fn ($q) => $q->where('strategic_goal_id', $filters['strategic_goal_id']))
            ->when(!empty($filters['mine']) || !empty($filters['mine_only']), function ($q) use ($user) {
                $q->where(function ($qq) use ($user) {
                    $qq->where('responsible_officer_id', $user->id)
                        ->orWhere('created_by', $user->id);
                });
            })
            ->when(!empty($filters['search']), function ($q) use ($filters) {
                $q->where(function ($qq) use ($filters) {
                    $qq->where('activity_title', 'ilike', "%{$filters['search']}%")
                       ->orWhere('reference_number', 'ilike', "%{$filters['search']}%");
                });
            })
            ->with([
                'programme:id,title,reference_number,status',
                'responsibleOfficer:id,name',
                'thematicArea:id,name',
                'strategicGoal:id,title',
            ])
            ->withCount('evidence')
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function get(MeActivityReport $report): MeActivityReport
    {
        return $report->load([
            'programme:id,title,reference_number,status,strategic_pillar',
            'responsibleOfficer:id,name',
            'thematicArea:id,name',
            'strategicGoal:id,title',
            'creator:id,name',
            'reviewer:id,name',
            'indicators',
            'evidence.uploader:id,name',
            'history.actor:id,name',
            'followUps.assignee:id,name',
        ]);
    }

    /**
     * Create an activity report from an approved PIF, or a non-PIF institutional activity.
     */
    public function create(array $data, User $user): MeActivityReport
    {
        $programmeId = $data['programme_id'] ?? null;

        if ($programmeId) {
            $programme = Programme::where('id', $programmeId)
                ->where('tenant_id', $user->tenant_id)
                ->firstOrFail();

            if (! $programme->isApprovedOrAmended()) {
                throw ValidationException::withMessages([
                    'programme_id' => 'Activity reports can only be linked to an approved PIF.',
                ]);
            }

            $existing = MeActivityReport::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('programme_id', $programme->id)
                ->first();
            if ($existing) {
                return $existing->load(['programme:id,title,reference_number,status', 'indicators']);
            }
        } else {
            $programme = null;
            if (empty($data['non_pif_reason']) || strlen(trim((string) $data['non_pif_reason'])) < 5) {
                throw ValidationException::withMessages([
                    'non_pif_reason' => 'A reason is required when creating a non-PIF activity report.',
                ]);
            }
        }

        return DB::transaction(function () use ($data, $user, $programme) {
            $report = MeActivityReport::create([
                'tenant_id'              => $user->tenant_id,
                'programme_id'           => $programme?->id,
                'non_pif_reason'         => $programme ? null : trim((string) $data['non_pif_reason']),
                'activity_title'         => $data['activity_title'],
                'responsible_officer_id' => $data['responsible_officer_id'] ?? $user->id,
                'thematic_area_id'       => $data['thematic_area_id'] ?? null,
                'strategic_goal_id'      => $data['strategic_goal_id'] ?? null,
                'start_date'             => $data['start_date'] ?? null,
                'end_date'               => $data['end_date'] ?? null,
                'planned_output'         => $data['planned_output'] ?? null,
                'actual_output'          => $data['actual_output'] ?? null,
                'planned_participants'   => $data['planned_participants'] ?? null,
                'actual_participants'    => $data['actual_participants'] ?? null,
                'narrative'              => $data['narrative'] ?? null,
                'challenges'             => $data['challenges'] ?? null,
                'lessons_learned'        => $data['lessons_learned'] ?? null,
                'recommendations'        => $data['recommendations'] ?? null,
                'follow_up_actions'      => $data['follow_up_actions'] ?? null,
                'review_status'          => MeActivityReport::STATUS_NOT_SUBMITTED,
                'closure_status'         => 'open',
                'created_by'             => $user->id,
                'intake_confirmed_at'    => $programme ? null : now(),
            ]);

            if (!empty($data['indicators'])) {
                $this->syncIndicators($report, $data['indicators']);
            }

            $this->recordHistory($report, 'created', $user, null, MeActivityReport::STATUS_NOT_SUBMITTED);

            AuditLog::record('mande.activity_report.created', [
                'auditable_type' => MeActivityReport::class,
                'auditable_id'   => $report->id,
                'new_values'     => [
                    'reference_number' => $report->reference_number,
                    'programme_id'     => $programme?->id,
                    'non_pif'          => $programme === null,
                ],
                'tags'           => 'mande',
            ]);

            return $report->fresh(['programme', 'indicators']);
        });
    }

    public function update(MeActivityReport $report, array $data, User $user): MeActivityReport
    {
        if (!$report->isEditable()) {
            throw ValidationException::withMessages([
                'review_status' => 'Only reports that are not submitted or returned for correction can be edited.',
            ]);
        }

        return DB::transaction(function () use ($report, $data, $user) {
            $report->update(array_filter([
                'activity_title'         => $data['activity_title'] ?? null,
                'responsible_officer_id' => $data['responsible_officer_id'] ?? null,
                'thematic_area_id'       => array_key_exists('thematic_area_id', $data) ? $data['thematic_area_id'] : null,
                'strategic_goal_id'      => array_key_exists('strategic_goal_id', $data) ? $data['strategic_goal_id'] : null,
                'start_date'             => $data['start_date'] ?? null,
                'end_date'               => $data['end_date'] ?? null,
                'planned_output'         => $data['planned_output'] ?? null,
                'actual_output'          => $data['actual_output'] ?? null,
                'planned_participants'   => $data['planned_participants'] ?? null,
                'actual_participants'    => $data['actual_participants'] ?? null,
                'narrative'              => $data['narrative'] ?? null,
                'challenges'             => $data['challenges'] ?? null,
                'lessons_learned'        => $data['lessons_learned'] ?? null,
                'recommendations'        => $data['recommendations'] ?? null,
                'follow_up_actions'      => $data['follow_up_actions'] ?? null,
            ], fn ($v) => $v !== null));

            if (array_key_exists('indicators', $data)) {
                $this->syncIndicators($report, $data['indicators'] ?? []);
            }

            $this->recordHistory($report, 'updated', $user, $report->review_status, $report->review_status);

            AuditLog::record('mande.activity_report.updated', [
                'auditable_type' => MeActivityReport::class,
                'auditable_id'   => $report->id,
                'tags'           => 'mande',
            ]);

            return $report->fresh(['programme', 'indicators']);
        });
    }

    public function delete(MeActivityReport $report, User $user): void
    {
        if ($report->review_status !== MeActivityReport::STATUS_NOT_SUBMITTED) {
            throw ValidationException::withMessages([
                'review_status' => 'Only reports that have not been submitted can be deleted.',
            ]);
        }

        AuditLog::record('mande.activity_report.deleted', [
            'auditable_type' => MeActivityReport::class,
            'auditable_id'   => $report->id,
            'tags'           => 'mande',
        ]);

        $report->delete();
    }

    /**
     * Sync linked indicators with planned/actual values.
     *
     * @param array<int, array{indicator_id:int, planned_value?:float, actual_value?:float, notes?:string}> $indicators
     */
    public function syncIndicators(MeActivityReport $report, array $indicators): void
    {
        $sync = [];
        foreach ($indicators as $row) {
            $indicatorId = (int) ($row['indicator_id'] ?? 0);
            if ($indicatorId <= 0) {
                continue;
            }
            // Guard tenant ownership of the indicator.
            $exists = Indicator::where('id', $indicatorId)
                ->where('tenant_id', $report->tenant_id)
                ->exists();
            if (!$exists) {
                continue;
            }
            $sync[$indicatorId] = [
                'tenant_id'     => $report->tenant_id,
                'planned_value' => $row['planned_value'] ?? null,
                'actual_value'  => $row['actual_value'] ?? null,
                'notes'         => $row['notes'] ?? null,
            ];
        }
        $report->indicators()->sync($sync);
    }

    private function recordHistory(
        MeActivityReport $report,
        string $changeType,
        User $actor,
        ?string $fromStatus,
        ?string $toStatus,
        ?string $notes = null
    ): void {
        $hash = hash('sha256', json_encode([
            'report_id' => $report->id,
            'type'      => $changeType,
            'actor'     => $actor->id,
            'ts'        => now()->toISOString(),
        ]));

        $report->history()->create([
            'tenant_id'   => $report->tenant_id,
            'actor_id'    => $actor->id,
            'change_type' => $changeType,
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
            'hash'        => $hash,
            'notes'       => $notes,
        ]);
    }
}
