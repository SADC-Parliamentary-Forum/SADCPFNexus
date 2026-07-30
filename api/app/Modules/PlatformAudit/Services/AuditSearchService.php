<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventAccessLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AuditSearchService
{
    public function authorize(User $user, string $ability): void
    {
        $admin = $user->isSystemAdmin()
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Secretary General'])
            || $user->can('audit-trail.admin');

        if ($admin) {
            return;
        }

        if ($user->can($ability)) {
            return;
        }

        // Closely related read scopes (not a substitute for global search).
        if ($ability === 'audit-trail.view-record-history' && $user->can('audit-trail.view-own-records')) {
            return;
        }

        abort(403, 'Audit trail permission required.');
    }

    /**
     * @return LengthAwarePaginator<AuditEvent>
     */
    public function search(User $user, Request $request): LengthAwarePaginator
    {
        $this->authorize($user, 'audit-trail.search');
        $this->logAccess($user, 'search', $request->only([
            'event_key', 'category', 'actor_id', 'subject_type', 'subject_id',
            'date_from', 'date_to', 'outcome', 'source_module', 'q',
        ]));

        $query = AuditEvent::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['eventType:id,event_key,name,category'])
            ->orderByDesc('occurred_at')
            ->orderByDesc('sequence_number');

        $this->applyVisibility($query, $user);
        $this->applyFilters($query, $request);

        return $query->paginate(min((int) $request->input('per_page', 25), 100));
    }

    public function find(User $user, string $idOrUuid): AuditEvent
    {
        $this->authorize($user, 'audit-trail.search');

        $event = AuditEvent::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function (Builder $q) use ($idOrUuid) {
                if (is_numeric($idOrUuid)) {
                    $q->where('id', (int) $idOrUuid);
                }
                $q->orWhere('uuid', $idOrUuid);
            })
            ->with(['changes', 'actorDetail', 'subjectDetail', 'context', 'authoritySnapshot', 'integrityRecord', 'eventType'])
            ->firstOrFail();

        $this->assertCanViewEvent($user, $event);
        $this->logAccess($user, 'view', null, $event->id);

        return $event;
    }

    /**
     * @return LengthAwarePaginator<AuditEvent>
     */
    public function recordHistory(User $user, string $type, int|string $id, Request $request): LengthAwarePaginator
    {
        $this->authorize($user, 'audit-trail.view-record-history');
        $this->logAccess($user, 'record_history', [
            'subject_type' => $type,
            'subject_id' => $id,
        ]);

        $query = AuditEvent::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function (Builder $q) use ($type, $id) {
                $q->where(function (Builder $inner) use ($type, $id) {
                    $inner->where('subject_type', $type)->where('subject_id', $id);
                })->orWhere(function (Builder $inner) use ($type, $id) {
                    // Accept short class names too
                    $inner->where('subject_type', 'like', '%'.$type)->where('subject_id', $id);
                });
            })
            ->with(['eventType:id,event_key,name'])
            ->orderBy('occurred_at')
            ->orderBy('sequence_number');

        $this->applyVisibility($query, $user);

        return $query->paginate(min((int) $request->input('per_page', 50), 100));
    }

    private function applyVisibility(Builder $query, User $user): void
    {
        if ($user->isSystemAdmin() || $user->can('audit-trail.admin') || $user->can('audit-trail.view-privileged')) {
            return;
        }

        if ($user->can('audit-trail.view-module') || $user->can('audit-trail.search')) {
            return;
        }

        // Own-records / record-history: actor or owned subject limited
        $query->where(function (Builder $q) use ($user) {
            $q->where('actor_id', $user->id)
                ->orWhere(function (Builder $inner) use ($user) {
                    $inner->where('subject_type', User::class)->where('subject_id', $user->id);
                });
        });
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        if ($v = $request->input('event_key')) {
            $query->where('event_key', $v);
        }
        if ($v = $request->input('category')) {
            $query->where('category', $v);
        }
        if ($v = $request->input('actor_id')) {
            $query->where('actor_id', $v);
        }
        if ($v = $request->input('subject_type')) {
            $query->where('subject_type', 'like', '%'.$v.'%');
        }
        if ($v = $request->input('subject_id')) {
            $query->where('subject_id', $v);
        }
        if ($v = $request->input('outcome')) {
            $query->where('outcome', $v);
        }
        if ($v = $request->input('source_module')) {
            $query->where('source_module', $v);
        }
        if ($v = $request->input('date_from')) {
            $query->whereDate('occurred_at', '>=', $v);
        }
        if ($v = $request->input('date_to')) {
            $query->whereDate('occurred_at', '<=', $v);
        }
        if ($v = $request->input('q')) {
            $query->where(function (Builder $q) use ($v) {
                $q->where('event_key', 'like', "%{$v}%")
                    ->orWhere('action', 'like', "%{$v}%")
                    ->orWhere('reason', 'like', "%{$v}%");
            });
        }
        // Never expose restricted payload snippets via free-text search on payload.
    }

    private function assertCanViewEvent(User $user, AuditEvent $event): void
    {
        if ($event->confidentiality === 'confidential' && ! $user->can('audit-trail.view-confidential') && ! $user->can('audit-trail.admin') && ! $user->isSystemAdmin()) {
            abort(403, 'Confidential audit event.');
        }
    }

    /**
     * @param  array<string, mixed>|null  $filters
     */
    public function logAccess(User $user, string $type, ?array $filters = null, ?int $targetEventId = null, ?string $purpose = null): void
    {
        AuditEventAccessLog::query()->create([
            'tenant_id' => $user->tenant_id,
            'viewer_user_id' => $user->id,
            'access_type' => $type,
            'purpose' => $purpose ?? request()->input('purpose'),
            'filters' => $filters,
            'target_event_id' => $targetEventId,
            'ip_address' => request()->ip(),
            'accessed_at' => now(),
            'created_at' => now(),
        ]);
    }
}
