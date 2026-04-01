<?php

namespace App\Modules\Srhr\Services;

use App\Models\AuditLog;
use App\Models\ResearcherReport;
use App\Models\StaffDeployment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class ResearcherReportService
{
    public function __construct(
        protected NotificationService $notificationService,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = ResearcherReport::with(['employee', 'parliament', 'deployment'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('period_start');

        // Non-admin users should only see their own reports.
        if (!$user->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin'])) {
            $query->where('employee_id', $user->id);
        }

        if (!empty($filters['deployment_id'])) {
            $query->where('deployment_id', $filters['deployment_id']);
        }

        if (!empty($filters['parliament_id'])) {
            $query->where('parliament_id', $filters['parliament_id']);
        }

        if (!empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['report_type'])) {
            $query->where('report_type', $filters['report_type']);
        }

        if (!empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('reference_number', 'ilike', "%{$term}%")
                  ->orWhere('title', 'ilike', "%{$term}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function get(int $id, User $user): ResearcherReport
    {
        $query = ResearcherReport::with([
            'employee', 'parliament', 'deployment.parliament',
            'acknowledgedBy', 'attachments.uploader',
        ])->where('tenant_id', $user->tenant_id);

        // Non-admin users can only fetch their own reports.
        if (!$user->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin'])) {
            $query->where('employee_id', $user->id);
        }

        return $query->findOrFail($id);
    }

    public function create(array $data, User $user): ResearcherReport
    {
        // Verify the deployment belongs to this user (or admin is creating on behalf)
        $deployment = StaffDeployment::where('tenant_id', $user->tenant_id)
            ->where('id', $data['deployment_id'])
            ->firstOrFail();

        if (!$user->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin']) && $deployment->employee_id !== $user->id) {
            throw ValidationException::withMessages([
                'deployment_id' => ['You can only submit reports for your own deployment.'],
            ]);
        }

        if (!$deployment->isActive()) {
            throw ValidationException::withMessages([
                'deployment_id' => ['Reports can only be submitted against an active deployment.'],
            ]);
        }

        return ResearcherReport::create([
            'tenant_id'              => $user->tenant_id,
            'deployment_id'          => $deployment->id,
            'employee_id'            => $deployment->employee_id,
            'parliament_id'          => $deployment->parliament_id,
            'reference_number'       => ResearcherReport::generateReference($user->tenant_id),
            'report_type'            => $data['report_type'],
            'period_start'           => $data['period_start'],
            'period_end'             => $data['period_end'],
            'title'                  => $data['title'],
            'status'                 => 'draft',
            'executive_summary'      => $data['executive_summary'] ?? null,
            'activities_undertaken'  => $data['activities_undertaken'] ?? null,
            'challenges_faced'       => $data['challenges_faced'] ?? null,
            'recommendations'        => $data['recommendations'] ?? null,
            'next_period_plan'       => $data['next_period_plan'] ?? null,
            'srhr_indicators'        => $data['srhr_indicators'] ?? null,
        ]);
    }

    public function update(ResearcherReport $report, array $data): ResearcherReport
    {
        if (!$report->isDraft() && !$report->isRevisionRequested()) {
            throw ValidationException::withMessages([
                'status' => ['Only draft or revision-requested reports can be edited.'],
            ]);
        }

        $report->update(array_intersect_key($data, array_flip([
            'report_type', 'period_start', 'period_end', 'title',
            'executive_summary', 'activities_undertaken', 'challenges_faced',
            'recommendations', 'next_period_plan', 'srhr_indicators',
        ])));

        return $report->fresh();
    }

    public function submit(ResearcherReport $report, User $actor): ResearcherReport
    {
        if (!$report->isDraft() && !$report->isRevisionRequested()) {
            throw ValidationException::withMessages([
                'status' => ['Only draft or revision-requested reports can be submitted.'],
            ]);
        }

        $report->update([
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        AuditLog::record('srhr.report.submitted', [
            'auditable_type' => ResearcherReport::class,
            'auditable_id'   => $report->id,
            'new_values'     => ['reference' => $report->reference_number, 'status' => 'submitted'],
            'tags'           => 'srhr',
        ]);

        $report->load('employee');

        // Notify HR managers/administrators that a report needs acknowledgement
        $hrManagers = User::role(['HR Manager', 'HR Administrator'])
            ->where('tenant_id', $report->tenant_id)->get();
        $this->notificationService->dispatchToMany($hrManagers, 'srhr.report.submitted', [
            'reference' => $report->reference_number,
            'employee'  => $report->employee?->name ?? '',
            'title'     => $report->title,
            'period'    => $report->period_start . ' – ' . $report->period_end,
        ], ['module' => 'srhr', 'record_id' => $report->id, 'url' => '/srhr/reports/' . $report->id]);

        return $report->fresh();
    }

    public function acknowledge(ResearcherReport $report, User $actor): ResearcherReport
    {
        if (!$report->isSubmitted()) {
            throw ValidationException::withMessages([
                'status' => ['Only submitted reports can be acknowledged.'],
            ]);
        }

        $report->update([
            'status'           => 'acknowledged',
            'acknowledged_at'  => now(),
            'acknowledged_by'  => $actor->id,
            'revision_notes'   => null,
        ]);

        AuditLog::record('srhr.report.acknowledged', [
            'auditable_type' => ResearcherReport::class,
            'auditable_id'   => $report->id,
            'new_values'     => ['status' => 'acknowledged', 'acknowledged_by' => $actor->id],
            'tags'           => 'srhr',
        ]);

        $report->load('employee');

        // Notify the researcher that their report has been acknowledged
        if ($report->employee) {
            $this->notificationService->dispatch($report->employee, 'srhr.report.acknowledged', [
                'name'      => $report->employee->name,
                'reference' => $report->reference_number,
                'title'     => $report->title,
            ], ['module' => 'srhr', 'record_id' => $report->id, 'url' => '/srhr/reports/' . $report->id]);
        }

        return $report->fresh(['acknowledgedBy']);
    }

    public function requestRevision(ResearcherReport $report, string $notes, User $actor): ResearcherReport
    {
        if (!$report->isSubmitted()) {
            throw ValidationException::withMessages([
                'status' => ['Only submitted reports can have revision requested.'],
            ]);
        }

        $report->update([
            'status'         => 'revision_requested',
            'revision_notes' => $notes,
        ]);

        AuditLog::record('srhr.report.revision_requested', [
            'auditable_type' => ResearcherReport::class,
            'auditable_id'   => $report->id,
            'new_values'     => ['status' => 'revision_requested'],
            'tags'           => 'srhr',
        ]);

        $report->load('employee');

        // Notify the researcher of the revision request
        if ($report->employee) {
            $this->notificationService->dispatch($report->employee, 'srhr.report.revision_requested', [
                'name'      => $report->employee->name,
                'reference' => $report->reference_number,
                'title'     => $report->title,
                'notes'     => $notes,
            ], ['module' => 'srhr', 'record_id' => $report->id, 'url' => '/srhr/reports/' . $report->id]);
        }

        return $report->fresh();
    }
}
