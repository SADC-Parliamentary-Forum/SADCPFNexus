<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditExternalAccessLog;
use App\Models\AuditExternalEngagement;
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
        $eng = AuditExternalEngagement::create([
            'tenant_id' => $user->tenant_id,
            'title' => $data['title'],
            'auditor_firm' => $data['auditor_firm'] ?? null,
            'status' => 'planned',
            'access_starts_at' => $data['access_starts_at'] ?? null,
            'access_ends_at' => $data['access_ends_at'] ?? null,
            'access_active' => false,
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
        $eng->update(['access_active' => true, 'status' => 'active']);
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

    public function assertExternalAccess(AuditExternalEngagement $eng, User $user): void
    {
        $this->assertTenant($eng->tenant_id, $user);
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
