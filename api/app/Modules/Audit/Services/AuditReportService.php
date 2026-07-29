<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditReport;
use App\Models\AuditReportDistribution;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AuditReportService
{
    public function __construct(private readonly AuditEventRecorder $events) {}

    public function createDraft(array $data, User $user): AuditReport
    {
        $report = AuditReport::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $data['engagement_id'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'status' => 'draft',
            'created_by' => $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
        ]);
        $this->events->record('audit.report.drafted', $user, AuditReport::class, $report->id);

        return $report;
    }

    public function updateDraft(AuditReport $report, array $data, User $user): AuditReport
    {
        $this->assertTenant($report->tenant_id, $user);
        $report->assertEditable();
        $report->update(array_filter([
            'title' => $data['title'] ?? null,
            'body' => $data['body'] ?? null,
            'confidentiality_level' => $data['confidentiality_level'] ?? null,
        ], fn ($v) => $v !== null));
        $this->events->record('audit.report.updated', $user, AuditReport::class, $report->id);

        return $report->fresh();
    }

    public function issueFinal(AuditReport $report, User $user): AuditReport
    {
        $this->assertTenant($report->tenant_id, $user);
        if (! $user->can('audit.report.issue') && ! $user->can('audit.admin')) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to issue final reports.']);
        }
        $report->assertEditable();
        $report->update([
            'status' => 'final',
            'is_immutable' => true,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);
        $this->events->record('audit.report.issued', $user, AuditReport::class, $report->id);

        return $report->fresh();
    }

    public function distribute(AuditReport $report, array $recipient, User $user): AuditReportDistribution
    {
        $this->assertTenant($report->tenant_id, $user);
        if ($report->status !== 'final') {
            throw ValidationException::withMessages(['report' => 'Only final reports can be distributed.']);
        }

        $dist = AuditReportDistribution::create([
            'tenant_id' => $user->tenant_id,
            'report_id' => $report->id,
            'recipient_user_id' => $recipient['recipient_user_id'] ?? null,
            'recipient_email' => $recipient['recipient_email'] ?? null,
            'recipient_name' => $recipient['recipient_name'] ?? null,
            'distributed_by' => $user->id,
            'distributed_at' => now(),
        ]);
        $this->events->record('audit.report.distributed', $user, AuditReportDistribution::class, $dist->id);

        return $dist;
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
