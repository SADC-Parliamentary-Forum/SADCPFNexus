<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationBroadcast;
use App\Models\Notifications\NotificationMaintenanceAlert;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Advanced broadcast management with SoD: high-impact sender ≠ approver.
 */
class BroadcastService
{
    public function __construct(
        private readonly RecipientResolutionService $recipients,
    ) {}

    public function create(int $tenantId, int $actorId, array $data): NotificationBroadcast
    {
        return NotificationBroadcast::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'title' => $data['title'],
            'body' => $data['body'],
            'impact' => $data['impact'] ?? 'normal',
            'broadcast_type' => $data['broadcast_type'] ?? 'general',
            'audience' => $data['audience'] ?? ['roles' => ['staff']],
            'status' => 'draft',
            'created_by' => $actorId,
            'scheduled_at' => isset($data['scheduled_at']) ? Carbon::parse($data['scheduled_at']) : null,
            'idempotency_key' => $data['idempotency_key'] ?? null,
        ]);
    }

    public function submit(NotificationBroadcast $broadcast, User $actor): NotificationBroadcast
    {
        if (! in_array($broadcast->status, ['draft', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'Broadcast cannot be submitted from '.$broadcast->status]);
        }

        $broadcast->update([
            'status' => 'submitted',
            'submitted_by' => $actor->id,
            'submitted_at' => now(),
        ]);

        // Low-impact may auto-approve when submitter has approve permission.
        if (! $this->requiresSoD($broadcast) && $actor->can('notifications.approve-broadcast')) {
            return $this->approve($broadcast, $actor);
        }

        return $broadcast->fresh();
    }

    public function approve(NotificationBroadcast $broadcast, User $approver): NotificationBroadcast
    {
        if ($broadcast->status !== 'submitted' && ! ($broadcast->status === 'draft' && ! $this->requiresSoD($broadcast))) {
            if ($broadcast->status === 'approved') {
                return $broadcast;
            }
            throw ValidationException::withMessages(['status' => 'Broadcast must be submitted before approval']);
        }

        if ($this->requiresSoD($broadcast)) {
            $senderId = $broadcast->submitted_by ?: $broadcast->created_by;
            if ((int) $approver->id === (int) $senderId) {
                throw ValidationException::withMessages([
                    'approver' => 'Separation of duties: high-impact broadcast sender cannot approve.',
                ]);
            }
        }

        $broadcast->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'submitted_by' => $broadcast->submitted_by ?: $approver->id,
            'submitted_at' => $broadcast->submitted_at ?: now(),
        ]);

        if (! $broadcast->scheduled_at || $broadcast->scheduled_at->lte(now())) {
            return $this->send($broadcast);
        }

        return $broadcast->fresh();
    }

    public function cancel(NotificationBroadcast $broadcast, User $actor, ?string $reason = null): NotificationBroadcast
    {
        if (in_array($broadcast->status, ['sent', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'Cannot cancel '.$broadcast->status.' broadcast']);
        }

        $broadcast->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancel_reason' => $reason,
        ]);

        return $broadcast->fresh();
    }

    public function send(NotificationBroadcast $broadcast): NotificationBroadcast
    {
        if ($broadcast->status !== 'approved' && $broadcast->status !== 'sending') {
            throw ValidationException::withMessages(['status' => 'Broadcast must be approved before send']);
        }

        $broadcast->update(['status' => 'sending']);
        $resolved = $this->recipients->resolve((int) $broadcast->tenant_id, $broadcast->audience ?? []);
        $dispatch = app(NotificationService::class);

        foreach ($resolved as $entry) {
            $dispatch->dispatch(
                $entry['user'],
                'notifications.broadcast',
                [
                    'name' => $entry['user']->name,
                    'title' => $broadcast->title,
                    'summary' => $broadcast->body,
                ],
                [
                    'module' => 'notifications',
                    'url' => '/notifications',
                    'record_id' => $broadcast->id,
                    'importance' => $broadcast->impact === 'critical' ? 'critical' : 'high',
                    'force_immediate' => true,
                    'confidentiality' => 'internal',
                ],
                true,
                true,
                'broadcast:'.$broadcast->id.':user:'.$entry['user']->id,
            );
        }

        $broadcast->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        return $broadcast->fresh();
    }

    public function scheduleMaintenance(int $tenantId, int $actorId, array $data): NotificationMaintenanceAlert
    {
        $broadcast = $this->create($tenantId, $actorId, [
            'title' => $data['title'],
            'body' => $data['body'],
            'impact' => $data['impact'] ?? 'high',
            'broadcast_type' => 'maintenance',
            'audience' => $data['audience'] ?? ['roles' => ['staff']],
            'scheduled_at' => $data['starts_at'] ?? null,
            'idempotency_key' => $data['idempotency_key'] ?? ('maint:'.Str::uuid()),
        ]);

        $alert = NotificationMaintenanceAlert::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'broadcast_id' => $broadcast->id,
            'title' => $data['title'],
            'body' => $data['body'],
            'starts_at' => Carbon::parse($data['starts_at']),
            'ends_at' => isset($data['ends_at']) ? Carbon::parse($data['ends_at']) : null,
            'revalidate_at' => isset($data['revalidate_at'])
                ? Carbon::parse($data['revalidate_at'])
                : Carbon::parse($data['starts_at'])->subHours(2),
            'status' => 'scheduled',
            'created_by' => $actorId,
        ]);

        return $alert;
    }

    public function revalidateMaintenance(int $limit = 20): int
    {
        $due = NotificationMaintenanceAlert::query()
            ->where('status', 'scheduled')
            ->whereNotNull('revalidate_at')
            ->where('revalidate_at', '<=', now())
            ->where('starts_at', '>', now())
            ->limit($limit)
            ->get();

        $count = 0;
        foreach ($due as $alert) {
            $broadcast = $alert->broadcast_id ? NotificationBroadcast::find($alert->broadcast_id) : null;
            if ($broadcast && in_array($broadcast->status, ['draft', 'submitted', 'approved'], true)) {
                // Re-issue a reminder notice to creator — does not auto-send without approval.
                $creator = User::find($alert->created_by);
                if ($creator) {
                    app(NotificationService::class)->dispatch(
                        $creator,
                        'notifications.maintenance_revalidation',
                        [
                            'name' => $creator->name,
                            'title' => $alert->title,
                            'summary' => 'Maintenance alert revalidation due before start: '.$alert->title,
                        ],
                        [
                            'module' => 'notifications',
                            'url' => '/admin/notifications',
                            'record_id' => $alert->id,
                            'force_immediate' => true,
                        ],
                        true,
                        false,
                        'maint-revalidate:'.$alert->id,
                    );
                }
            }
            $alert->update(['revalidate_at' => $alert->starts_at?->copy()->subMinutes(30)]);
            $count++;
        }

        // Activate / expire windows
        NotificationMaintenanceAlert::query()
            ->where('status', 'scheduled')
            ->where('starts_at', '<=', now())
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->update(['status' => 'active']);

        NotificationMaintenanceAlert::query()
            ->whereIn('status', ['scheduled', 'active'])
            ->whereNotNull('ends_at')
            ->where('ends_at', '<=', now())
            ->update(['status' => 'expired']);

        return $count;
    }

    public function requiresSoD(NotificationBroadcast $broadcast): bool
    {
        return in_array($broadcast->impact, ['high', 'critical'], true)
            || $broadcast->broadcast_type === 'maintenance';
    }
}
