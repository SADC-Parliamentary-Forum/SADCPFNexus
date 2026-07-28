<?php

namespace App\Console\Commands;

use App\Models\Correspondence;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CorrespondenceEscalateDeadlines extends Command
{
    protected $signature = 'correspondence:escalate-deadlines';

    protected $description = 'Notify owners of overdue correspondence deadlines and escalate long-overdue items.';

    public function handle(NotificationService $notifications): int
    {
        $today = now()->startOfDay();
        $overdue = Correspondence::query()
            ->with(['primaryOwner', 'owners.user', 'creator', 'department'])
            ->whereNotIn('status', ['closed', 'archived', 'voided', 'sent', 'draft'])
            ->where(function ($q) use ($today) {
                $q->where(function ($inner) use ($today) {
                    $inner->whereNotNull('final_deadline')
                        ->whereDate('final_deadline', '<', $today);
                })->orWhere(function ($inner) use ($today) {
                    $inner->whereNull('final_deadline')
                        ->whereNotNull('internal_deadline')
                        ->whereDate('internal_deadline', '<', $today);
                });
            })
            ->get();

        $sent = 0;
        foreach ($overdue as $letter) {
            $deadline = $letter->final_deadline ?? $letter->internal_deadline;
            if (! $deadline) {
                continue;
            }

            $daysOverdue = $deadline->copy()->startOfDay()->diffInDays($today);
            $trigger = $daysOverdue >= 3
                ? 'correspondence.deadline_escalated'
                : 'correspondence.deadline_overdue';

            $recipients = $this->recipientsFor($letter, $daysOverdue >= 3);
            foreach ($recipients as $recipient) {
                if ($this->alreadyNotifiedToday($recipient->id, $letter->id, $trigger)) {
                    continue;
                }

                try {
                    $notifications->dispatch($recipient, $trigger, [
                        'name' => $recipient->name,
                        'reference' => $letter->reference_number ?? $letter->registry_reference ?? ('CORR-'.$letter->id),
                        'subject' => $letter->subject ?: $letter->title,
                        'deadline' => $deadline->toDateString(),
                        'days_overdue' => (string) $daysOverdue,
                    ], [
                        'module' => 'correspondence',
                        'record_id' => $letter->id,
                        'url' => '/correspondence/'.$letter->id,
                        'days_overdue' => $daysOverdue,
                    ], false);
                    $sent++;
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }

        $this->info("Sent {$sent} correspondence deadline notification(s).");

        return self::SUCCESS;
    }

    /** @return list<User> */
    private function recipientsFor(Correspondence $letter, bool $escalate): array
    {
        $users = [];
        if ($letter->primaryOwner) {
            $users[$letter->primaryOwner->id] = $letter->primaryOwner;
        }
        foreach ($letter->owners as $owner) {
            if ($owner->user) {
                $users[$owner->user->id] = $owner->user;
            }
        }
        if ($letter->creator) {
            $users[$letter->creator->id] = $letter->creator;
        }

        if ($escalate && $letter->department_id) {
            $hods = User::query()
                ->where('tenant_id', $letter->tenant_id)
                ->where('department_id', $letter->department_id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['HOD', 'Director', 'Secretary General']))
                ->get();
            foreach ($hods as $hod) {
                $users[$hod->id] = $hod;
            }
        }

        return array_values($users);
    }

    private function alreadyNotifiedToday(int $userId, int $letterId, string $trigger): bool
    {
        return Notification::query()
            ->where('user_id', $userId)
            ->where('trigger', $trigger)
            ->whereDate('created_at', now()->toDateString())
            ->where('meta->record_id', $letterId)
            ->exists();
    }
}
