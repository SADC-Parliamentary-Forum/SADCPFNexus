<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditControlTestingCampaign;
use App\Models\AuditControlTestingItem;
use App\Models\AuditExternalAccessLog;
use App\Models\AuditExternalAppointment;
use App\Models\AuditExternalEngagement;
use App\Models\AuditExternalEvidenceDownload;
use App\Models\AuditExternalFinding;
use App\Models\AuditExternalRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class AuditExternalService
{
    public function __construct(private readonly AuditEventRecorder $events) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return AuditExternalEngagement::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): AuditExternalEngagement
    {
        $ends = $data['access_ends_at'] ?? null;
        $eng = AuditExternalEngagement::create([
            'tenant_id' => $user->tenant_id,
            'title' => $data['title'],
            'auditor_firm' => $data['auditor_firm'] ?? null,
            'status' => 'planned',
            'access_starts_at' => $data['access_starts_at'] ?? null,
            'access_ends_at' => $ends,
            'auto_revoke_at' => $data['auto_revoke_at'] ?? ($ends ? $ends.' 23:59:59' : null),
            'access_active' => false,
            'evidence_room_enabled' => (bool) ($data['evidence_room_enabled'] ?? false),
            'watermark_required' => (bool) ($data['watermark_required'] ?? true),
            'notes' => $data['notes'] ?? null,
            'coordinator_id' => $data['coordinator_id'] ?? $user->id,
            'confidentiality_level' => $data['confidentiality_level'] ?? 'confidential',
            'created_by' => $user->id,
        ]);
        $this->logAccess($eng, $user, 'created');
        $this->events->record('audit.external.created', $user, AuditExternalEngagement::class, $eng->id);

        return $eng;
    }

    public function activateAccess(AuditExternalEngagement $eng, User $user): AuditExternalEngagement
    {
        $this->assertTenant($eng->tenant_id, $user);
        $eng->update(['access_active' => true, 'status' => 'active', 'auto_revoked_at' => null]);
        $this->logAccess($eng, $user, 'access_activated');
        $this->events->record('audit.external.access_activated', $user, AuditExternalEngagement::class, $eng->id);

        return $eng->fresh();
    }

    public function revokeAccess(AuditExternalEngagement $eng, User $user): AuditExternalEngagement
    {
        $this->assertTenant($eng->tenant_id, $user);
        $eng->update(['access_active' => false, 'status' => 'closed']);
        $this->logAccess($eng, $user, 'access_revoked');
        $this->events->record('audit.external.access_revoked', $user, AuditExternalEngagement::class, $eng->id);

        return $eng->fresh();
    }

    public function autoRevokeIfNeeded(AuditExternalEngagement $eng, User $user): AuditExternalEngagement
    {
        $this->assertTenant($eng->tenant_id, $user);
        if ($eng->shouldAutoRevoke()) {
            $eng->update([
                'access_active' => false,
                'status' => 'closed',
                'auto_revoked_at' => now(),
            ]);
            $this->logAccess($eng, $user, 'access_auto_revoked');
            $this->events->record('audit.external.access_auto_revoked', $user, AuditExternalEngagement::class, $eng->id);
        }

        return $eng->fresh();
    }

    public function logEvidenceDownload(AuditExternalEngagement $eng, array $data, User $user): AuditExternalEvidenceDownload
    {
        $this->assertExternalAccess($eng, $user);
        if (! $eng->evidence_room_enabled) {
            throw ValidationException::withMessages([
                'evidence_room' => 'Evidence room is not enabled for this external workspace.',
            ]);
        }

        $download = AuditExternalEvidenceDownload::create([
            'tenant_id' => $user->tenant_id,
            'external_engagement_id' => $eng->id,
            'downloaded_by' => $user->id,
            'document_label' => $data['document_label'],
            'document_path' => $data['document_path'] ?? null,
            'watermark_applied' => (bool) $eng->watermark_required,
            'ip_address' => request()?->ip(),
        ]);
        $this->logAccess($eng, $user, 'evidence_downloaded', [
            'download_id' => $download->id,
            'document_label' => $download->document_label,
            'watermark_applied' => $download->watermark_applied,
        ]);

        return $download;
    }

    public function assertExternalAccess(AuditExternalEngagement $eng, User $user): void
    {
        $this->assertTenant($eng->tenant_id, $user);
        if ($eng->shouldAutoRevoke()) {
            $this->autoRevokeIfNeeded($eng, $user);
            $eng->refresh();
        }
        if (! $eng->isAccessWindowOpen()) {
            $this->logAccess($eng, $user, 'access_denied_window');
            throw ValidationException::withMessages([
                'access' => 'External auditor access is restricted, time-limited, and currently closed.',
            ]);
        }
        $this->logAccess($eng, $user, 'access_granted');
    }

    public function addRequest(AuditExternalEngagement $eng, array $data, User $user): AuditExternalRequest
    {
        $this->assertExternalAccess($eng, $user);
        $req = AuditExternalRequest::create([
            'tenant_id' => $user->tenant_id,
            'external_engagement_id' => $eng->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'created_by' => $user->id,
        ]);
        $this->logAccess($eng, $user, 'request_created', ['request_id' => $req->id]);

        return $req;
    }

    public function addFinding(AuditExternalEngagement $eng, array $data, User $user): AuditExternalFinding
    {
        $this->assertExternalAccess($eng, $user);
        $finding = AuditExternalFinding::create([
            'tenant_id' => $user->tenant_id,
            'external_engagement_id' => $eng->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'linked_finding_id' => $data['linked_finding_id'] ?? null,
        ]);
        $this->logAccess($eng, $user, 'finding_logged', ['finding_id' => $finding->id]);

        return $finding;
    }

    public function listAppointments(array $filters, User $user): LengthAwarePaginator
    {
        return AuditExternalAppointment::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function createAppointment(array $data, User $user): AuditExternalAppointment
    {
        $row = AuditExternalAppointment::create([
            'tenant_id' => $user->tenant_id,
            'firm_name' => $data['firm_name'],
            'plenary_resolution_ref' => $data['plenary_resolution_ref'] ?? null,
            'appointed_on' => $data['appointed_on'] ?? null,
            'term_starts_on' => $data['term_starts_on'] ?? null,
            'term_ends_on' => $data['term_ends_on'] ?? null,
            'independence_docs_on_file' => (bool) ($data['independence_docs_on_file'] ?? false),
            'independence_doc_path' => $data['independence_doc_path'] ?? null,
            'procurement_tender_id' => $data['procurement_tender_id'] ?? null,
            'status' => $data['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'renewals' => [],
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.appointment.created', $user, AuditExternalAppointment::class, $row->id);

        return $row;
    }

    public function recordRenewal(AuditExternalAppointment $appointment, array $data, User $user): AuditExternalAppointment
    {
        $this->assertTenant($appointment->tenant_id, $user);
        $renewals = $appointment->renewals ?? [];
        $renewals[] = [
            'renewed_on' => $data['renewed_on'],
            'term_starts_on' => $data['term_starts_on'] ?? null,
            'term_ends_on' => $data['term_ends_on'] ?? null,
            'notes' => $data['notes'] ?? null,
            'recorded_by' => $user->id,
            'recorded_at' => now()->toIso8601String(),
        ];
        $appointment->update([
            'renewals' => $renewals,
            'term_starts_on' => $data['term_starts_on'] ?? $appointment->term_starts_on,
            'term_ends_on' => $data['term_ends_on'] ?? $appointment->term_ends_on,
            'status' => 'renewed',
        ]);
        $this->events->record('audit.appointment.renewed', $user, AuditExternalAppointment::class, $appointment->id);

        return $appointment->fresh();
    }

    private function logAccess(AuditExternalEngagement $eng, User $user, string $action, array $meta = []): void
    {
        AuditExternalAccessLog::create([
            'tenant_id' => $eng->tenant_id,
            'external_engagement_id' => $eng->id,
            'actor_id' => $user->id,
            'action' => $action,
            'meta' => $meta ?: null,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
