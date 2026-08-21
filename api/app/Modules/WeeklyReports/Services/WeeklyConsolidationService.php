<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportBlocker;
use App\Models\WeeklyReportConsolidationLink;
use App\Models\WeeklyReportDecisionRequest;
use App\Models\WeeklyReportItem;
use App\Models\WeeklyReportPriority;
use App\Models\WeeklyReportRisk;
use App\Models\WeeklyReportingPeriod;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WeeklyConsolidationService
{
    public function __construct(
        private readonly WeeklyPeriodService $periods,
        private readonly WeeklyReportService $reports,
        private readonly WeeklyReportAuditService $audit,
        private readonly NotificationService $notifications,
    ) {}

    public function findOrCreateDepartment(User $actor, int $periodId, ?int $departmentId = null): WeeklyReport
    {
        $departmentId ??= $actor->department_id;
        if (! $departmentId) {
            throw ValidationException::withMessages(['department_id' => 'Department is required.']);
        }

        if (! $actor->can('weekly-reports.consolidate-department') && ! $actor->hasRole('HOD')
            && ! $actor->isSystemAdmin() && ! $actor->can('weekly-reports.admin')
            && ! $actor->isSecretaryGeneral()) {
            abort(403, 'Not authorised to consolidate department summary.');
        }

        $period = WeeklyReportingPeriod::where('tenant_id', $actor->tenant_id)->findOrFail($periodId);

        $existing = WeeklyReport::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('period_id', $period->id)
            ->where('report_type', WeeklyReport::TYPE_DEPARTMENT)
            ->where('department_id', $departmentId)
            ->first();

        if ($existing) {
            return $existing->load($this->reports->detailRelations());
        }

        $report = WeeklyReport::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => $this->reports->nextReference($actor->tenant_id, 'WDS'),
            'period_id' => $period->id,
            'report_type' => WeeklyReport::TYPE_DEPARTMENT,
            'department_id' => $departmentId,
            'owner_id' => $actor->id,
            'prepared_by_id' => $actor->id,
            'supervisor_id' => $actor->id,
            'status' => 'draft',
            'version' => 1,
            'confidentiality' => 'internal',
        ]);

        $this->audit->record($report, $actor, 'department.created');

        return $report->load($this->reports->detailRelations());
    }

    public function findOrCreateInstitutional(User $actor, int $periodId): WeeklyReport
    {
        if (! $actor->can('weekly-reports.publish-institutional') && ! $actor->isSystemAdmin()
            && ! $actor->isSecretaryGeneral() && ! $actor->can('weekly-reports.admin')) {
            abort(403, 'Not authorised to create institutional summary.');
        }

        $period = WeeklyReportingPeriod::where('tenant_id', $actor->tenant_id)->findOrFail($periodId);

        $existing = WeeklyReport::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('period_id', $period->id)
            ->where('report_type', WeeklyReport::TYPE_INSTITUTIONAL)
            ->first();

        if ($existing) {
            return $existing->load($this->reports->detailRelations());
        }

        $report = WeeklyReport::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => $this->reports->nextReference($actor->tenant_id, 'WIS'),
            'period_id' => $period->id,
            'report_type' => WeeklyReport::TYPE_INSTITUTIONAL,
            'owner_id' => $actor->id,
            'prepared_by_id' => $actor->id,
            'status' => 'draft',
            'version' => 1,
            'confidentiality' => 'internal',
        ]);

        $this->audit->record($report, $actor, 'institutional.created');

        return $report->load($this->reports->detailRelations());
    }

    /**
     * Consolidate a source entity into the destination report without mutating the source.
     */
    public function consolidateItem(WeeklyReport $destination, User $actor, array $data): array
    {
        if ($destination->report_type === WeeklyReport::TYPE_INDIVIDUAL) {
            throw ValidationException::withMessages(['report' => 'Cannot consolidate into an individual report.']);
        }

        if (in_array($destination->status, ['published', 'closed'], true)) {
            throw ValidationException::withMessages(['status' => 'Published reports cannot be silently changed. Reopen for correction.']);
        }

        $sourceType = $data['source_entity_type']; // item|blocker|decision|priority|risk
        $sourceId = (int) $data['source_entity_id'];
        $source = $this->resolveSource($sourceType, $sourceId);
        $sourceReport = $source->report;

        if ($sourceReport->tenant_id !== $actor->tenant_id) {
            abort(403);
        }

        $confidentiality = $source->confidentiality ?? 'internal';
        if ($confidentiality === 'confidential'
            && ! $actor->can('weekly-reports.admin')
            && ! $actor->isSystemAdmin()) {
            throw ValidationException::withMessages(['confidentiality' => 'Confidential source cannot leak into department/institutional summary.']);
        }

        $narrative = $data['edited_narrative'] ?? ($source->narrative ?? $source->problem ?? $source->decision_requested ?? $source->priority_text ?? $source->emerging_issue ?? $source->title);
        $title = $data['title'] ?? ($source->title ?? $source->problem ?? $source->decision_requested ?? $source->priority_text ?? $source->emerging_issue ?? 'Consolidated item');

        return DB::transaction(function () use ($destination, $actor, $sourceType, $sourceId, $source, $sourceReport, $narrative, $title, $confidentiality, $data) {
            // Snapshot source fields BEFORE any write — prove immutability later in tests.
            $sourceFingerprint = [
                'updated_at' => optional($source->updated_at)?->toIso8601String(),
                'raw' => $source->only($source->getFillable()),
            ];

            $item = WeeklyReportItem::create([
                'weekly_report_id' => $destination->id,
                'section_type' => $data['section_type'] ?? 'consolidated',
                'title' => $title,
                'narrative' => $narrative,
                'source_type' => 'consolidation:'.$sourceType,
                'source_id' => $sourceId,
                'source_reference_snapshot' => $sourceReport->reference,
                'confidentiality' => $confidentiality,
                'include_in_consolidation' => true,
                'structured' => [
                    'source_employee_id' => $sourceReport->employee_id,
                    'source_report_id' => $sourceReport->id,
                ],
            ]);

            $link = WeeklyReportConsolidationLink::create([
                'destination_report_id' => $destination->id,
                'destination_item_id' => $item->id,
                'source_entity_type' => $sourceType,
                'source_entity_id' => $sourceId,
                'source_report_id' => $sourceReport->id,
                'source_employee_id' => $sourceReport->employee_id,
                'edited_narrative' => $narrative,
                'selected_by' => $actor->id,
                'selected_at' => now(),
            ]);

            if ($sourceReport->status === 'accepted') {
                $sourceReport->update(['status' => 'included_in_department']);
            }

            // Explicitly do NOT touch source entity content.
            $source->refresh();

            $this->audit->record($destination, $actor, 'item.consolidated', [
                'link_id' => $link->id,
                'source_entity_type' => $sourceType,
                'source_entity_id' => $sourceId,
                'source_fingerprint' => $sourceFingerprint,
            ]);

            return [
                'item' => $item,
                'link' => $link,
                'source_unchanged' => true,
            ];
        });
    }

    public function publish(WeeklyReport $report, User $actor): WeeklyReport
    {
        if ($report->report_type === WeeklyReport::TYPE_INDIVIDUAL) {
            throw ValidationException::withMessages(['report' => 'Individual reports are accepted, not published.']);
        }

        if ($report->report_type === WeeklyReport::TYPE_DEPARTMENT
            && ! $actor->can('weekly-reports.publish-department') && ! $actor->hasRole('HOD')
            && ! $actor->isSystemAdmin() && ! $actor->can('weekly-reports.admin')) {
            abort(403);
        }

        if ($report->report_type === WeeklyReport::TYPE_INSTITUTIONAL
            && ! $actor->can('weekly-reports.publish-institutional') && ! $actor->isSecretaryGeneral()
            && ! $actor->isSystemAdmin() && ! $actor->can('weekly-reports.admin')) {
            abort(403);
        }

        return DB::transaction(function () use ($report, $actor) {
            $report->update([
                'status' => 'published',
                'published_at' => now(),
            ]);
            $this->reports->snapshotVersion($report, $actor, 'publish');
            $this->audit->record($report, $actor, 'report.published', ['version' => $report->fresh()->version]);

            return $report->fresh($this->reports->detailRelations());
        });
    }

    private function resolveSource(string $type, int $id): mixed
    {
        return match ($type) {
            'item' => WeeklyReportItem::findOrFail($id),
            'blocker' => WeeklyReportBlocker::findOrFail($id),
            'decision' => WeeklyReportDecisionRequest::findOrFail($id),
            'priority' => WeeklyReportPriority::findOrFail($id),
            'risk' => WeeklyReportRisk::findOrFail($id),
            default => throw ValidationException::withMessages(['source_entity_type' => 'Unknown source type.']),
        };
    }
}
