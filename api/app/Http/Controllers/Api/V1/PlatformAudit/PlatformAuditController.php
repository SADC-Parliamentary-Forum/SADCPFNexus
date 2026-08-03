<?php

namespace App\Http\Controllers\Api\V1\PlatformAudit;

use App\Http\Controllers\Controller;
use App\Models\PlatformAudit\AuditEventCheckpoint;
use App\Models\PlatformAudit\AuditEventDeadLetter;
use App\Models\PlatformAudit\AuditEventHold;
use App\Models\PlatformAudit\AuditEventOutbox;
use App\Models\PlatformAudit\AuditEventType;
use App\Models\PlatformAudit\AuditTrailGovernanceDecision;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use App\Modules\PlatformAudit\Services\AuditHoldService;
use App\Modules\PlatformAudit\Services\AuditIntegrityService;
use App\Modules\PlatformAudit\Services\AuditReconciliationService;
use App\Modules\PlatformAudit\Services\AuditSearchService;
use App\Modules\PlatformAudit\Services\AuditTrailGovernanceService;
use App\Modules\PlatformAudit\Services\EventTypeRegistryService;
use App\Modules\PlatformAudit\Services\LegacyAuditMigrationService;
use App\Modules\PlatformAudit\Services\SecurityMonitoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformAuditController extends Controller
{
    public function ingest(Request $request, AuditEventIngestionService $ingestion): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);

        $data = $request->validate([
            'uuid' => 'nullable|uuid',
            'event_key' => 'required|string|max:128',
            'schema_version' => 'nullable|integer|min:1',
            'outcome' => 'nullable|string|max:32',
            'actor_type' => 'nullable|in:human,service,anonymous',
            'actor_id' => 'nullable|integer',
            'principal_id' => 'nullable|integer',
            'delegation_id' => 'nullable|integer',
            'acting_appointment_id' => 'nullable|integer',
            'subject_type' => 'nullable|string',
            'subject_id' => 'nullable|integer',
            'source_module' => 'nullable|string|max:64',
            'action' => 'nullable|string|max:128',
            'reason' => 'nullable|string',
            'correlation_id' => 'nullable|uuid',
            'idempotency_key' => 'nullable|string|max:191',
            'old_values' => 'nullable|array',
            'new_values' => 'nullable|array',
            'payload' => 'nullable|array',
            'occurred_at' => 'nullable|date',
            'category' => 'nullable|string|max:64',
            'severity' => 'nullable|string|max:32',
            'retention_class' => 'nullable|string|max:64',
            'sync' => 'nullable|boolean',
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;
        if ($request->boolean('sync', true) === false) {
            $outbox = $ingestion->enqueue($data);

            return response()->json([
                'data' => [
                    'id' => $outbox->id,
                    'event_uuid' => $outbox->event_uuid,
                    'event_key' => $outbox->event_key,
                    'status' => $outbox->status,
                    'available_at' => optional($outbox->available_at)?->toIso8601String(),
                ],
            ], 202);
        }

        $event = $ingestion->ingest($data);

        return response()->json(['data' => $this->serializeEvent($event)], 201);
    }

    public function ingestBatch(Request $request, AuditEventIngestionService $ingestion): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);
        $payload = $request->validate([
            'events' => 'required|array|min:1|max:100',
            'events.*.event_key' => 'required|string|max:128',
            'events.*.idempotency_key' => 'nullable|string|max:191',
        ]);

        $created = [];
        foreach ($payload['events'] as $row) {
            $row['tenant_id'] = $request->user()->tenant_id;
            $created[] = $this->serializeEvent($ingestion->ingest($row));
        }

        return response()->json(['data' => $created], 201);
    }

    public function ingestionStatus(Request $request, string $eventId): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin', 'audit-trail.search']);

        $outbox = AuditEventOutbox::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where(function ($q) use ($eventId) {
                $q->where('event_uuid', $eventId);
                if (is_numeric($eventId)) {
                    $q->orWhere('id', (int) $eventId);
                }
            })
            ->first();

        return response()->json(['data' => $outbox]);
    }

    public function index(Request $request, AuditSearchService $search): JsonResponse
    {
        $page = $search->search($request->user(), $request);

        return response()->json([
            'data' => collect($page->items())->map(fn ($e) => $this->serializeEvent($e, false)),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }

    public function show(Request $request, string $id, AuditSearchService $search): JsonResponse
    {
        $event = $search->find($request->user(), $id);

        return response()->json(['data' => $this->serializeEvent($event, true)]);
    }

    public function related(Request $request, string $id, AuditSearchService $search): JsonResponse
    {
        $event = $search->find($request->user(), $id);
        $related = \App\Models\PlatformAudit\AuditEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('id', '!=', $event->id)
            ->where(function ($q) use ($event) {
                if ($event->correlation_id) {
                    $q->orWhere('correlation_id', $event->correlation_id);
                }
                if ($event->subject_type && $event->subject_id) {
                    $q->orWhere(function ($inner) use ($event) {
                        $inner->where('subject_type', $event->subject_type)
                            ->where('subject_id', $event->subject_id);
                    });
                }
            })
            ->orderByDesc('occurred_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $related->map(fn ($e) => $this->serializeEvent($e, false)),
        ]);
    }

    public function recordHistory(Request $request, string $type, string $id, AuditSearchService $search): JsonResponse
    {
        $page = $search->recordHistory($request->user(), $type, $id, $request);

        return response()->json([
            'data' => collect($page->items())->map(fn ($e) => $this->serializeEvent($e, false)),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }

    public function userSecurityEvents(Request $request, int $userId, AuditSearchService $search): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.view-security', 'audit-trail.admin', 'audit-trail.search']);
        $search->logAccess($request->user(), 'search', ['actor_id' => $userId, 'category' => 'security_events']);

        $request->merge(['actor_id' => $userId]);
        $page = $search->search($request->user(), $request);

        return response()->json([
            'data' => collect($page->items())->map(fn ($e) => $this->serializeEvent($e, false)),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
        ]);
    }

    public function checkpoints(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.verify-integrity', 'audit-trail.admin']);

        $rows = AuditEventCheckpoint::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function verify(Request $request, AuditIntegrityService $integrity, AuditSearchService $search): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.verify-integrity', 'audit-trail.admin']);
        $search->logAccess($request->user(), 'integrity_verify', $request->only(['from_sequence', 'to_sequence']));

        $result = $integrity->verifyChain(
            (int) $request->user()->tenant_id,
            $request->filled('from_sequence') ? (int) $request->input('from_sequence') : null,
            $request->filled('to_sequence') ? (int) $request->input('to_sequence') : null,
        );

        return response()->json(['data' => $result]);
    }

    public function integrityReport(Request $request, int $id, AuditIntegrityService $integrity, AuditSearchService $search): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.verify-integrity', 'audit-trail.admin']);

        $checkpoint = AuditEventCheckpoint::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $search->logAccess($request->user(), 'integrity_report', [
            'checkpoint_id' => $checkpoint->id,
            'from_sequence' => $checkpoint->from_sequence,
            'to_sequence' => $checkpoint->to_sequence,
        ]);

        $verification = (int) $checkpoint->event_count === 0
            ? [
                'valid' => true,
                'checked' => 0,
                'first_failure_sequence' => null,
                'message' => 'Empty checkpoint verified',
                'alert_id' => null,
            ]
            : $integrity->verifyChain(
                (int) $request->user()->tenant_id,
                (int) $checkpoint->from_sequence,
                (int) $checkpoint->to_sequence,
            );

        return response()->json([
            'data' => [
                'checkpoint' => $checkpoint,
                'verification' => $verification,
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function createCheckpoint(Request $request, AuditIntegrityService $integrity): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.verify-integrity', 'audit-trail.admin']);
        $cp = $integrity->createCheckpoint((int) $request->user()->tenant_id, $request->user());

        return response()->json(['data' => $cp], 201);
    }

    public function ingestionHealth(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);
        $tenantId = $request->user()->tenant_id;

        return response()->json([
            'data' => [
                'pending_outbox' => AuditEventOutbox::query()->where('tenant_id', $tenantId)->where('status', 'pending')->count(),
                'failed_outbox' => AuditEventOutbox::query()->where('tenant_id', $tenantId)->whereIn('status', ['failed', 'dead_lettered'])->count(),
                'processable_outbox' => AuditEventOutbox::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('status', ['pending', 'failed'])
                    ->where('attempts', '<', 3)
                    ->where(function ($q) {
                        $q->whereNull('available_at')->orWhere('available_at', '<=', now());
                    })
                    ->count(),
                'open_dead_letters' => AuditEventDeadLetter::query()->where('tenant_id', $tenantId)->where('status', 'open')->count(),
                'events_total' => \App\Models\PlatformAudit\AuditEvent::query()->where('tenant_id', $tenantId)->count(),
                'latest_sequence' => \App\Models\PlatformAudit\AuditEvent::query()->where('tenant_id', $tenantId)->max('sequence_number'),
            ],
        ]);
    }

    public function processOutbox(Request $request, AuditEventIngestionService $ingestion): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);
        $data = $request->validate([
            'limit' => 'nullable|integer|min:1|max:500',
        ]);
        $stats = $ingestion->processPending(
            (int) $request->user()->tenant_id,
            (int) ($data['limit'] ?? 100),
        );

        $ingestion->ingest([
            'tenant_id' => $request->user()->tenant_id,
            'event_key' => 'audit.outbox.processed',
            'actor_id' => $request->user()->id,
            'actor_type' => 'human',
            'outcome' => $stats['failed'] > 0 || $stats['dead_lettered'] > 0 ? 'partially_completed' : 'success',
            'source_module' => 'platform-audit',
            'subject_type' => AuditEventOutbox::class,
            'action' => 'process_pending_outbox',
            'new_values' => $stats,
        ]);

        return response()->json([
            'data' => $stats,
        ]);
    }

    public function reconcile(Request $request, AuditReconciliationService $reconciliation): JsonResponse
    {
        $this->requirePerm($request, [
            'audit-trail.manage-ingestion',
            'audit-trail.verify-integrity',
            'audit-trail.admin',
        ]);
        $data = $request->validate([
            'stale_minutes' => 'nullable|integer|min:1|max:10080',
        ]);

        return response()->json([
            'data' => $reconciliation->reconcile(
                (int) $request->user()->tenant_id,
                $request->user(),
                (int) ($data['stale_minutes'] ?? 15),
            ),
        ]);
    }

    public function deadLetters(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);
        $rows = AuditEventDeadLetter::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate(min((int) $request->input('per_page', 25), 100));

        return response()->json($rows);
    }

    public function replayDeadLetter(Request $request, int $id, AuditEventIngestionService $ingestion): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-ingestion', 'audit-trail.admin']);
        $row = AuditEventDeadLetter::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $payload = $row->payload['input'] ?? $row->payload ?? [];
        $payload['tenant_id'] = $request->user()->tenant_id;
        $payload['uuid'] = $payload['uuid'] ?? (string) Str::uuid();
        $payload['idempotency_key'] = $payload['idempotency_key'] ?? ('replay:'.$row->id.':'.Str::uuid());

        $event = $ingestion->ingest($payload);
        $row->status = 'replayed';
        $row->resolved_by = $request->user()->id;
        $row->resolved_at = now();
        $row->save();

        $ingestion->ingest([
            'tenant_id' => $request->user()->tenant_id,
            'event_key' => 'audit.dead_letter.replayed',
            'actor_id' => $request->user()->id,
            'actor_type' => 'human',
            'outcome' => 'success',
            'source_module' => 'platform-audit',
            'subject_type' => AuditEventDeadLetter::class,
            'subject_id' => $row->id,
            'business_reference' => (string) ($row->event_uuid ?? $row->id),
            'new_values' => [
                'dead_letter_id' => $row->id,
                'replayed_event_id' => $event->id,
                'replayed_event_uuid' => $event->uuid,
                'event_key' => $row->event_key,
                'status' => $row->status,
            ],
        ]);

        return response()->json(['data' => $this->serializeEvent($event)]);
    }

    public function holds(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-holds', 'audit-trail.admin', 'audit-trail.search']);
        $rows = AuditEventHold::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate(50);

        return response()->json($rows);
    }

    public function placeHold(Request $request, AuditHoldService $holds): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-holds', 'audit-trail.admin']);
        $data = $request->validate([
            'hold_type' => 'required|in:legal,audit,investigation',
            'scope_type' => 'required|in:event,subject,category,tenant',
            'scope_value' => 'nullable|string',
            'audit_event_id' => 'nullable|integer',
            'reason' => 'required|string|max:500',
        ]);

        $hold = $holds->place((int) $request->user()->tenant_id, $request->user(), $data);

        return response()->json(['data' => $hold], 201);
    }

    public function releaseHold(Request $request, int $id, AuditHoldService $holds): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-holds', 'audit-trail.admin']);
        $hold = AuditEventHold::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $holds->release($hold, $request->user())]);
    }

    public function eventTypes(Request $request, EventTypeRegistryService $registry): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-event-types', 'audit-trail.admin', 'audit-trail.search']);
        $registry->ensureSeeded();

        $rows = AuditEventType::query()->orderBy('category')->orderBy('event_key')->get();

        return response()->json(['data' => $rows]);
    }

    public function governanceIndex(Request $request, AuditTrailGovernanceService $gov): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.admin', 'audit-trail.manage-retention']);
        $rows = $gov->listForTenant((int) $request->user()->tenant_id);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'phase2_mvp' => [
                    'security_monitoring_rules' => 'Shipped (product MVP)',
                    'security_alert_workflow' => 'Shipped (product MVP)',
                    'forensic_cases' => 'Shipped (product MVP)',
                    'evidence_packages' => 'Shipped (product MVP)',
                ],
                'phase2_pending' => [
                    'siem' => 'Governance Configuration Pending',
                    'worm_archive' => 'Governance Configuration Pending',
                    'anomaly_ai' => 'Governance Configuration Pending',
                ],
                // Backward-compatible alias for Phase 1 clients/tests
                'phase2_stubs' => [
                    'siem' => 'Governance Configuration Pending',
                    'forensic_workspace' => 'Shipped (product MVP) — SIEM/WORM/AI still Pending',
                    'anomaly_ai' => 'Governance Configuration Pending',
                ],
            ],
        ]);
    }

    public function governanceUpdate(Request $request, int $decision, AuditTrailGovernanceService $gov): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.admin', 'audit-trail.manage-retention']);
        $row = AuditTrailGovernanceDecision::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($decision);

        $data = $request->validate([
            'status' => 'required|in:pending,decided,not_applicable',
            'decision_notes' => 'nullable|string',
        ]);

        return response()->json(['data' => $gov->update($row, $data, $request->user())]);
    }

    public function monitoringRules(Request $request, \App\Modules\PlatformAudit\Services\SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $monitoring->ensureSeeded((int) $request->user()->tenant_id);
        $monitoring->ensureSeeded(null);

        $rows = \App\Models\PlatformAudit\SecurityMonitoringRule::query()
            ->where(function ($q) use ($request) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $request->user()->tenant_id);
            })
            ->where('status', 'active')
            ->orderBy('rule_key')
            ->orderByDesc('version')
            ->get()
            ->unique('rule_key')
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function alerts(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin', 'audit-trail.search']);
        $rows = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('rule')
            ->orderByDesc('id')
            ->paginate(50);

        return response()->json($rows);
    }

    public function showAlert(Request $request, int $id, AuditSearchService $search): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.view-security', 'audit-trail.admin', 'audit-trail.search']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('rule')
            ->findOrFail($id);

        $search->logAccess($request->user(), 'security_alert_view', [
            'alert_id' => $alert->id,
            'reference' => $alert->reference,
        ]);

        return response()->json(['data' => $alert]);
    }

    public function assignAlert(Request $request, int $id, SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $data = $request->validate([
            'assigned_to' => 'required|integer|exists:users,id',
            'notes' => 'nullable|string',
        ]);
        $this->assertTenantUser($request, (int) $data['assigned_to']);
        $data['workflow_status'] = 'assigned';

        return response()->json(['data' => $monitoring->transitionAlert($alert, $request->user(), $data)]);
    }

    public function classifyAlert(Request $request, int $id, SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);
        $statuses = implode(',', [
            'classified',
            'benign',
            'confirmed_incident',
            'escalated',
            'resolved',
            'suppressed_by_approved_rule',
        ]);

        $data = $request->validate([
            'classification' => 'required|string|max:64',
            'workflow_status' => 'nullable|in:'.$statuses,
            'conclusion' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);
        $data['workflow_status'] ??= match ($data['classification']) {
            'benign' => 'benign',
            'confirmed_incident' => 'confirmed_incident',
            default => 'classified',
        };

        return response()->json(['data' => $monitoring->transitionAlert($alert, $request->user(), $data)]);
    }

    public function createIncidentForAlert(Request $request, int $id, SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $data = $request->validate([
            'incident_id' => 'nullable|string|max:128',
            'notes' => 'nullable|string',
        ]);
        $data['incident_id'] ??= 'SEC-INC-'.$alert->id;
        $data['classification'] = 'confirmed_incident';
        $data['workflow_status'] = 'confirmed_incident';

        return response()->json([
            'data' => $monitoring->transitionAlert($alert, $request->user(), $data),
            'meta' => [
                'incident_reference' => $data['incident_id'],
                'integration' => 'Security incident module handoff reference recorded on alert.',
            ],
        ], 202);
    }

    public function closeAlert(Request $request, int $id, SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $data = $request->validate([
            'conclusion' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);
        $data['workflow_status'] = 'closed';

        return response()->json(['data' => $monitoring->transitionAlert($alert, $request->user(), $data)]);
    }

    public function transitionAlert(Request $request, int $id, SecurityMonitoringService $monitoring): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.manage-alerts', 'audit-trail.admin']);
        $alert = \App\Models\PlatformAudit\AuditEventAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);
        $statuses = implode(',', SecurityMonitoringService::WORKFLOW_STATUSES);

        $data = $request->validate([
            'workflow_status' => 'required|in:'.$statuses,
            'classification' => 'nullable|string|max:64',
            'conclusion' => 'nullable|string|max:255',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'incident_id' => 'nullable|string|max:128',
            'notes' => 'nullable|string',
        ]);
        if (array_key_exists('assigned_to', $data)) {
            $this->assertTenantUser($request, $data['assigned_to'] ? (int) $data['assigned_to'] : null);
        }

        return response()->json(['data' => $monitoring->transitionAlert($alert, $request->user(), $data)]);
    }

    public function forensicCases(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.admin', 'audit-trail.search']);
        $rows = \App\Models\PlatformAudit\ForensicCase::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate(50);

        return response()->json($rows);
    }

    public function createForensicCase(Request $request, \App\Modules\PlatformAudit\Services\ForensicCaseService $forensics): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.admin']);
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'custody_notes' => 'nullable|string',
            'custody_holder_id' => 'nullable|integer',
            'reference' => 'nullable|string|max:64',
        ]);

        return response()->json([
            'data' => $forensics->create((int) $request->user()->tenant_id, $request->user(), $data),
        ], 201);
    }

    public function linkForensicEvent(Request $request, int $id, \App\Modules\PlatformAudit\Services\ForensicCaseService $forensics): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.admin']);
        $case = \App\Models\PlatformAudit\ForensicCase::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);
        $data = $request->validate([
            'audit_event_id' => 'required|integer',
            'notes' => 'nullable|string',
        ]);

        return response()->json([
            'data' => $forensics->linkEvent($case, (int) $data['audit_event_id'], $request->user(), $data['notes'] ?? null),
        ], 201);
    }

    public function forensicApplyHold(Request $request, int $id, \App\Modules\PlatformAudit\Services\ForensicCaseService $forensics): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.manage-holds', 'audit-trail.admin']);
        $case = \App\Models\PlatformAudit\ForensicCase::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);
        $data = $request->validate([
            'hold_type' => 'nullable|in:legal,audit,investigation',
            'scope_type' => 'nullable|in:event,subject,category,tenant',
            'scope_value' => 'nullable|string',
            'audit_event_id' => 'nullable|integer',
            'reason' => 'nullable|string|max:500',
        ]);

        return response()->json(['data' => $forensics->applyHold($case, $request->user(), $data)], 201);
    }

    public function sealEvidencePackage(Request $request, int $id, \App\Modules\PlatformAudit\Services\ForensicCaseService $forensics): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.admin']);
        $case = \App\Models\PlatformAudit\ForensicCase::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $forensics->sealEvidencePackage($case, $request->user())], 201);
    }

    public function verifyEvidencePackage(Request $request, int $id, \App\Modules\PlatformAudit\Services\ForensicCaseService $forensics): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.create-forensic-case', 'audit-trail.admin', 'audit-trail.search']);
        $pkg = \App\Models\PlatformAudit\ForensicEvidencePackage::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $forensics->verifyPackage($pkg)]);
    }

    public function migrateLegacy(Request $request, LegacyAuditMigrationService $migration): JsonResponse
    {
        $this->requirePerm($request, ['audit-trail.admin', 'audit-trail.manage-ingestion']);
        $stats = $migration->migrateTenant((int) $request->user()->tenant_id, (int) $request->input('limit', 5000));

        return response()->json(['data' => $stats]);
    }

    /**
     * @param  list<string>  $anyOf
     */
    private function requirePerm(Request $request, array $anyOf): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin() || $user->hasAnyRole(['System Admin', 'super-admin'])) {
            return;
        }
        foreach ($anyOf as $perm) {
            if ($user->can($perm)) {
                return;
            }
        }
        abort(403);
    }

    private function assertTenantUser(Request $request, ?int $userId): void
    {
        if (! $userId) {
            return;
        }

        $exists = \App\Models\User::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereKey($userId)
            ->exists();

        if (! $exists) {
            abort(422, 'The selected user is not available in this tenant.');
        }
    }

    private function serializeEvent(\App\Models\PlatformAudit\AuditEvent $event, bool $detail = false): array
    {
        $base = [
            'id' => $event->id,
            'uuid' => $event->uuid,
            'sequence_number' => $event->sequence_number,
            'event_key' => $event->event_key,
            'category' => $event->category,
            'severity' => $event->severity,
            'outcome' => $event->outcome,
            'occurred_at' => optional($event->occurred_at)?->toIso8601String(),
            'actor_type' => $event->actor_type,
            'actor_id' => $event->actor_id,
            'actor_snapshot' => $event->actor_snapshot,
            'principal_id' => $event->principal_id,
            'delegation_id' => $event->delegation_id,
            'acting_appointment_id' => $event->acting_appointment_id,
            'subject_type' => $event->subject_type,
            'subject_id' => $event->subject_id,
            'source_module' => $event->source_module,
            'action' => $event->action,
            'reason' => $event->reason,
            'correlation_id' => $event->correlation_id,
            'retention_class' => $event->retention_class,
            'confidentiality' => $event->confidentiality,
            'migration_status' => $event->migration_status,
            'event_hash' => $event->event_hash,
            'previous_event_hash' => $event->previous_event_hash,
        ];

        if ($detail) {
            $base['payload'] = $event->payload;
            $base['ip_address'] = $event->ip_address;
            $base['user_agent'] = $event->user_agent;
            $base['changes'] = $event->changes;
            $base['actor_detail'] = $event->actorDetail;
            $base['subject_detail'] = $event->subjectDetail;
            $base['context'] = $event->context;
            $base['authority_snapshot'] = $event->authoritySnapshot;
            $base['integrity'] = $event->integrityRecord;
        }

        return $base;
    }
}
