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
use App\Modules\PlatformAudit\Services\AuditSearchService;
use App\Modules\PlatformAudit\Services\AuditTrailGovernanceService;
use App\Modules\PlatformAudit\Services\EventTypeRegistryService;
use App\Modules\PlatformAudit\Services\LegacyAuditMigrationService;
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
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;
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
                'open_dead_letters' => AuditEventDeadLetter::query()->where('tenant_id', $tenantId)->where('status', 'open')->count(),
                'events_total' => \App\Models\PlatformAudit\AuditEvent::query()->where('tenant_id', $tenantId)->count(),
                'latest_sequence' => \App\Models\PlatformAudit\AuditEvent::query()->where('tenant_id', $tenantId)->max('sequence_number'),
            ],
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
                'phase2_stubs' => [
                    'siem' => 'Governance Configuration Pending',
                    'forensic_workspace' => 'Governance Configuration Pending',
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
