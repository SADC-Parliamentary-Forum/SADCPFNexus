<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\MeActivityReport;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * M&E review workflow (PRD §10.10).
 *
 * Status machine:
 *   not_submitted ─submit─▶ submitted
 *   returned      ─submit─▶ submitted
 *   submitted     ─review──▶ reviewed
 *   submitted     ─return──▶ returned
 *   reviewed      ─return──▶ returned
 *   reviewed      ─accept──▶ accepted  (blocked if PM review pending when setting ON)
 *   accepted      ─close───▶ closed
 */
class MeReviewService
{
    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly MeSettingsService $settings,
        private readonly WorkflowService $workflowService,
    ) {}

    public function submit(MeActivityReport $report, User $user): MeActivityReport
    {
        if (!in_array($report->review_status, [MeActivityReport::STATUS_NOT_SUBMITTED, MeActivityReport::STATUS_RETURNED], true)) {
            throw ValidationException::withMessages(['review_status' => 'Only not-submitted or returned reports can be submitted.']);
        }

        $from = $report->review_status;
        $pmRequired = (bool) $this->settings->forTenant((int) $user->tenant_id)->programme_manager_review;

        $payload = [
            'review_status'       => MeActivityReport::STATUS_SUBMITTED,
            'submitted_by'        => $user->id,
            'submitted_at'        => now(),
            'intake_confirmed_at' => $report->intake_confirmed_at ?? now(),
        ];

        if ($pmRequired) {
            $payload['programme_review_status'] = 'pending';
            $payload['programme_reviewed_by']   = null;
            $payload['programme_reviewed_at']   = null;
            $payload['programme_review_notes']  = null;
        } else {
            $payload['programme_review_status'] = null;
        }

        $report->update($payload);

        $existingRequest = $report->approvalRequest;
        if ($from === MeActivityReport::STATUS_RETURNED && $existingRequest && $existingRequest->status === 'returned') {
            $this->workflowService->resubmit($existingRequest, $user);
        } else {
            $this->workflowService->initiate($report->fresh(), 'mande', $user);
        }

        $this->transition($report, 'submitted', $user, $from, MeActivityReport::STATUS_SUBMITTED);
        $this->notifyReviewers($report, $user);

        return $report->fresh();
    }

    public function review(MeActivityReport $report, array $data, User $reviewer): MeActivityReport
    {
        if ($report->review_status !== MeActivityReport::STATUS_SUBMITTED) {
            throw ValidationException::withMessages(['review_status' => 'Only submitted reports can be marked as reviewed.']);
        }

        $report->update([
            'review_status' => MeActivityReport::STATUS_REVIEWED,
            'reviewed_by'   => $reviewer->id,
            'reviewed_at'   => now(),
            'review_notes'  => $data['review_notes'] ?? $report->review_notes,
        ]);

        $this->transition($report, 'reviewed', $reviewer, MeActivityReport::STATUS_SUBMITTED, MeActivityReport::STATUS_REVIEWED, $data['review_notes'] ?? null);

        return $report->fresh();
    }

    public function requestCorrection(MeActivityReport $report, array $data, User $reviewer): MeActivityReport
    {
        if (!in_array($report->review_status, [MeActivityReport::STATUS_SUBMITTED, MeActivityReport::STATUS_REVIEWED], true)) {
            throw ValidationException::withMessages(['review_status' => 'Only submitted or reviewed reports can be returned for correction.']);
        }

        $from = $report->review_status;
        $report->update([
            'review_status'           => MeActivityReport::STATUS_RETURNED,
            'review_notes'            => $data['review_notes'],
            'return_section'          => $data['section'] ?? $data['return_section'] ?? null,
            'return_required_action'  => $data['required_action'] ?? $data['return_required_action'] ?? null,
            'correction_due_at'       => $data['correction_due_at'] ?? $data['due_date'] ?? null,
        ]);

        $this->transition($report, 'returned', $reviewer, $from, MeActivityReport::STATUS_RETURNED, $data['review_notes']);
        $this->notifyOwner($report, $reviewer, 'mande.activity_report.returned');

        return $report->fresh();
    }

    public function accept(MeActivityReport $report, array $data, User $reviewer): MeActivityReport
    {
        if ($report->review_status !== MeActivityReport::STATUS_REVIEWED) {
            throw ValidationException::withMessages(['review_status' => 'Only reviewed reports can be accepted.']);
        }

        if ((int) $report->responsible_officer_id === (int) $reviewer->id
            || (int) ($report->submitted_by ?? 0) === (int) $reviewer->id) {
            throw ValidationException::withMessages([
                'accept' => 'Separation of duties: the reporting officer cannot accept their own report.',
            ]);
        }

        $pmRequired = (bool) $this->settings->forTenant((int) $reviewer->tenant_id)->programme_manager_review;
        if ($pmRequired && $report->programme_review_status === 'pending') {
            throw ValidationException::withMessages([
                'programme_review_status' => 'Programme manager review must be cleared before acceptance.',
            ]);
        }
        if ($pmRequired && $report->programme_review_status === 'returned') {
            throw ValidationException::withMessages([
                'programme_review_status' => 'Programme manager returned this report; officer must resubmit.',
            ]);
        }

        $report->update([
            'review_status' => MeActivityReport::STATUS_ACCEPTED,
            'accepted_by'   => $reviewer->id,
            'accepted_at'   => now(),
            'review_notes'  => $data['review_notes'] ?? $report->review_notes,
        ]);

        $this->transition($report, 'accepted', $reviewer, MeActivityReport::STATUS_REVIEWED, MeActivityReport::STATUS_ACCEPTED, $data['review_notes'] ?? null);
        $this->notifyOwner($report, $reviewer, 'mande.activity_report.accepted');

        return $report->fresh();
    }

    /**
     * @return Collection<int, MeActivityReport>
     */
    public function programmeReviewQueue(User $user): Collection
    {
        return MeActivityReport::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('programme_review_status', 'pending')
            ->whereIn('review_status', [
                MeActivityReport::STATUS_SUBMITTED,
                MeActivityReport::STATUS_REVIEWED,
            ])
            ->orderByDesc('submitted_at')
            ->limit(200)
            ->get();
    }

    public function clearProgrammeReview(MeActivityReport $report, array $data, User $actor): MeActivityReport
    {
        $this->assertCanActAsProgrammeReviewer($report, $actor);

        if ($report->programme_review_status !== 'pending') {
            throw ValidationException::withMessages([
                'programme_review_status' => 'Only pending programme reviews can be cleared.',
            ]);
        }

        $report->update([
            'programme_review_status' => 'cleared',
            'programme_reviewed_by'   => $actor->id,
            'programme_reviewed_at'   => now(),
            'programme_review_notes'  => $data['notes'] ?? $data['review_notes'] ?? null,
        ]);

        $this->transition($report, 'programme_review_cleared', $actor, 'pending', 'cleared', $data['notes'] ?? null);

        return $report->fresh();
    }

    public function returnProgrammeReview(MeActivityReport $report, array $data, User $actor): MeActivityReport
    {
        $this->assertCanActAsProgrammeReviewer($report, $actor);

        if ($report->programme_review_status !== 'pending') {
            throw ValidationException::withMessages([
                'programme_review_status' => 'Only pending programme reviews can be returned.',
            ]);
        }

        $notes = $data['notes'] ?? $data['review_notes'] ?? null;
        if (!$notes) {
            throw ValidationException::withMessages(['notes' => 'A reason is required when returning to the officer.']);
        }

        $report->update([
            'programme_review_status' => 'returned',
            'programme_reviewed_by'   => $actor->id,
            'programme_reviewed_at'   => now(),
            'programme_review_notes'  => $notes,
            'review_status'           => MeActivityReport::STATUS_RETURNED,
            'review_notes'            => $notes,
        ]);

        $this->transition($report, 'programme_review_returned', $actor, 'pending', 'returned', $notes);
        $this->notifyOwner($report, $actor, 'mande.activity_report.returned');

        return $report->fresh();
    }

    private function assertCanActAsProgrammeReviewer(MeActivityReport $report, User $actor): void
    {
        if ((int) $report->responsible_officer_id === (int) $actor->id
            || (int) ($report->submitted_by ?? 0) === (int) $actor->id
            || (int) $report->created_by === (int) $actor->id) {
            throw ValidationException::withMessages([
                'programme_review' => 'Separation of duties: you cannot clear or return your own report.',
            ]);
        }
    }

    public function close(MeActivityReport $report, array $data, User $reviewer): MeActivityReport
    {
        if ($report->review_status !== MeActivityReport::STATUS_ACCEPTED) {
            throw ValidationException::withMessages(['review_status' => 'Only accepted reports can be closed.']);
        }

        $report->update([
            'review_status'  => MeActivityReport::STATUS_CLOSED,
            'closure_status' => 'closed',
            'closed_by'      => $reviewer->id,
            'closed_at'      => now(),
        ]);

        $this->transition($report, 'closed', $reviewer, MeActivityReport::STATUS_ACCEPTED, MeActivityReport::STATUS_CLOSED, $data['notes'] ?? null);

        return $report->fresh();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function transition(
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

        AuditLog::record("mande.activity_report.{$changeType}", [
            'auditable_type' => MeActivityReport::class,
            'auditable_id'   => $report->id,
            'new_values'     => ['review_status' => $toStatus],
            'tags'           => 'mande',
        ]);
    }

    private function notifyReviewers(MeActivityReport $report, User $actor): void
    {
        $reviewers = User::role(['Governance Officer', 'Internal Auditor', 'Director'])
            ->where('tenant_id', $report->tenant_id)
            ->where('id', '!=', $actor->id)
            ->get();

        foreach ($reviewers as $reviewer) {
            $this->notificationService->dispatch($reviewer, 'mande.activity_report.submitted', [
                'name'      => $reviewer->name,
                'reference' => $report->reference_number,
                'title'     => $report->activity_title,
                'submitter' => $actor->name,
            ], ['module' => 'mande', 'record_id' => $report->id, 'url' => '/mande/activity-reports/' . $report->id], false);
        }
    }

    private function notifyOwner(MeActivityReport $report, User $actor, string $trigger): void
    {
        $report->loadMissing(['creator', 'responsibleOfficer']);
        $notified = [];
        foreach (array_filter([$report->creator, $report->responsibleOfficer]) as $recipient) {
            if (in_array($recipient->id, $notified, true) || (int) $recipient->id === (int) $actor->id) {
                continue;
            }
            $notified[] = $recipient->id;
            $this->notificationService->dispatch($recipient, $trigger, [
                'name'      => $recipient->name,
                'reference' => $report->reference_number,
                'title'     => $report->activity_title,
                'actor'     => $actor->name,
                'notes'     => $report->review_notes ?? '',
            ], ['module' => 'mande', 'record_id' => $report->id, 'url' => '/mande/activity-reports/' . $report->id], false);
        }
    }
}
