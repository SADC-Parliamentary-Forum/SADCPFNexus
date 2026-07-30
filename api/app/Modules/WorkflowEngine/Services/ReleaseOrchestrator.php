<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use App\Models\WorkflowEngine\WorkflowCertificate;
use App\Models\WorkflowEngine\WorkflowReleaseEvent;
use Illuminate\Support\Str;
use Throwable;

/**
 * Downstream completion / release events with retry (PRD §87–§89, §124).
 * Downstream failure must never erase the approval decision.
 */
class ReleaseOrchestrator
{
    public function enqueueCompletion(ApprovalRequest $request, User $actor): WorkflowReleaseEvent
    {
        $key = 'release-complete-'.$request->id.'-'.($request->approval_package_hash ?? 'na');

        $existing = WorkflowReleaseEvent::where('idempotency_key', $key)->first();
        if ($existing) {
            return $existing;
        }

        $event = WorkflowReleaseEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'event_type' => 'WorkflowCompleted',
            'target' => $request->approvable_type,
            'status' => 'pending',
            'attempts' => 0,
            'payload' => [
                'approvable_type' => $request->approvable_type,
                'approvable_id' => $request->approvable_id,
                'package_hash' => $request->approval_package_hash,
                'completed_by' => $actor->id,
            ],
            'idempotency_key' => $key,
        ]);

        $this->attempt($event);

        return $event->fresh();
    }

    public function attempt(WorkflowReleaseEvent $event): WorkflowReleaseEvent
    {
        $event->increment('attempts');
        $event->refresh();

        try {
            $request = ApprovalRequest::with('approvable')->find($event->approval_request_id);
            if (! $request) {
                throw new \RuntimeException('Approval request missing for release event.');
            }

            // Issue immutable approval certificate (does not mutate decisions)
            $this->issueCertificate($request);

            $entity = $request->approvable;
            if ($entity && method_exists($entity, 'onWorkflowReleased')) {
                $entity->onWorkflowReleased($request);
            }

            $event->update([
                'status' => 'succeeded',
                'succeeded_at' => now(),
                'last_error' => null,
                'next_retry_at' => null,
            ]);

            WorkflowAuditEvent::create([
                'tenant_id' => $event->tenant_id,
                'approval_request_id' => $event->approval_request_id,
                'event_type' => 'WorkflowReleaseSucceeded',
                'payload' => ['release_event_id' => $event->id],
                'occurred_at' => now(),
            ]);
        } catch (Throwable $e) {
            // Keep approval intact; schedule retry
            $event->update([
                'status' => 'retrying',
                'last_error' => mb_substr($e->getMessage(), 0, 2000),
                'next_retry_at' => now()->addMinutes(min(60, 2 ** min(6, (int) $event->attempts))),
            ]);

            WorkflowAuditEvent::create([
                'tenant_id' => $event->tenant_id,
                'approval_request_id' => $event->approval_request_id,
                'event_type' => 'WorkflowReleaseFailed',
                'payload' => [
                    'release_event_id' => $event->id,
                    'error' => $e->getMessage(),
                    'attempts' => $event->attempts,
                ],
                'occurred_at' => now(),
            ]);
        }

        return $event->fresh();
    }

    public function retryDue(): int
    {
        $due = WorkflowReleaseEvent::whereIn('status', ['pending', 'retrying', 'failed'])
            ->where(function ($q) {
                $q->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', now());
            })
            ->where('attempts', '<', 10)
            ->limit(50)
            ->get();

        foreach ($due as $event) {
            $this->attempt($event);
        }

        return $due->count();
    }

    public function issueCertificate(ApprovalRequest $request): WorkflowCertificate
    {
        $existing = WorkflowCertificate::where('approval_request_id', $request->id)->first();
        if ($existing) {
            return $existing;
        }

        $request->loadMissing(['history.user', 'workflow.steps', 'approvable']);
        $body = [
            'approval_request_id' => $request->id,
            'uuid' => $request->uuid,
            'module' => $request->workflow?->module_type,
            'subject_type' => $request->approvable_type,
            'subject_id' => $request->approvable_id,
            'definition_version_id' => $request->definition_version_id,
            'package_hash' => $request->approval_package_hash,
            'record_version' => $request->record_version,
            'status' => $request->status,
            'history' => $request->history->map(fn ($h) => [
                'action' => $h->action,
                'decision_type' => $h->decision_type ?? $h->action,
                'stage_type' => $h->stage_type,
                'step_index' => $h->step_index,
                'actor' => $h->user?->name,
                'actor_id' => $h->user_id,
                'comment' => $h->comment,
                'at' => optional($h->created_at)->toIso8601String(),
            ])->all(),
            'issued_at' => now()->toIso8601String(),
        ];
        $hash = hash('sha256', json_encode($body));

        return WorkflowCertificate::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'certificate_hash' => $hash,
            'certificate_body' => $body,
            'issued_at' => now(),
        ]);
    }
}
