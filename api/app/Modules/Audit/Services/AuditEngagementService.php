<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditEngagement;
use App\Models\AuditEvidenceRequest;
use App\Models\AuditEvidenceResponse;
use App\Models\AuditIndependenceDeclaration;
use App\Models\AuditObservation;
use App\Models\AuditSample;
use App\Models\AuditUniverseEntity;
use App\Models\AuditWorkpaper;
use App\Models\AuditWorkpaperReviewNote;
use App\Models\User;
use App\Modules\Documents\Services\DocumentStorageService;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuditEngagementService
{
    public function __construct(
        private readonly AuditEventRecorder $events,
        private readonly AuditAccessGate $gate,
        private readonly NotificationService $notifications,
        private readonly DocumentStorageService $documents,
    ) {}

    public function listUniverse(array $filters, User $user): LengthAwarePaginator
    {
        $q = AuditUniverseEntity::query()->where('tenant_id', $user->tenant_id)->orderBy('name');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $q->where(function ($qq) use ($term) {
                $qq->where('name', 'ilike', "%{$term}%")->orWhere('description', 'ilike', "%{$term}%");
            });
        }

        return $q->paginate($filters['per_page'] ?? 20);
    }

    public function createUniverseEntity(array $data, User $user): AuditUniverseEntity
    {
        $entity = AuditUniverseEntity::create([
            'tenant_id' => $user->tenant_id,
            'name' => $data['name'],
            'entity_type' => $data['entity_type'] ?? 'process',
            'department_id' => $data['department_id'] ?? null,
            'owner_name' => $data['owner_name'] ?? null,
            'owner_user_id' => $data['owner_user_id'] ?? null,
            'description' => $data['description'] ?? null,
            'risk_profile' => $data['risk_profile'] ?? null,
            'inherent_risk_score' => $data['inherent_risk_score'] ?? null,
            'status' => $data['status'] ?? 'active',
            'confidentiality_level' => $data['confidentiality_level'] ?? 'standard',
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.universe.created', $user, AuditUniverseEntity::class, $entity->id);

        return $entity;
    }

    public function updateUniverseEntity(AuditUniverseEntity $entity, array $data, User $user): AuditUniverseEntity
    {
        $this->assertTenant($entity->tenant_id, $user);
        $entity->update(array_filter($data, fn ($v) => $v !== null));
        $this->events->record('audit.universe.updated', $user, AuditUniverseEntity::class, $entity->id);

        return $entity->fresh();
    }

    public function listEngagements(array $filters, User $user): LengthAwarePaginator
    {
        $q = AuditEngagement::query()->where('tenant_id', $user->tenant_id)->orderByDesc('id');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['audit_plan_id'])) {
            $q->where('audit_plan_id', $filters['audit_plan_id']);
        }

        return $q->paginate($filters['per_page'] ?? 20);
    }

    public function createEngagement(array $data, User $user): AuditEngagement
    {
        $engagement = AuditEngagement::create([
            'tenant_id' => $user->tenant_id,
            'audit_plan_id' => $data['audit_plan_id'] ?? null,
            'universe_entity_id' => $data['universe_entity_id'] ?? null,
            'reference_number' => $data['reference_number'] ?? ('AE-'.now()->format('Y').'-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT)),
            'title' => $data['title'],
            'audit_type' => $data['audit_type'] ?? null,
            'status' => 'planned',
            'planned_start' => $data['planned_start'] ?? null,
            'planned_end' => $data['planned_end'] ?? null,
            'lead_auditor_id' => $data['lead_auditor_id'] ?? $user->id,
            'auditee_owner_id' => $data['auditee_owner_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'objectives' => $data['objectives'] ?? null,
            'scope' => $data['scope'] ?? null,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
            'created_by' => $user->id,
        ]);

        // Seed pending independence for lead auditor
        if ($engagement->lead_auditor_id) {
            AuditIndependenceDeclaration::create([
                'tenant_id' => $user->tenant_id,
                'engagement_id' => $engagement->id,
                'user_id' => $engagement->lead_auditor_id,
                'status' => 'pending',
            ]);
            $engagement->update(['status' => 'independence_pending']);
        }

        $this->events->record('audit.engagement.created', $user, AuditEngagement::class, $engagement->id);

        return $engagement->fresh();
    }

    public function notifyEngagement(AuditEngagement $engagement, User $user): AuditEngagement
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $engagement->update([
            'notification_sent' => true,
            'notification_sent_at' => now(),
            'status' => $engagement->status === 'planned' ? 'notified' : $engagement->status,
        ]);

        $recipients = collect([$engagement->auditee_owner_id, $engagement->lead_auditor_id])
            ->filter()
            ->unique()
            ->map(fn ($id) => User::find($id))
            ->filter();

        foreach ($recipients as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'audit.engagement_notified',
                ['name' => $recipient->name],
                [
                    'module' => 'audit',
                    'url' => '/audit/engagements/'.$engagement->id,
                    'trigger' => 'audit.engagement_notified',
                ],
                false,
                false
            );
            // Override body to privacy-safe wording when template missing — NotificationService uses defaults.
        }

        $this->events->record('audit.engagement.notified', $user, AuditEngagement::class, $engagement->id);

        return $engagement->fresh();
    }

    public function declareIndependence(AuditEngagement $engagement, array $data, User $user): AuditIndependenceDeclaration
    {
        $this->assertTenant($engagement->tenant_id, $user);

        $declaration = AuditIndependenceDeclaration::firstOrNew([
            'engagement_id' => $engagement->id,
            'user_id' => $user->id,
        ]);
        $declaration->tenant_id = $user->tenant_id;
        $declaration->status = $data['status']; // cleared|recused|blocked
        $declaration->declaration_text = $data['declaration_text'] ?? null;
        $declaration->conflict_notes = $data['conflict_notes'] ?? null;
        $declaration->declared_at = now();
        $declaration->save();

        if ($declaration->status === 'cleared' && $engagement->status === 'independence_pending') {
            $pending = AuditIndependenceDeclaration::where('engagement_id', $engagement->id)
                ->where('status', 'pending')
                ->exists();
            if (! $pending) {
                $engagement->update(['status' => 'fieldwork', 'actual_start' => $engagement->actual_start ?? now()]);
            }
        }

        $this->events->record('audit.independence.declared', $user, AuditIndependenceDeclaration::class, $declaration->id, [
            'status' => $declaration->status,
            'engagement_id' => $engagement->id,
        ]);

        return $declaration;
    }

    public function startFieldwork(AuditEngagement $engagement, User $user): AuditEngagement
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);
        $engagement->update([
            'status' => 'fieldwork',
            'actual_start' => $engagement->actual_start ?? now(),
        ]);
        $this->events->record('audit.engagement.fieldwork_started', $user, AuditEngagement::class, $engagement->id);

        return $engagement->fresh();
    }

    public function createEvidenceRequest(AuditEngagement $engagement, array $data, User $user): AuditEvidenceRequest
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);

        $req = AuditEvidenceRequest::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'requested_from_user_id' => $data['requested_from_user_id'] ?? $engagement->auditee_owner_id,
            'requested_by' => $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
        ]);

        if ($req->requested_from_user_id) {
            $recipient = User::find($req->requested_from_user_id);
            if ($recipient) {
                $this->notifications->dispatch(
                    $recipient,
                    'audit.evidence_requested',
                    ['name' => $recipient->name],
                    ['module' => 'audit', 'url' => '/audit/engagements/'.$engagement->id, 'trigger' => 'audit.evidence_requested'],
                    false,
                    false
                );
            }
        }

        $this->events->record('audit.evidence.requested', $user, AuditEvidenceRequest::class, $req->id);

        return $req;
    }

    public function respondEvidence(AuditEvidenceRequest $request, array $data, User $user, ?UploadedFile $file = null): AuditEvidenceResponse
    {
        $this->assertTenant($request->tenant_id, $user);

        $attachmentPath = $data['attachment_path'] ?? null;
        $contentHash = null;
        $managedDocumentId = null;
        $documentVersionId = null;

        if ($file) {
            $stored = $this->documents->storeForModule($user, $file, [
                'title' => 'Evidence: '.($request->title ?? 'response'),
                'module' => 'audit',
                'document_type' => 'audit_evidence',
                'subject_type' => AuditEvidenceRequest::class,
                'subject_id' => $request->id,
                'classification' => strtoupper((string) ($request->confidentiality_level ?? 'RESTRICTED')),
            ]);
            $attachmentPath = $stored['storage_path'];
            $contentHash = $stored['content_hash'];
            $managedDocumentId = $stored['managed_document_id'];
            $documentVersionId = $stored['document_version_id'];
            $this->documents->createLink(
                $user,
                $stored['document'],
                $stored['version'],
                $request,
                'evidence',
                'audit_evidence'
            );
        }

        $response = AuditEvidenceResponse::create([
            'tenant_id' => $user->tenant_id,
            'evidence_request_id' => $request->id,
            'responded_by' => $user->id,
            'response_text' => $data['response_text'] ?? null,
            'attachment_path' => $attachmentPath,
            'content_hash' => $contentHash,
            'managed_document_id' => $managedDocumentId,
            'document_version_id' => $documentVersionId,
        ]);
        $request->update(['status' => 'responded']);
        $this->events->record('audit.evidence.responded', $user, AuditEvidenceResponse::class, $response->id);

        return $response;
    }

    public function createWorkpaper(AuditEngagement $engagement, array $data, User $user, ?UploadedFile $file = null): AuditWorkpaper
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);

        $storagePath = null;
        $originalFilename = null;
        $mimeType = null;
        $sizeBytes = null;
        $contentHash = null;
        $managedDocumentId = null;
        $documentVersionId = null;

        if ($file) {
            $stored = $this->documents->storeForModule($user, $file, [
                'title' => $data['title'],
                'module' => 'audit',
                'document_type' => 'audit_workpaper',
                'subject_type' => AuditEngagement::class,
                'subject_id' => $engagement->id,
                'classification' => strtoupper((string) ($data['confidentiality_level'] ?? 'RESTRICTED')),
            ]);
            $storagePath = $stored['storage_path'];
            $originalFilename = $stored['original_filename'];
            $mimeType = $stored['mime_type'];
            $sizeBytes = $stored['size_bytes'];
            $contentHash = $stored['content_hash'];
            $managedDocumentId = $stored['managed_document_id'];
            $documentVersionId = $stored['document_version_id'];
        }

        $wp = AuditWorkpaper::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'reference' => $data['reference'] ?? null,
            'title' => $data['title'],
            'content' => $data['content'] ?? null,
            'status' => 'draft',
            'prepared_by' => $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
            'storage_path' => $storagePath,
            'original_filename' => $originalFilename,
            'mime_type' => $mimeType,
            'size_bytes' => $sizeBytes,
            'content_hash' => $contentHash,
            'managed_document_id' => $managedDocumentId,
            'document_version_id' => $documentVersionId,
        ]);

        if ($file && isset($stored)) {
            $this->documents->createLink(
                $user,
                $stored['document'],
                $stored['version'],
                $wp,
                'workpaper',
                'audit_workpaper'
            );
        }

        $this->events->record('audit.workpaper.created', $user, AuditWorkpaper::class, $wp->id);

        return $wp;
    }

    public function addReviewNote(AuditWorkpaper $workpaper, string $note, User $user): AuditWorkpaperReviewNote
    {
        $this->assertTenant($workpaper->tenant_id, $user);
        $review = AuditWorkpaperReviewNote::create([
            'tenant_id' => $user->tenant_id,
            'workpaper_id' => $workpaper->id,
            'author_id' => $user->id,
            'note' => $note,
        ]);
        $workpaper->update([
            'status' => 'under_review',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);
        $this->events->record('audit.workpaper.reviewed', $user, AuditWorkpaper::class, $workpaper->id);

        return $review;
    }

    public function finaliseWorkpaper(AuditWorkpaper $workpaper, User $user): AuditWorkpaper
    {
        $this->assertTenant($workpaper->tenant_id, $user);
        $workpaper->update(['status' => 'final', 'is_immutable' => true]);
        $this->events->record('audit.workpaper.finalised', $user, AuditWorkpaper::class, $workpaper->id);

        return $workpaper->fresh();
    }

    public function documentSample(AuditEngagement $engagement, array $data, User $user): AuditSample
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);

        $sampleIds = $data['sample_ids'] ?? null;
        if (! empty($data['source_table']) && empty($sampleIds) && ! empty($data['sample_size'])) {
            $sampleIds = $this->drawSampleFromSource($data['source_table'], (int) $data['sample_size'], $user->tenant_id);
        }

        $sample = AuditSample::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'method' => $data['method'],
            'population_size' => $data['population_size'] ?? null,
            'sample_size' => $data['sample_size'] ?? (is_array($sampleIds) ? count($sampleIds) : null),
            'population_description' => $data['population_description'] ?? null,
            'rationale' => $data['rationale'] ?? null,
            'source_table' => $data['source_table'] ?? null,
            'sample_ids' => $sampleIds,
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.sample.documented', $user, AuditSample::class, $sample->id);

        return $sample;
    }

    public function createObservation(AuditEngagement $engagement, array $data, User $user): AuditObservation
    {
        $this->assertTenant($engagement->tenant_id, $user);
        $this->gate->assertCanFieldwork($engagement, $user);

        $obs = AuditObservation::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'created_by' => $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'restricted',
        ]);
        $this->events->record('audit.observation.created', $user, AuditObservation::class, $obs->id);

        return $obs;
    }

    private function drawSampleFromSource(string $table, int $size, int $tenantId): array
    {
        $allowed = ['assignments', 'risks', 'procurement_requests', 'travel_requests'];
        if (! in_array($table, $allowed, true) || ! Schema::hasTable($table)) {
            return [];
        }

        return DB::table($table)
            ->when(Schema::hasColumn($table, 'tenant_id'), fn ($q) => $q->where('tenant_id', $tenantId))
            ->inRandomOrder()
            ->limit($size)
            ->pluck('id')
            ->all();
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
